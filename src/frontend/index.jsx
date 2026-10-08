import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Textfield, Button, Box, Spinner, Text, Strong, Link, TextArea } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [initError, setInitError] = useState(null);
  
  // Stany dla trybu Debug
  const [debugData, setDebugData] = useState('');
  const [isDebugLoading, setIsDebugLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      console.log("[FRONTEND] Wywołuję invoke('getInitialData')");
      try {
        const data = await invoke('getInitialData');
        if (data.success && data.title) {
          setSearchTerm(data.title);
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

  const handleSearch = async () => {
    if (!searchTerm) return;
    setIsSearching(true);
    setError(null);
    setResults(null);
    setDebugData('');

    try {
      const response = await invoke('getLinkingPages', { documentName: searchTerm });
      if (response.success) {
        setResults(response.pages);
        // Zrzut surowych wyników wyszukiwania do podglądu we frontnedzie
        setDebugData(JSON.stringify(response.rawData, null, 2));
      } else {
        setError(response.error);
      }
    } catch (err) {
      console.error("[FRONTEND] Błąd wyszukiwania:", err);
      setError('Błąd połączenia z serwerem podczas wyszukiwania.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDebugSpecificPage = async () => {
    setIsDebugLoading(true);
    setDebugData('');
    setError(null);
    
    // ID strony, którą chciałeś przetestować: 367460768
    const testPageId = "367460768"; 

    try {
      const response = await invoke('debugSpecificPage', { pageId: testPageId });
      if (response.success) {
        setDebugData(JSON.stringify(response.data, null, 2));
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Błąd pobierania danych strony testowej.');
    } finally {
      setIsDebugLoading(false);
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
         <Box paddingBlockStart="space.100" style={{ display: 'flex', gap: '8px' }}>
           <Button onClick={handleSearch} appearance="primary" isLoading={isSearching}>
             Szukaj
           </Button>
           <Button onClick={handleDebugSpecificPage} appearance="subtle" isLoading={isDebugLoading}>
             Pobierz JSON strony testowej (ID: 367460768)
           </Button>
         </Box>
      </Box>

      {error && (
        <Box padding="space.100">
          <Text><Strong>Błąd:</Strong> {error}</Text>
        </Box>
      )}

      {results && results.length > 0 && (
        <Box padding="space.100">
          <Text><Strong>Znaleziono ({results.length}):</Strong></Text>
          {results.map((page) => (
            <Text key={page.id}>
                <Link href={page.url}>{page.title}</Link> ({page.space})
            </Text>
          ))}
        </Box>
      )}

      {results && results.length === 0 && (
        <Box padding="space.100">
          <Text>Brak wyników dla tej nazwy dokumentu.</Text>
        </Box>
      )}

      {/* Kontener na surowe dane w formacie JSON */}
      {debugData && (
        <Box padding="space.100">
          <Text><Strong>Surowe dane z API (Debug):</Strong></Text>
          <TextArea 
            value={debugData} 
            isReadOnly={true} 
            minimumRows={15} 
            resize="auto"
          />
        </Box>
      )}
    </Box>
  );
};

ForgeReconciler.render(<App />);