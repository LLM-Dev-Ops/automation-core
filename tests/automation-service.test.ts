// Tests for AutomationService core flow
import { createAutomationCore } from '../src/lib.js';
import { AutomationService } from '../src/services/automation-service.js';
import {
  createForgeAdapter,
  createOptimizerAdapter,
  createOrchestratorAdapter,
  createConnectorAdapter,
} from '../src/adapters/index.js';

describe('AutomationService', () => {
  let service: AutomationService;

  beforeEach(() => {
    service = createAutomationCore();
  });

  it('should execute a basic automation request', async () => {
    const result = await service.execute({
      input: { prompt: 'test prompt' },
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
    });

    expect(result.success).toBe(true);
    expect(result.metadata.modelId).toBe('fast-model');
  });

  it('should include optimization reason in metadata', async () => {
    const result = await service.execute({
      input: {},
    });

    expect(result.metadata.optimizationApplied).toBeDefined();
  });

  it('should include execution_graph in result', async () => {
    const result = await service.execute({
      input: { prompt: 'test' },
    });

    expect(result.execution_graph).toBeDefined();
    expect(result.execution_graph.root_span_id).toBeDefined();
    expect(result.execution_graph.spans.length).toBeGreaterThan(0);
  });
});

describe('AutomationService with custom adapters', () => {
  it('should work with injected adapters', async () => {
    const service = new AutomationService({
      forge: createForgeAdapter(),
      optimizer: createOptimizerAdapter(),
      orchestrator: createOrchestratorAdapter(),
      connector: createConnectorAdapter(),
    });

    const result = await service.execute({ input: {} });
    expect(result.success).toBe(true);
    expect(result.execution_graph).toBeDefined();
  });
});
