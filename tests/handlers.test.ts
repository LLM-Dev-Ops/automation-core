// Tests for request handlers
import { handleExecute } from '../src/handlers/execute-handler.js';
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
