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
  console.log("=== [BACKEND] START getLinkingPages ===");
  const { documentName } = req.payload;
  const pageId = req.context?.extension?.content?.id;

  if (!documentName) {
    return { success: false, error: 'Pole wyszukiwania jest puste.' };
  }

  try {
    // 1. Rozbijamy szukaną frazę na słowa (separatorem są spacje i myślniki)
    // Np. "Ancona-002" zamieni się na tablicę: ["Ancona", "002"]
    const tokens = documentName.split(/[\s-]+/).filter(t => t.trim().length > 0);
    
    // 2. Budujemy bezpieczne zapytanie z operatorem AND, omijając cudzysłowy dla całych fraz
    // Wynik dla "Ancona-002": text ~ "Ancona*" AND text ~ "002*"
    const textQuery = tokens.map(t => `text ~ "${t}*"`).join(' AND ');
    const cql = `type = page AND ${textQuery}`;
    
    console.log(`[BACKEND] Wykonuję zapytanie CQL: ${cql}`);

    const response = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content/search?cql=${cql}&expand=version,space`
    );

    if (!response.ok) {
      return { success: false, error: `Błąd API wyszukiwania: ${response.status}` };
    }

    const data = await response.json();
    
    // Zrzucamy całą surową odpowiedź z wyszukiwania do logów
    console.log("[BACKEND] SUROWA ODPOWIEDŹ CQL:", JSON.stringify(data, null, 2));

    const results = data.results
      // .filter((page) => String(page.id) !== String(pageId)) // Zakomentowane na czas testów
      .map((page) => ({
        id: page.id,
        title: page.title,
        url: page._links.webui,
        space: page.space?.name || 'Nieznana przestrzeń'
      }));

    return { success: true, pages: results, rawData: data };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w getLinkingPages:", err);
    return { success: false, error: err.message };
  }
});

// NOWY RESOLVER - Pobiera konkretną stronę do analizy
resolver.define('debugSpecificPage', async (req) => {
  console.log("=== [BACKEND] START debugSpecificPage ===");
  const { pageId } = req.payload; 

  try {
    // Pobieramy stronę wraz z jej zawartością (body.storage) żeby zobaczyć co znajduje się w jej kodzie
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