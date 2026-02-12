// Adapter for LLM-Auto-Optimizer (9) - Feedback-driven optimization signals
// This adapter delegates to LLM-Auto-Optimizer for routing recommendations

import type {
  OptimizationSignal, RoutingHints, PipelineDefinition,
  InstrumentedResult, SpanArtifact,
} from '../types.js';
import { createSpan, completeSpan } from '../execution/spans.js';

/** Interface matching LLM-Auto-Optimizer's exported API */
export interface OptimizerClient {
  getOptimizationSignal(
    pipelineId: string,
    hints?: RoutingHints
  ): Promise<OptimizationSignal>;
}

/** Creates an optimizer adapter - client is REQUIRED (mandate 5) */
export function createOptimizerAdapter(client: OptimizerClient): OptimizerAdapter {
  return new OptimizerAdapter(client);
}

class OptimizerAdapter {
  constructor(private client: OptimizerClient) {}

  async getSignal(
    pipeline: PipelineDefinition,
    hints: RoutingHints | undefined,
    parentSpanId: string
  ): Promise<InstrumentedResult<OptimizationSignal>> {
    const repoSpan = createSpan({
      type: 'repo',
      name: 'llm-auto-optimizer',
      repo_name: 'llm-auto-optimizer',
      parent_span_id: parentSpanId,
    });

    const agentSpan = createSpan({
      type: 'agent',
      name: 'optimization-signal-agent',
      parent_span_id: repoSpan.span_id,
    });

    let signal: OptimizationSignal;
    try {
      signal = await this.client.getOptimizationSignal(pipeline.id, hints);
    } catch (error) {
      const spans = [
        completeSpan(repoSpan, { status: 'failed' }),
        completeSpan(agentSpan, { status: 'failed' }),
      ];
      throw Object.assign(error as Error, { spans });
    }

    const artifacts: SpanArtifact[] = [];
    if (signal.recommendedProvider) {
      artifacts.push({
        id: `opt-provider-${signal.recommendedProvider}`,
        type: 'optimization-recommendation',
        reference: signal.recommendedProvider,
      });
    }

    const spans = [
      completeSpan(repoSpan),
      completeSpan(agentSpan, {
        artifacts: artifacts.length > 0 ? artifacts : undefined,
      }),
    ];

    return { result: signal, spans };
  }
}

/** Stub client for testing and development only */
export function createStubOptimizerClient(): OptimizerClient {
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
