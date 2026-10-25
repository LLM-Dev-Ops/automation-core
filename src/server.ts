// HTTP server entry point for Cloud Run deployment

import { createServer } from 'node:http';
import { createAutomationCore } from './lib.js';
import {
  createStubForgeClient,
  createStubOptimizerClient,
  createStubOrchestratorClient,
  createStubConnectorHubClient,
} from './adapters/index.js';
import { createHttpHandler } from './http.js';

const port = parseInt(process.env.PORT || '8080', 10);

// In production, inject real downstream repo clients.
// Stub clients are used here for development only.
const automationService = createAutomationCore({
  forge: createStubForgeClient(),
  optimizer: createStubOptimizerClient(),
  orchestrator: createStubOrchestratorClient(),
  connector: createStubConnectorHubClient(),
});

const server = createServer(createHttpHandler(automationService));

server.listen(port, () => {
  console.log(`automation-core listening on port ${port}`);
});
