import resolver from './resolvers/index.js';

// Eksportujemy handler, którego szuka środowisko Forge (zgodnie z manifest.yml: handler: index.handler)
export const handler = resolver.getDefinitions();