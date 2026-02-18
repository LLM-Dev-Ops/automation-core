// Tests for request handlers
import { jest } from '@jest/globals';
import { handleExecute } from '../src/handlers/execute-handler.js';
import { handleWorkflowTrigger } from '../src/handlers/workflow-trigger-handler.js';
import { handleOrchestrationEvent } from '../src/handlers/orchestration-event-handler.js';
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

describe('handleOrchestrationEvent', () => {
  const mockFetch = jest.fn(() => Promise.resolve(new Response('ok')));
  beforeEach(() => {
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockClear();
  });

  const validEvent = {
    source: 'simulation-planner',
    event_type: 'execution.completed',
    execution_id: 'exec-123',
    timestamp: '2026-01-01T00:00:00Z',
    payload: { result: 'success' },
  };

  it('should accept valid event and return 202 shape', () => {
    const result = handleOrchestrationEvent(validEvent);

    expect(result.status).toBe('accepted');
    expect(result.execution_id).toBe('exec-123');
  });

  it('should fan out to all 4 Layer 1 services', () => {
    handleOrchestrationEvent(validEvent);

    expect(mockFetch).toHaveBeenCalledTimes(4);
    const urls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(urls).toContain('https://llm-forge-1062287243982.us-central1.run.app/api/v1/events');
    expect(urls).toContain('https://llm-auto-optimizer-1062287243982.us-central1.run.app/api/v1/optimize');
    expect(urls).toContain('https://llm-orchestrator-1062287243982.us-central1.run.app/api/v1/events');
    expect(urls).toContain('https://llm-connector-hub-1062287243982.us-central1.run.app/api/v1/events');
  });

  it('should send the full event as body to each target', () => {
    handleOrchestrationEvent(validEvent);

    const bodies = mockFetch.mock.calls.map((c: unknown[]) => {
      const opts = c[1] as RequestInit;
      return JSON.parse(opts.body as string);
    });
    for (const body of bodies) {
      expect(body.source).toBe('simulation-planner');
      expect(body.event_type).toBe('execution.completed');
      expect(body.execution_id).toBe('exec-123');
      expect(body.payload).toEqual({ result: 'success' });
    }
  });

  it('should reject payload missing source', () => {
    expect(() => handleOrchestrationEvent({ ...validEvent, source: '' }))
      .toThrow('source must be a non-empty string');
  });

  it('should reject payload missing event_type', () => {
    expect(() => handleOrchestrationEvent({ ...validEvent, event_type: '' }))
      .toThrow('event_type must be a non-empty string');
  });

  it('should reject payload missing execution_id', () => {
    expect(() => handleOrchestrationEvent({ ...validEvent, execution_id: '' }))
      .toThrow('execution_id must be a non-empty string');
  });

  it('should reject non-object payload', () => {
    expect(() => handleOrchestrationEvent('bad')).toThrow('must be an object');
  });

  it('should reject null payload', () => {
    expect(() => handleOrchestrationEvent(null)).toThrow('must be an object');
  });
});
