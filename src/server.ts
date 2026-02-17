// HTTP server entry point for Cloud Run deployment

import { createServer } from 'node:http';
import { createAutomationCore } from './lib.js';
import {
  createStubForgeClient,
  createStubOptimizerClient,
  createStubOrchestratorClient,
  createStubConnectorHubClient,
} from './adapters/index.js';
import { handleExecute, handleWorkflowTrigger } from './handlers/index.js';

const port = parseInt(process.env.PORT || '8080', 10);

// In production, inject real downstream repo clients.
// Stub clients are used here for development only.
const automationService = createAutomationCore({
  forge: createStubForgeClient(),
  optimizer: createStubOptimizerClient(),
  orchestrator: createStubOrchestratorClient(),
  connector: createStubConnectorHubClient(),
});

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'automation-core',
      version: process.env.npm_package_version || 'unknown'
    }));
    return;
  }

  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const request = JSON.parse(body);
      const result = await handleExecute({ automationService }, request);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/workflow/trigger') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const payload = JSON.parse(body);
      const result = handleWorkflowTrigger(payload);
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accepted: false, error: message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`automation-core listening on port ${port}`);
});
