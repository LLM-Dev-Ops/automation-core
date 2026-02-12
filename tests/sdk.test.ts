// Tests for SDK client
import { AutomationClient, createClient } from '../src/sdk.js';
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

const ENGINE_SPAN = 'engine-span-sdk-test';

describe('AutomationClient', () => {
  let client: AutomationClient;

  beforeEach(() => {
    client = createClient(createTestService());
  });

  it('should execute via SDK', async () => {
    const result = await client.execute({
      input: { message: 'hello' },
      options: { parentSpanId: ENGINE_SPAN },
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.execution_graph).toBeDefined();
  });

  it('should provide run convenience method', async () => {
    const result = await client.run(
      { prompt: 'quick test' },
      { hints: { modelTier: 'fast' }, parentSpanId: ENGINE_SPAN }
    );

    expect(result.success).toBe(true);
    expect(result.metadata.modelId).toBe('fast-model');
    expect(result.execution_graph).toBeDefined();
  });

  it('should require service in constructor', () => {
    const service = createTestService();
    const sdkClient = new AutomationClient(service);
    expect(sdkClient).toBeInstanceOf(AutomationClient);
  });
});
