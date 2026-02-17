// Tests for request handlers
import { jest } from '@jest/globals';
import { handleExecute } from '../src/handlers/execute-handler.js';
import { handleWorkflowTrigger } from '../src/handlers/workflow-trigger-handler.js';
import { AutomationService } from '../src/services/automation-service.js';
import {
  createForgeAdapter,
  createOptimizerAdapter,
  createOrchestratorAdapter,
  createConnectorAdapter,
  createStubForgeClient,
  createStubOptimizerClient,
  createStubOrchestratorClient,
  createStubConnectorHubClient,
} from '../src/adapters/index.js';

function createTestService() {
  return new AutomationService({
    forge: createForgeAdapter(createStubForgeClient()),
    optimizer: createOptimizerAdapter(createStubOptimizerClient()),
    orchestrator: createOrchestratorAdapter(createStubOrchestratorClient()),
    connector: createConnectorAdapter(createStubConnectorHubClient()),
  });
}

describe('handleExecute', () => {
  const deps = { automationService: createTestService() };

  it('should handle valid request', async () => {
    const result = await handleExecute(deps, {
      input: { test: true },
      options: { parentSpanId: 'engine-span-1' },
    });

    expect(result.success).toBe(true);
    expect(result.execution_graph).toBeDefined();
  });

  it('should reject invalid request without input', async () => {
    await expect(handleExecute(deps, {})).rejects.toThrow('input must be an object');
  });

  it('should reject non-object request', async () => {
    await expect(handleExecute(deps, 'invalid')).rejects.toThrow('must be an object');
  });

  it('should reject null request', async () => {
    await expect(handleExecute(deps, null)).rejects.toThrow('must be an object');
  });

  it('should pass through optional fields', async () => {
    const result = await handleExecute(deps, {
      pipelineId: 'test-pipe',
      input: { data: 'value' },
      routingHints: { modelTier: 'quality' },
      options: { parentSpanId: 'engine-span-2' },
    });

    expect(result.success).toBe(true);
    expect(result.metadata.pipelineId).toBe('test-pipe');
    expect(result.execution_graph).toBeDefined();
  });

  it('should reject request missing parentSpanId', async () => {
    await expect(
      handleExecute(deps, { input: { test: true } })
    ).rejects.toThrow('parentSpanId is required');
  });
});

describe('handleWorkflowTrigger', () => {
  const mockFetch = jest.fn(() => Promise.resolve(new Response('ok')));
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockClear();
  });

  const config = {
    orchestratorUrl: 'https://orchestrator.test',
    optimizerUrl: 'https://optimizer.test',
  };

  it('should accept valid trigger and route to both services', () => {
    const result = handleWorkflowTrigger(
      { event: 'deploy', source: 'github' },
      config,
    );

    expect(result.accepted).toBe(true);
    expect(result.routed_to).toEqual(['llm-orchestrator', 'llm-auto-optimizer']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should send correct payload to orchestrator', () => {
    handleWorkflowTrigger(
      { event: 'deploy', source: 'github', extra: 'data' },
      config,
    );

    const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://orchestrator.test/api/v1/workflows/trigger');
    const body = JSON.parse(options.body as string);
    expect(body.event).toBe('deploy');
    expect(body.source).toBe('github');
    expect(body.context).toEqual({ event: 'deploy', source: 'github', extra: 'data' });
    expect(body.timestamp).toBeDefined();
  });

  it('should send correct payload to optimizer', () => {
    handleWorkflowTrigger(
      { event: 'deploy', source: 'github' },
      config,
    );

    const [url, options] = mockFetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe('https://optimizer.test/api/v1/optimize');
    const body = JSON.parse(options.body as string);
    expect(body.event).toBe('deploy');
    expect(body.metrics).toEqual({ event: 'deploy', source: 'github' });
    expect(body.timestamp).toBeDefined();
  });

  it('should reject payload without event', () => {
    expect(() => handleWorkflowTrigger({ source: 'github' }, config))
      .toThrow('event must be a non-empty string');
  });

  it('should reject payload without source', () => {
    expect(() => handleWorkflowTrigger({ event: 'deploy' }, config))
      .toThrow('source must be a non-empty string');
  });

  it('should reject non-object payload', () => {
    expect(() => handleWorkflowTrigger('bad', config))
      .toThrow('must be an object');
  });

  it('should reject null payload', () => {
    expect(() => handleWorkflowTrigger(null, config))
      .toThrow('must be an object');
  });
});
