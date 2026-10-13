import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Helper function: retrieves parent page ID (e.g., "Kits" or "Elements")
async function getParentFolderId(folderTitle, spaceKey = 'VDAL') {
  const parentCql = `type = page AND space = "${spaceKey}" AND title ~ "${folderTitle}"`;
  const response = await api.asUser().requestConfluence(
    route`/wiki/rest/api/content/search?cql=${parentCql}&limit=10`
  );

  if (!response.ok) return null;
  const data = await response.json();
  const found = data.results?.find(p => p.title.trim().toLowerCase() === folderTitle.toLowerCase()) 
    || data.results?.[0];
  
  return found ? found.id : null;
}

resolver.define('getInitialData', async (req) => {
  console.log("=== [BACKEND] START getInitialData ===");
  try {
    const pageId = req.context?.extension?.content?.id;
    if (!pageId) {
      return { success: false, error: 'Missing page ID in context.' };
    }
    
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    const title = data.title || '';

    // Extract reference code (e.g., ELE-036, MBE-002) - takes the first matching code pattern
    const codeMatch = title.match(/\b(ELE-\d+|MBE-\d+|[A-Z]+-\d+)\b/i);
    let detectedTerm = codeMatch ? codeMatch[1].toUpperCase() : title;
    
    // Determine target search folder based on prefix
    let defaultTargetFolder = 'Kits';
    if (detectedTerm.startsWith('MBE')) {
      defaultTargetFolder = 'Elements'; // Search MBE codes inside Elements
    } else if (detectedTerm.startsWith('ELE')) {
      defaultTargetFolder = 'Kits';     // Search ELE codes inside Kits
    }

    return { 
      success: true, 
      pageId: pageId, 
      title: title,
      detectedTerm: detectedTerm,
      defaultTargetFolder: defaultTargetFolder
    };
  } catch (err) {
    console.error("[BACKEND] Exception in getInitialData:", err);
    return { success: false, error: err.message };
  }
});

resolver.define('getLinkingPages', async (req) => {
  console.log("=== [BACKEND] START getLinkingPages ===");
  const { documentName, targetFolder } = req.payload;
  const pageId = req.context?.extension?.content?.id;
  const spaceKey = 'VDAL';

  if (!documentName) {
    return { success: false, error: 'Search term is empty.' };
  }

  const folderToSearch = targetFolder || (documentName.trim().toUpperCase().startsWith('MBE') ? 'Elements' : 'Kits');

  try {
    const searchTerm = documentName.trim();
    console.log(`[BACKEND] Search code: "${searchTerm}", Target folder: "${folderToSearch}"`);

    // 1. Resolve target parent folder ID
    const folderId = await getParentFolderId(folderToSearch, spaceKey);
    if (!folderId) {
      return { success: false, error: `Parent folder "${folderToSearch}" not found in space "${spaceKey}".` };
    }

    // 2. Fetch descendants of the target folder
    let allPages = [];
    let start = 0;
    const limit = 100;
    const maxFetch = 500;

    const cql = `type = page AND ancestor = ${folderId}`;

    while (start < maxFetch) {
      const response = await api.asUser().requestConfluence(
        route`/wiki/rest/api/content/search?cql=${cql}&expand=version,space,body.storage&limit=${limit}&start=${start}`
      );

      if (!response.ok) {
        return { success: false, error: `Error searching descendants: ${response.status}` };
      }

      const data = await response.json();
      allPages.push(...data.results);

      if (data.results.length < limit) break;
      start += limit;
    }

    console.log(`[BACKEND] Retrieved ${allPages.length} pages from "${folderToSearch}"`);

    // 3. JavaScript filter: Search strictly within body.storage (ignoring page titles)
    const filteredResults = allPages
      .filter((page) => String(page.id) !== String(pageId)) // Exclude current page
      .filter((page) => {
        const body = page.body?.storage?.value || "";
        return body.includes(searchTerm);
      });

    console.log(`[BACKEND] Found ${filteredResults.length} matching pages in body storage.`);

    // 4. Map results with normalized Confluence URL format
    const results = filteredResults.map((page) => {
      const webui = page._links?.webui || '';
      const formattedUrl = webui.startsWith('/wiki') 
        ? webui 
        : `/wiki${webui}`;

      return {
        id: page.id,
        title: page.title,
        url: formattedUrl,
        space: page.space?.name || 'Unknown space'
      };
    });

    return { 
      success: true, 
      pages: results, 
      searchedIn: folderToSearch
    };
  } catch (err) {
    console.error("[BACKEND] Exception in getLinkingPages:", err);
    return { success: false, error: err.message };
  }
});

export default resolver;