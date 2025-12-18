// Adapter for LLM-Forge (7) - Pipeline and SDK definitions
// This adapter delegates to LLM-Forge for pipeline resolution

import type { PipelineDefinition } from '../types.js';

/** Stub interface matching LLM-Forge's exported API */
interface ForgeClient {
  getPipeline(id: string): Promise<PipelineDefinition | null>;
  getDefaultPipeline(): Promise<PipelineDefinition>;
}

/** Creates a forge adapter - in production, inject the real client */
export function createForgeAdapter(client?: ForgeClient): ForgeAdapter {
  return new ForgeAdapter(client ?? createSimulatorClient());
}

class ForgeAdapter {
  constructor(private client: ForgeClient) {}

  async resolvePipeline(pipelineId?: string): Promise<PipelineDefinition> {
    if (pipelineId) {
      const pipeline = await this.client.getPipeline(pipelineId);
      if (pipeline) return pipeline;
    }
    return this.client.getDefaultPipeline();
  }
}

/** Simulator-compatible stub client */
function createSimulatorClient(): ForgeClient {
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
