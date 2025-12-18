// Adapter for LLM-Auto-Optimizer (9) - Feedback-driven optimization signals
// This adapter delegates to LLM-Auto-Optimizer for routing recommendations

import type { OptimizationSignal, RoutingHints, PipelineDefinition } from '../types.js';

/** Stub interface matching LLM-Auto-Optimizer's exported API */
interface OptimizerClient {
  getOptimizationSignal(
    pipelineId: string,
    hints?: RoutingHints
  ): Promise<OptimizationSignal>;
}

/** Creates an optimizer adapter - in production, inject the real client */
export function createOptimizerAdapter(client?: OptimizerClient): OptimizerAdapter {
  return new OptimizerAdapter(client ?? createSimulatorClient());
}

class OptimizerAdapter {
  constructor(private client: OptimizerClient) {}

  async getSignal(
    pipeline: PipelineDefinition,
    hints?: RoutingHints
  ): Promise<OptimizationSignal> {
    return this.client.getOptimizationSignal(pipeline.id, hints);
  }
}

/** Simulator-compatible stub client */
function createSimulatorClient(): OptimizerClient {
  return {
    async getOptimizationSignal(pipelineId: string, hints?: RoutingHints) {
      return {
        recommendedProvider: hints?.preferredProvider ?? 'default-provider',
        recommendedModel: hints?.modelTier === 'fast' ? 'fast-model' : 'balanced-model',
        reason: 'simulator-default',
      };
    },
  };
}

export type { OptimizerAdapter };
