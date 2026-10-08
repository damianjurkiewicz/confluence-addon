import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Pomocnicza funkcja: pobiera ID strony nadrzędnej (np. "Kits" lub "Elements")
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
      return { success: false, error: 'Brak ID strony w kontekście.' };
    }
    
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
    if (!response.ok) {
      return { success: false, error: `Błąd API: ${response.status}` };
    }
    
    const data = await response.json();
    const title = data.title || '';

    // Logika detekcji kodu (np. ELE-036, MBE-002) - bierzemy PIERWSZY kod z początku tytułu
    const codeMatch = title.match(/\b(ELE-\d+|MBE-\d+|[A-Z]+-\d+)\b/i);
    let detectedTerm = codeMatch ? codeMatch[1].toUpperCase() : title;
    
    // Ustalanie domyślnego folderu docelowego
    let defaultTargetFolder = 'Kits';
    if (detectedTerm.startsWith('MBE')) {
      defaultTargetFolder = 'Elements'; // MBE szukamy w Elements
    } else if (detectedTerm.startsWith('ELE')) {
      defaultTargetFolder = 'Kits';     // ELE szukamy w Kits
    }

    return { 
      success: true, 
      pageId: pageId, 
      title: title,
      detectedTerm: detectedTerm,
      defaultTargetFolder: defaultTargetFolder
    };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w getInitialData:", err);
    return { success: false, error: err.message };
  }
});

resolver.define('getLinkingPages', async (req) => {
  console.log("=== [BACKEND] START getLinkingPages ===");
  const { documentName, targetFolder } = req.payload;
  const pageId = req.context?.extension?.content?.id;
  const spaceKey = 'VDAL';

  if (!documentName) {
    return { success: false, error: 'Pole wyszukiwania jest puste.' };
  }

  const folderToSearch = targetFolder || (documentName.trim().toUpperCase().startsWith('MBE') ? 'Elements' : 'Kits');

  try {
    const searchTerm = documentName.trim();
    console.log(`[BACKEND] Szukany kod: "${searchTerm}", Folder docelowy: "${folderToSearch}"`);

    // 1. Znajdź ID folderu docelowego (Kits lub Elements)
    const folderId = await getParentFolderId(folderToSearch, spaceKey);
    if (!folderId) {
      return { success: false, error: `Nie odnaleziono folderu nadrzędnego "${folderToSearch}" w przestrzeni ${spaceKey}.` };
    }

    // 2. Pobierz potomków danego folderu
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
        return { success: false, error: `Błąd API wyszukiwania potomków: ${response.status}` };
      }

      const data = await response.json();
      allPages.push(...data.results);

      if (data.results.length < limit) break;
      start += limit;
    }

    console.log(`[BACKEND] Pobrano ${allPages.length} stron z folderu ${folderToSearch}`);

    // 3. SKANER JS: TYLKO I WYŁĄCZNIE W TREŚCI (body.storage)
    // Ignorujemy page.title całkowicie!
    const filteredResults = allPages
      .filter((page) => String(page.id) !== String(pageId)) // Wykluczamy stronę bieżącą
      .filter((page) => {
        const body = page.body?.storage?.value || "";
        return body.includes(searchTerm); // <-- SZUKAMY TYLKO W ŚRODKU ARTYKUŁU
      });

    console.log(`[BACKEND] Znaleziono ${filteredResults.length} stron z frazą w środku treści.`);

    const results = filteredResults.map((page) => ({
      id: page.id,
      title: page.title,
      url: page._links.webui,
      space: page.space?.name || 'Nieznana przestrzeń'
    }));

    return { 
      success: true, 
      pages: results, 
      searchedIn: folderToSearch
    };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w getLinkingPages:", err);
    return { success: false, error: err.message };
  }
});

export default resolver;