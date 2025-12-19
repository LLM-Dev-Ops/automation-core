// HTTP server entry point for Cloud Run deployment

import { createServer } from 'node:http';
import { createAutomationCore } from './lib.js';
import { handleExecute } from './handlers/index.js';

const port = parseInt(process.env.PORT || '8080', 10);
const automationService = createAutomationCore();

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
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

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`automation-core listening on port ${port}`);
});
