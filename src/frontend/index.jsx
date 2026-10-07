import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Textfield, Button, Box, Spinner, Text, Strong, Link } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  // Przechodzimy na kontrolowany stan wartości pola tekstowego
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      console.log("[FRONTEND] Wywołuję invoke('getInitialData')");
      try {
        const data = await invoke('getInitialData');
        console.log("[FRONTEND] Odpowiedź z getInitialData:", data);
        
        if (data.success && data.title) {
          setSearchTerm(data.title); // Zapisujemy pobraną nazwę w stanie
        } else {
          setInitError(data.error);
        }
      } catch (err) {
        console.error("[FRONTEND] Błąd invoke:", err);
        setInitError("Nie udało się połączyć z backendem.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Nowa funkcja przypięta bezpośrednio do zdarzenia onClick na przycisku
  const handleSearch = async () => {
    console.log(`[FRONTEND] Przycisk kliknięty. Szukam: ${searchTerm}`);
    if (!searchTerm) return;

    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      const response = await invoke('getLinkingPages', { documentName: searchTerm });
      console.log("[FRONTEND] Odpowiedź z getLinkingPages:", response);

      if (response.success) {
        setResults(response.pages);
      } else {
        setError(response.error);
      }
    } catch (err) {
      console.error("[FRONTEND] Błąd invoke wyszukiwania:", err);
      setError('Błąd połączenia z serwerem podczas wyszukiwania.');
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <Box padding="space.100">
        <Spinner size="large" />
        <Text>Ładowanie danych ze strony...</Text>
      </Box>
    );
  }

  return (
    <Box>
      {initError && (
         <Box padding="space.100">
           <Text><Strong>Błąd startowy:</Strong> {initError}</Text>
         </Box>
      )}

      <Box padding="space.100">
        <Text><Strong>Znajdź powiązane dokumenty</Strong></Text>
        <Textfield
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           isDisabled={isSearching}
           placeholder="Nazwa dokumentu..."
         />
         <Box paddingBlockStart="space.100">
           {/* Przycisk używa teraz bezpośrednio onClick zamiast czekać na onSubmit formularza */}
           <Button onClick={handleSearch} appearance="primary" isLoading={isSearching}>
             Szukaj
           </Button>
         </Box>
      </Box>

      {error && (
        <Box padding="space.100">
          <Text><Strong>Błąd wyszukiwania:</Strong> {error}</Text>
        </Box>
      )}

      {results && results.length > 0 && (
        <Box padding="space.100">
          <Text><Strong>Znaleziono ({results.length}):</Strong></Text>
          {results.map((page) => (
            <Text key={page.id}>
              • <Link href={page.url}>{page.title}</Link> ({page.space})
            </Text>
          ))}
        </Box>
      )}

      {results && results.length === 0 && (
        <Box padding="space.100">
          <Text>Brak wyników dla tej nazwy dokumentu.</Text>
        </Box>
      )}
    </Box>
  );
};

ForgeReconciler.render(<App />);