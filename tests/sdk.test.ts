// Tests for SDK client
import { AutomationClient, createClient } from '../src/sdk.js';

describe('AutomationClient', () => {
  let client: AutomationClient;

  beforeEach(() => {
    client = createClient();
  });

  it('should execute via SDK', async () => {
    const result = await client.execute({
      input: { message: 'hello' },
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
  });

  it('should provide run convenience method', async () => {
    const result = await client.run(
      { prompt: 'quick test' },
      { hints: { modelTier: 'fast' } }
    );

    expect(result.success).toBe(true);
    expect(result.metadata.modelId).toBe('fast-model');
  });

  it('should work with default constructor', () => {
    const defaultClient = new AutomationClient();
    expect(defaultClient).toBeInstanceOf(AutomationClient);
  });
});
