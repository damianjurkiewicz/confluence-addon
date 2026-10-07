import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

resolver.define('getLinkingPages', async (req) => {
  const { pageUrl } = req.payload;

  if (!pageUrl) {
    return { success: false, error: 'Proszę podać adres URL strony.' };
  }

  // 1. Wyciągamy ID strony z linku (np. z https://.../pages/365330608/...)
  const match = pageUrl.match(/pages\/(\d+)/);
  const pageId = match ? match[1] : null;

  try {
    // 2. Szukamy stron, które zawierają odnośnik/tekst z podanym ID lub pełnym adresem URL
    // Wykorzystujemy wyszukiwanie CQL po pełnym tekście (text ~ ...)
    const searchTerm = pageId ? `text ~ "${pageId}"` : `text ~ "${pageUrl}"`;
    const cql = `type = page AND ${searchTerm}`;

    const response = await api.asUser().requestConfluence(
      route`/wiki/rest/api/content/search?cql=${cql}&expand=version,space`
    );

    if (!response.ok) {
      return { success: false, error: `Błąd API: ${response.status}` };
    }

    const data = await response.json();

    // Filtrujemy wyników tak, aby nie pokazywać samej strony docelowej
    const results = data.results
      .filter((page) => page.id !== pageId)
      .map((page) => ({
        id: page.id,
        title: page.title,
        url: page._links.webui,
        space: page.space?.name || 'Nieznana przestrzeń',
      }));

    return { success: true, pages: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

export default resolver.getDefinitions();