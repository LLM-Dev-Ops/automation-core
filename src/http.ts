import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { AutomationService } from './services/automation-service.js';
import { handleExecute, handleWorkflowTrigger, handleOrchestrationEvent } from './handlers/index.js';

export const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

function sendJson(res: ServerResponse, statusCode: number, value: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const contentType = req.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json');
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_REQUEST_BODY_BYTES) {
      throw new HttpError(413, `Request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Malformed JSON body');
  }
}

export function createHttpHandler(automationService: AutomationService): RequestListener {
  return async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, {
        status: 'healthy',
        service: 'automation-core',
        version: process.env.npm_package_version || 'unknown',
      });
      return;
    }

    const routes: Record<string, {
      statusCode: number;
      handle: (payload: unknown) => unknown | Promise<unknown>;
      failure: (message: string) => unknown;
    }> = {
      '/execute': {
        statusCode: 200,
        handle: (payload) => handleExecute({ automationService }, payload),
        failure: (error) => ({ success: false, error }),
      },
      '/v1/orchestration/event': {
        statusCode: 202,
        handle: handleOrchestrationEvent,
        failure: (error) => ({ status: 'error', error }),
      },
      '/v1/workflow/trigger': {
        statusCode: 202,
        handle: handleWorkflowTrigger,
        failure: (error) => ({ accepted: false, error }),
      },
    };

    const route = req.method === 'POST' && req.url ? routes[req.url] : undefined;
    if (!route) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    try {
      const payload = await readJsonBody(req);
      sendJson(res, route.statusCode, await route.handle(payload));
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 400;
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, statusCode, route.failure(message));
    }
  };
}
