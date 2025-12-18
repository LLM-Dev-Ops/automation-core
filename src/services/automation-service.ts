// Core automation service - the main glue logic for LLM-Automation-Core
// Coordinates between LLM-Forge, LLM-Auto-Optimizer, LLM-Orchestrator, and LLM-Connector-Hub

import type { AutomationRequest, AutomationResult, ExecutionMetadata } from '../types.js';
import type { ForgeAdapter } from '../adapters/forge-adapter.js';
import type { OptimizerAdapter } from '../adapters/optimizer-adapter.js';
import type { OrchestratorAdapter } from '../adapters/orchestrator-adapter.js';
import type { ConnectorAdapter } from '../adapters/connector-adapter.js';

export interface AutomationServiceDeps {
  forge: ForgeAdapter;
  optimizer: OptimizerAdapter;
  orchestrator: OrchestratorAdapter;
  connector: ConnectorAdapter;
}

/** Main automation service - thin glue coordinating integrated systems */
export class AutomationService {
  constructor(private deps: AutomationServiceDeps) {}

  async execute(request: AutomationRequest): Promise<AutomationResult> {
    const startTime = Date.now();

    // 1. Resolve pipeline definition via LLM-Forge
    const pipeline = await this.deps.forge.resolvePipeline(request.pipelineId);

    // 2. Get optimization signal from LLM-Auto-Optimizer
    const signal = await this.deps.optimizer.getSignal(pipeline, request.routingHints);

    // 3. Resolve provider via LLM-Connector-Hub using optimization signal
    const provider = await this.deps.connector.resolveProvider(signal);

    // 4. Execute workflow through LLM-Orchestrator
    const { workflowId, output } = await this.deps.orchestrator.execute(
      pipeline,
      provider,
      request.input
    );

    const metadata: ExecutionMetadata = {
      pipelineId: pipeline.id,
      workflowId,
      providerId: provider.id,
      modelId: signal.recommendedModel ?? 'default',
      durationMs: Date.now() - startTime,
      optimizationApplied: signal.reason,
    };

    return { success: true, output, metadata };
  }
}
