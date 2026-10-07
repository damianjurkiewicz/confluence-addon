import React, { useState } from 'react';
import ForgeReconciler, {
  Text,
  Textfield,
  Button,
  Stack,
  Link,
  Heading,
} from '@forge/react';
import { requestConfluence } from '@forge/bridge';

const App = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!input) {
      setError('Proszę podać adres URL lub tytuł strony.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let searchTerm = input;
      let pageIdToExclude = null;

      // Wyciągamy ID oraz tytuł (jeśli istnieje) z adresu URL
      const urlMatch = input.match(/(?:pages\/|pages\/edit-v2\/)(\d+)(?:\/([^\/?#]+))?/);

      if (urlMatch) {
        pageIdToExclude = urlMatch[1]; 
        
        if (urlMatch[2]) {
          const decodedTitle = decodeURIComponent(urlMatch[2]);
          searchTerm = decodedTitle.replace(/\+/g, ' ');
        } else {
          throw new Error('Ten link nie zawiera tytułu. Wklej pełny adres z tytułem na końcu lub wpisz sam tytuł ręcznie.');
        }
      }

      // Zabezpieczenie wewnętrznych cudzysłowów w tytule
      const safeTitle = searchTerm.replace(/"/g, '\\"');
      
      // POPRAWKA: Pojedyncze cudzysłowy wokół stringa wyszukiwanego
      const cql = `type = page AND text ~ "${safeTitle}"`;

      // Wyszukiwanie w API (encodeURIComponent poprawnie koduje spacje i znaki specjalne dla URL)
      const searchRes = await requestConfluence(`/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=20`);
      
      if (!searchRes.ok) {
        const errorText = await searchRes.text();
        throw new Error(`Błąd API (Status: ${searchRes.status}): ${errorText}`);
      }
      
      const searchData = await searchRes.json();
      
      // Odrzucamy stronę źródłową (komponent nie ma raportować, że używa sam siebie)
      const fetchedPages = (searchData.results || [])
        .filter((page) => page.id !== pageIdToExclude)
        .map((page) => ({
          id: page.id,
          title: page.title,
          url: page._links?.webui || '#',
        }));
        
      setResults(fetchedPages);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack space="space.200">
      <Heading size="medium">🔍 Gdzie użyto tego komponentu?</Heading>
      
      <Textfield
        placeholder="Wklej link (np. .../421167140/Ancona-002...) lub wpisz tytuł..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button appearance="primary" onClick={handleSearch} isLoading={loading}>
        Znajdź powiązane dokumenty
      </Button>
      
      {error && <Text>**Błąd:** {error}</Text>}
      {results && results.length === 0 && (
        <Text>Ten komponent nie jest obecnie używany na żadnej innej stronie (lub nie zaktualizowano jeszcze indeksu wyszukiwarki).</Text>
      )}
      {results && results.length > 0 && (
        <Stack space="space.100">
          <Text>**Komponent został użyty na następujących stronach ({results.length}):**</Text>
          {results.map((page) => (
            <Text key={page.id}>
                <Link href={`/wiki${page.url}`}>{page.title}</Link>
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);