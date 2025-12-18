// Adapter for LLM-Orchestrator (11) - Workflow and multi-model pipeline execution
// This adapter delegates to LLM-Orchestrator for workflow execution

import type { PipelineDefinition, ProviderAdapter, WorkflowContext } from '../types.js';

/** Stub interface matching LLM-Orchestrator's exported API */
interface OrchestratorClient {
  createWorkflow(pipelineId: string): Promise<WorkflowContext>;
  executeWorkflow(
    context: WorkflowContext,
    pipeline: PipelineDefinition,
    provider: ProviderAdapter,
    input: Record<string, unknown>
  ): Promise<unknown>;
}

/** Creates an orchestrator adapter - in production, inject the real client */
export function createOrchestratorAdapter(client?: OrchestratorClient): OrchestratorAdapter {
  return new OrchestratorAdapter(client ?? createSimulatorClient());
}

class OrchestratorAdapter {
  constructor(private client: OrchestratorClient) {}

  async execute(
    pipeline: PipelineDefinition,
    provider: ProviderAdapter,
    input: Record<string, unknown>
  ): Promise<{ workflowId: string; output: unknown }> {
    const context = await this.client.createWorkflow(pipeline.id);
    const output = await this.client.executeWorkflow(context, pipeline, provider, input);
    return { workflowId: context.workflowId, output };
  }
}

/** Simulator-compatible stub client */
function createSimulatorClient(): OrchestratorClient {
  return {
    async createWorkflow(pipelineId: string) {
      return {
        workflowId: `wf-${pipelineId}-${Date.now()}`,
        state: {},
        async execute() { return {}; },
      };
    },
    async executeWorkflow(_ctx, _pipeline, _provider, input) {
      return { processed: true, input };
    },
  };
}

export type { OrchestratorAdapter };
