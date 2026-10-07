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
    const cql = `type = page AND text ~ "${documentName}"`;
    const response = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content/search?cql=${cql}&expand=version,space`
    );

    if (!response.ok) {
      return { success: false, error: `Błąd API wyszukiwania: ${response.status}` };
    }

    const data = await response.json();

    const results = data.results
      .filter((page) => String(page.id) !== String(pageId))
      .map((page) => ({
        id: page.id,
        title: page.title,
        url: page._links.webui,
        space: page.space?.name || 'Nieznana przestrzeń'
      }));

    return { success: true, pages: results };
  } catch (err) {
    console.error("[BACKEND] Wyjątek w getLinkingPages:", err);
    return { success: false, error: err.message };
  }
});

// TUTAJ BYŁ BŁĄD. Teraz eksportujemy obiekt resolvera, by plik nadrzędny mógł go odczytać.
export default resolver;