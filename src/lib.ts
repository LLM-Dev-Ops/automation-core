// LLM-Automation-Core - Phase-8 Layer-3 Integration Bundle
// Main library entry point

export * from './types.js';
export * from './adapters/index.js';
export * from './services/index.js';
export * from './handlers/index.js';

import {
  createForgeAdapter,
  createOptimizerAdapter,
  createOrchestratorAdapter,
  createConnectorAdapter,
} from './adapters/index.js';
import { AutomationService } from './services/index.js';

/** Creates a fully-wired AutomationService with simulator-compatible defaults */
export function createAutomationCore(): AutomationService {
  return new AutomationService({
    forge: createForgeAdapter(),
    optimizer: createOptimizerAdapter(),
    orchestrator: createOrchestratorAdapter(),
    connector: createConnectorAdapter(),
  });
}
