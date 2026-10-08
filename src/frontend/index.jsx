import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Textfield, Button, Box, Spinner, Text, Strong, Link } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [targetFolder, setTargetFolder] = useState('Kits');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [initError, setInitError] = useState(null);

  // Funkcja wywołująca wyszukiwanie
  const executeSearch = async (term, folder) => {
    if (!term) return;
    setIsSearching(true);
    setError(null);
    setResults(null);

    try {
      const response = await invoke('getLinkingPages', { 
        documentName: term, 
        targetFolder: folder 
      });

      if (response.success) {
        setResults(response.pages);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Błąd połączenia z serwerem podczas wyszukiwania.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await invoke('getInitialData');
        if (data.success) {
          const term = data.detectedTerm || '';
          const folder = data.defaultTargetFolder || 'Kits';

          setSearchTerm(term);
          setTargetFolder(folder);

          // Automatyczne wyszukanie powiązań od razu po wejściu na stronę
          if (term) {
            executeSearch(term, folder);
          }
        } else {
          setInitError(data.error);
        }
      } catch (err) {
        setInitError("Nie udało się połączyć z backendem.");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleManualSearch = () => {
    // Dynamicznie dostosowujemy folder, jeśli użytkownik zmienił wpisany kod
    const autoFolder = searchTerm.trim().toUpperCase().startsWith('MBE') ? 'Elements' : 'Kits';
    setTargetFolder(autoFolder);
    executeSearch(searchTerm, autoFolder);
  };

  if (isLoading) {
    return (
      <Box padding="space.100">
        <Spinner size="large" />
        <Text>Wczytywanie kontekstu strony...</Text>
      </Box>
    );
  }

  return (
    <Box padding="space.100">
      {initError && (
        <Box paddingBlockEnd="space.100">
          <Text><Strong>Błąd startowy:</Strong> {initError}</Text>
        </Box>
      )}

      <Text><Strong>Powiązane dokumenty</Strong></Text>
      <Text>Szukany kod (cel: folder <Strong>{targetFolder}</Strong>):</Text>

      <Box paddingBlockStart="space.050">
        <Textfield
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          isDisabled={isSearching}
          placeholder="np. ELE-036 lub MBE-002..."
        />
      </Box>

      <Box paddingBlockStart="space.100">
        <Button onClick={handleManualSearch} appearance="primary" isLoading={isSearching}>
          Szukaj
        </Button>
      </Box>

      {error && (
        <Box paddingBlockStart="space.100">
          <Text><Strong>Błąd:</Strong> {error}</Text>
        </Box>
      )}

      {results && results.length > 0 && (
        <Box paddingBlockStart="space.150">
          <Text><Strong>Znalezione powiązania ({results.length}):</Strong></Text>
          {results.map((page) => (
            <Text key={page.id}>
              • <Link href={page.url}>{page.title}</Link>
            </Text>
          ))}
        </Box>
      )}

      {results && results.length === 0 && (
        <Box paddingBlockStart="space.100">
          <Text>Brak powiązanych stron w folderze {targetFolder}.</Text>
        </Box>
      )}
    </Box>
  );
};

ForgeReconciler.render(<App />);