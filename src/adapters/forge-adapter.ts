// Adapter for LLM-Forge (7) - Pipeline and SDK definitions
// This adapter delegates to LLM-Forge for pipeline resolution

import type { PipelineDefinition, InstrumentedResult, SpanArtifact } from '../types.js';
import { createSpan, completeSpan } from '../execution/spans.js';

/** Interface matching LLM-Forge's exported API */
export interface ForgeClient {
  getPipeline(id: string): Promise<PipelineDefinition | null>;
  getDefaultPipeline(): Promise<PipelineDefinition>;
}

/** Creates a forge adapter - client is REQUIRED (mandate 5) */
export function createForgeAdapter(client: ForgeClient): ForgeAdapter {
  return new ForgeAdapter(client);
}

class ForgeAdapter {
  constructor(private client: ForgeClient) {}

  async resolvePipeline(
    pipelineId: string | undefined,
    parentSpanId: string
  ): Promise<InstrumentedResult<PipelineDefinition>> {
    const repoSpan = createSpan({
      type: 'repo',
      name: 'llm-forge',
      repo_name: 'llm-forge',
      parent_span_id: parentSpanId,
    });

    const agentSpan = createSpan({
      type: 'agent',
      name: 'forge-pipeline-resolver',
      parent_span_id: repoSpan.span_id,
    });

    let pipeline: PipelineDefinition;
    try {
      if (pipelineId) {
        const found = await this.client.getPipeline(pipelineId);
        pipeline = found ?? await this.client.getDefaultPipeline();
      } else {
        pipeline = await this.client.getDefaultPipeline();
      }
    } catch (error) {
      const spans = [
        completeSpan(repoSpan, { status: 'failed' }),
        completeSpan(agentSpan, { status: 'failed' }),
      ];
      throw Object.assign(error as Error, { spans });
    }

    const artifacts: SpanArtifact[] = [{
      id: `pipeline-${pipeline.id}`,
      type: 'pipeline-definition',
      reference: pipeline.id,
    }];

    const spans = [
      completeSpan(repoSpan),
      completeSpan(agentSpan, { artifacts }),
    ];

    return { result: pipeline, spans };
  }
}

/** Stub client for testing and development only */
export function createStubForgeClient(): ForgeClient {
  return {
    async getPipeline(id: string) {
      return { id, steps: [{ id: 'step-1', type: 'llm-call', config: {} }] };
    },
    async getDefaultPipeline() {
      return { id: 'default', steps: [{ id: 'step-1', type: 'llm-call', config: {} }] };
    },
  };
}

export type { ForgeAdapter };
