// Tests for AutomationService core flow
import { createAutomationCore } from '../src/lib.js';
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

/** Helper: create a test service with all stubs wired */
function createTestService(opts?: { withOptimizer?: boolean }) {
  return new AutomationService({
    forge: createForgeAdapter(createStubForgeClient()),
    optimizer: opts?.withOptimizer !== false
      ? createOptimizerAdapter(createStubOptimizerClient())
      : undefined,
    orchestrator: createOrchestratorAdapter(createStubOrchestratorClient()),
    connector: createConnectorAdapter(createStubConnectorHubClient()),
  });
}

const ENGINE_SPAN = 'engine-span-test';

describe('AutomationService', () => {
  let service: AutomationService;

  beforeEach(() => {
    service = createTestService();
  });

  it('should execute a basic automation request', async () => {
    const result = await service.execute({
      input: { prompt: 'test prompt' },
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.pipelineId).toBeDefined();
    expect(result.metadata.providerId).toBeDefined();
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should use specified pipeline', async () => {
    const result = await service.execute({
      pipelineId: 'custom-pipeline',
      input: { data: 'test' },
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.success).toBe(true);
    expect(result.metadata.pipelineId).toBe('custom-pipeline');
  });

  it('should apply routing hints', async () => {
    const result = await service.execute({
      input: { query: 'fast query' },
      routingHints: {
        modelTier: 'fast',
        preferredProvider: 'fast-provider',
      },
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.success).toBe(true);
    expect(result.metadata.modelId).toBe('fast-model');
  });

  it('should include optimization reason in metadata', async () => {
    const result = await service.execute({
      input: {},
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.metadata.optimizationApplied).toBeDefined();
  });

  it('should include execution_graph in result', async () => {
    const result = await service.execute({
      input: { prompt: 'test' },
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.execution_graph).toBeDefined();
    expect(result.execution_graph.root_span_id).toBeDefined();
    expect(result.execution_graph.spans.length).toBeGreaterThan(0);
  });

  // Mandate 1: parentSpanId required
  it('should reject execution without parentSpanId', async () => {
    await expect(
      service.execute({ input: {} })
    ).rejects.toThrow('parentSpanId is required');
  });

  it('should reject execution with empty options', async () => {
    await expect(
      service.execute({ input: {}, options: {} })
    ).rejects.toThrow('parentSpanId is required');
  });

  // Mandate 2: optimizer is optional
  it('should execute without optimizer (if not enabled)', async () => {
    const noOptService = createTestService({ withOptimizer: false });
    const result = await noOptService.execute({
      input: { prompt: 'no optimizer' },
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.success).toBe(true);
    expect(result.metadata.modelId).toBe('default');
  });
});

describe('AutomationService with custom adapters', () => {
  it('should work with injected adapters', async () => {
    const service = new AutomationService({
      forge: createForgeAdapter(createStubForgeClient()),
      optimizer: createOptimizerAdapter(createStubOptimizerClient()),
      orchestrator: createOrchestratorAdapter(createStubOrchestratorClient()),
      connector: createConnectorAdapter(createStubConnectorHubClient()),
    });

    const result = await service.execute({
      input: {},
      options: { parentSpanId: ENGINE_SPAN },
    });
    expect(result.success).toBe(true);
    expect(result.execution_graph).toBeDefined();
  });
});

// Mandate 5: Execution without downstream repos is INVALID
describe('AutomationService dependency validation', () => {
  it('should reject missing orchestrator', () => {
    expect(() => new AutomationService({
      forge: createForgeAdapter(createStubForgeClient()),
      orchestrator: undefined as any,
      connector: createConnectorAdapter(createStubConnectorHubClient()),
    })).toThrow('Missing required downstream repo: llm-orchestrator');
  });

  it('should reject missing connector', () => {
    expect(() => new AutomationService({
      forge: createForgeAdapter(createStubForgeClient()),
      orchestrator: createOrchestratorAdapter(createStubOrchestratorClient()),
      connector: undefined as any,
    })).toThrow('Missing required downstream repo: llm-connector-hub');
  });

  it('should reject missing forge', () => {
    expect(() => new AutomationService({
      forge: undefined as any,
      orchestrator: createOrchestratorAdapter(createStubOrchestratorClient()),
      connector: createConnectorAdapter(createStubConnectorHubClient()),
    })).toThrow('Missing required downstream repo: llm-forge');
  });
});
