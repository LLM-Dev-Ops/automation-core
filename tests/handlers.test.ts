// Tests for request handlers
import { handleExecute } from '../src/handlers/execute-handler.js';
import { createAutomationCore } from '../src/lib.js';

describe('handleExecute', () => {
  const deps = { automationService: createAutomationCore() };

  it('should handle valid request', async () => {
    const result = await handleExecute(deps, {
      input: { test: true },
    });

    expect(result.success).toBe(true);
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
    });

    expect(result.success).toBe(true);
    expect(result.metadata.pipelineId).toBe('test-pipe');
  });
});
