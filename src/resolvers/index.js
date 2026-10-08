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
  console.log("=== [BACKEND] START getLinkingPages (Tryb Hybrydowy) ===");
  const { documentName } = req.payload;
  const pageId = req.context?.extension?.content?.id;

  if (!documentName) {
    return { success: false, error: 'Pole wyszukiwania jest puste.' };
  }

  try {
    const searchTerm = documentName.trim();

    // 1. KROK API (Grube sito)
    // Wyciągamy pierwszy sensowny człon słowa (np. z "Ancona-002" wyciągnie "Ancona")
    const coreWords = searchTerm.split(/[^a-zA-Z0-9\u00C0-\u017F]+/);
    const broadTerm = coreWords.find(w => w.length > 1) || coreWords[0] || searchTerm;

    // Szukamy szeroko. Dajemy limit 100 i expand=body.storage (aby otrzymać kod źródłowy stron)
    const cql = `type = page AND text ~ "${broadTerm}*"`;
    console.log(`[BACKEND] Wykonuję SZEROKIE zapytanie CQL: ${cql}`);

    const response = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content/search?cql=${cql}&expand=version,space,body.storage&limit=100`
    );

    if (!response.ok) {
      return { success: false, error: `Błąd API wyszukiwania: ${response.status}` };
    }

    const data = await response.json();
    console.log(`[BACKEND] API zwróciło stron (przed filtrem JS): ${data.size}`);

    // 2. KROK JAVASCRIPT (Precyzyjny skaner)
    // Filtrujemy strony szukając dokładnego ciągu znaków (wraz ze znakami specjalnymi)
    const filteredResults = data.results.filter(page => {
      const title = page.title || "";
      // Zabezpieczenie przed brakiem treści
      const body = page.body?.storage?.value || ""; 
      
      // Dokładne sprawdzenie, czy ciąg wpisany przez użytkownika jest w tytule lub kodzie strony
      return title.includes(searchTerm) || body.includes(searchTerm);
    });

    console.log(`[BACKEND] JS odfiltrował i zostawił dokładnych dopasowań: ${filteredResults.length}`);

    const results = filteredResults
      // .filter((page) => String(page.id) !== String(pageId)) // Zakomentowane na czas testów
      .map((page) => ({
        id: page.id,
        title: page.title,
        url: page._links.webui,
        space: page.space?.name || 'Nieznana przestrzeń'
      }));

    // Zwracamy surowe statystyki dla frontendu, żebyś widział co odsiało API, a co JS
    const debugStats = { 
      cqlFound: data.size, 
      jsKept: filteredResults.length 
    };

    return { success: true, pages: results, rawData: debugStats };
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