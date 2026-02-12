// LLM-Automation-Core - Execution coordinator for multi-repo workflows
// Main library entry point

export * from './types.js';
export * from './adapters/index.js';
export * from './services/index.js';
export * from './handlers/index.js';
export * from './execution/index.js';

import {
  createForgeAdapter,
  createOptimizerAdapter,
  createOrchestratorAdapter,
  createConnectorAdapter,
} from './adapters/index.js';
import type {
  ForgeClient,
  OptimizerClient,
  OrchestratorClient,
  ConnectorHubClient,
} from './adapters/index.js';
import { AutomationService } from './services/index.js';

/** Configuration for creating an automation core from downstream clients */
export interface AutomationCoreConfig {
  forge: ForgeClient;
  optimizer?: OptimizerClient;
  orchestrator: OrchestratorClient;
  connector: ConnectorHubClient;
}

/**
 * Creates a fully-wired AutomationService from downstream repo clients.
 * All required clients must be provided - execution without downstream repos is INVALID.
 */
export function createAutomationCore(config: AutomationCoreConfig): AutomationService {
  return new AutomationService({
    forge: createForgeAdapter(config.forge),
    optimizer: config.optimizer
      ? createOptimizerAdapter(config.optimizer)
      : undefined,
    orchestrator: createOrchestratorAdapter(config.orchestrator),
    connector: createConnectorAdapter(config.connector),
  });
}
