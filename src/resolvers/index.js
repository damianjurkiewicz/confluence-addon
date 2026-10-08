import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getInitialData', async (req) => {
  console.log("=== [BACKEND] START getInitialData ===");
  try {
    const pageId = req.context?.extension?.content?.id;
    if (!pageId) {
      return { success: false, error: 'Brak ID strony w kontekście. Zobacz logi backendu.' };
    }
    
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
    
    if (!response.ok) {
      return { success: false, error: `Błąd API: ${response.status}` };
    }
    
    const data = await response.json();
    return { success: true, pageId: pageId, title: data.title };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w getInitialData:", err);
    return { success: false, error: err.message };
  }
});

resolver.define('getLinkingPages', async (req) => {
  console.log("=== [BACKEND] START getLinkingPages (Potomkowie Kits) ===");
  const { documentName } = req.payload;
  const pageId = req.context?.extension?.content?.id;

  if (!documentName) {
    return { success: false, error: 'Pole wyszukiwania jest puste.' };
  }

  try {
    const searchTerm = documentName.trim();
    const spaceKey = 'VDAL';

    // 1. ZNAJDŹ STRONĘ "Kits" PRZEZ CQL SEARCH (BEZ BŁĘDU 410)
    console.log(`[BACKEND] Szukam strony nadrzędnej "Kits" w przestrzeni "${spaceKey}"...`);
    const parentCql = `type = page AND space = "${spaceKey}" AND title ~ "Kits"`;
    
    const parentSearchResp = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content/search?cql=${parentCql}&limit=10`
    );

    if (!parentSearchResp.ok) {
      return { success: false, error: `Błąd API podczas szukania strony nadrzędnej: ${parentSearchResp.status}` };
    }

    const parentSearchData = await parentSearchResp.json();
    // Szukamy dokładnie strony z tytułem "Kits"
    const parentPage = parentSearchData.results?.find(p => p.title.trim().toLowerCase() === 'kits') 
      || parentSearchData.results?.[0];

    if (!parentPage) {
      return { success: false, error: `Nie znaleziono strony "Kits" w przestrzeni "${spaceKey}".` };
    }

    const kitsId = parentPage.id;
    console.log(`[BACKEND] Znaleziono ID węzła Kits: ${kitsId} (Tytuł: ${parentPage.title})`);

    // 2. POBIERZ WSZYSTKICH POTOMKÓW (ancestor = kitsId)
    let allKitPages = [];
    let start = 0;
    const limit = 100;
    const maxFetch = 500;

    const cql = `type = page AND ancestor = ${kitsId}`;
    console.log(`[BACKEND] Wykonuję zapytanie CQL potomków: ${cql}`);

    while (start < maxFetch) {
      const response = await api.asUser().requestConfluence(
        route`/wiki/rest/api/content/search?cql=${cql}&expand=version,space,body.storage&limit=${limit}&start=${start}`
      );

      if (!response.ok) {
        return { success: false, error: `Błąd API wyszukiwania potomków: ${response.status}` };
      }

      const data = await response.json();
      allKitPages.push(...data.results);

      if (data.results.length < limit) {
        break;
      }
      start += limit;
    }

    console.log(`[BACKEND] Pobrano ${allKitPages.length} zestawów spod folderu Kits`);

    // 3. SKANER JAVASCRIPT PO HTML
    const filteredResults = allKitPages.filter(page => {
      const title = page.title || "";
      const body = page.body?.storage?.value || "";

      return title.includes(searchTerm) || body.includes(searchTerm);
    });

    console.log(`[BACKEND] JS znalazł powiązania w: ${filteredResults.length} zestawach`);

    // 4. MAPOWANIE DANYCH
    const results = filteredResults
      // .filter((page) => String(page.id) !== String(pageId)) // Odkomentuj, gdy zechcesz ukryć bieżącą stronę
      .map((page) => ({
        id: page.id,
        title: page.title,
        url: page._links.webui,
        space: page.space?.name || 'Nieznana przestrzeń'
      }));

    return { 
      success: true, 
      pages: results, 
      rawData: { kitsDescendantsCount: allKitPages.length, matchedCount: filteredResults.length } 
    };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w getLinkingPages:", err);
    return { success: false, error: err.message };
  }
});

resolver.define('debugSpecificPage', async (req) => {
  console.log("=== [BACKEND] START debugSpecificPage ===");
  const { pageId } = req.payload; 

  try {
    const response = await api.asUser().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}?body-format=storage`
    );

    if (!response.ok) {
      return { success: false, error: `Błąd pobierania strony ${pageId}: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[BACKEND] SUROWE DANE DLA STRONY ${pageId}:`, JSON.stringify(data, null, 2));

    return { success: true, data: data };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w debugSpecificPage:", err);
    return { success: false, error: err.message };
  }
});

export default resolver;