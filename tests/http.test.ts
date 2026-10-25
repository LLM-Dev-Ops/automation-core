import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { jest } from '@jest/globals';
import { createHttpHandler, MAX_REQUEST_BODY_BYTES } from '../src/http.js';
import type { AutomationService } from '../src/services/automation-service.js';

describe('HTTP boundary', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const service = { execute: jest.fn() } as unknown as AutomationService;
    server = createServer(createHttpHandler(service));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  test('preserves the health endpoint', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'healthy', service: 'automation-core' });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('rejects request bodies larger than one MiB', async () => {
    const response = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input: { value: 'x'.repeat(MAX_REQUEST_BODY_BYTES) } }),
    });
    expect(response.status).toBe(413);
  });

  test('rejects non-JSON media types', async () => {
    const response = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(response.status).toBe(415);
  });

  test('accepts JSON media types with parameters', async () => {
    const response = await fetch(`${baseUrl}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Malformed JSON body' });
  });
});
