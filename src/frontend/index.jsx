import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Spinner, Text, Link } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const runAutomaticSearch = async () => {
      try {
        // 1. Retrieve detected code and default target folder
        const initData = await invoke('getInitialData');
        
        if (initData.success && initData.detectedTerm) {
          // 2. Automatically invoke search in the background
          const response = await invoke('getLinkingPages', {
            documentName: initData.detectedTerm,
            targetFolder: initData.defaultTargetFolder
          });

          if (response.success) {
            setResults(response.pages);
          } else {
            setError(response.error);
          }
        } else if (!initData.success) {
          setError(initData.error);
        }
      } catch (err) {
        setError('Failed to communicate with backend service.');
      } finally {
        setIsLoading(false);
      }
    };

    runAutomaticSearch();
  }, []);

  if (isLoading) {
    return (
      <Box padding="space.050">
        <Spinner size="small" label="Loading related pages..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="space.050">
        <Text>Error: {error}</Text>
      </Box>
    );
  }

  if (!results || results.length === 0) {
    return (
      <Box padding="space.050">
        <Text>No related documents found.</Text>
      </Box>
    );
  }

  return (
    <Box padding="space.050">
      {results.map((page) => (
        <Text key={page.id}>
          • <Link href={page.url}>{page.title}</Link>
        </Text>
      ))}
    </Box>
  );
};

ForgeReconciler.render(<App />);