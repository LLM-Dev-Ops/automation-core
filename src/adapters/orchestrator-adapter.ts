// Adapter for LLM-Orchestrator (11) - Workflow and multi-model pipeline execution
// This adapter delegates to LLM-Orchestrator for workflow execution

import type {
  PipelineDefinition, ProviderAdapter, WorkflowContext,
  InstrumentedResult, SpanArtifact, SpanEvidence,
} from '../types.js';
import { createSpan, completeSpan } from '../execution/spans.js';

/** Interface matching LLM-Orchestrator's exported API */
export interface OrchestratorClient {
  createWorkflow(pipelineId: string): Promise<WorkflowContext>;
  executeWorkflow(
    context: WorkflowContext,
    pipeline: PipelineDefinition,
    provider: ProviderAdapter,
    input: Record<string, unknown>
  ): Promise<unknown>;
}

/** Creates an orchestrator adapter - client is REQUIRED (mandate 5) */
export function createOrchestratorAdapter(client: OrchestratorClient): OrchestratorAdapter {
  return new OrchestratorAdapter(client);
}

class OrchestratorAdapter {
  constructor(private client: OrchestratorClient) {}

  async execute(
    pipeline: PipelineDefinition,
    provider: ProviderAdapter,
    input: Record<string, unknown>,
    parentSpanId: string
  ): Promise<InstrumentedResult<{ workflowId: string; output: unknown }>> {
    const repoSpan = createSpan({
      type: 'repo',
      name: 'llm-orchestrator',
      repo_name: 'llm-orchestrator',
      parent_span_id: parentSpanId,
    });

    const agentSpan = createSpan({
      type: 'agent',
      name: 'workflow-executor-agent',
      parent_span_id: repoSpan.span_id,
    });

    let workflowId: string;
    let output: unknown;
    try {
      const context = await this.client.createWorkflow(pipeline.id);
      output = await this.client.executeWorkflow(context, pipeline, provider, input);
      workflowId = context.workflowId;
    } catch (error) {
      const spans = [
        completeSpan(repoSpan, { status: 'failed' }),
        completeSpan(agentSpan, { status: 'failed' }),
      ];
      throw Object.assign(error as Error, { spans });
    }

    const artifacts: SpanArtifact[] = [{
      id: `workflow-${workflowId}`,
      type: 'workflow-execution',
      reference: workflowId,
    }];

    const evidence: SpanEvidence[] = [{
      id: `wf-result-${workflowId}`,
      type: 'workflow-completion',
      uri: `workflow://${workflowId}`,
    }];

    const spans = [
      completeSpan(repoSpan),
      completeSpan(agentSpan, { artifacts, evidence }),
    ];

    return { result: { workflowId, output }, spans };
  }
}

/** Stub client for testing and development only */
export function createStubOrchestratorClient(): OrchestratorClient {
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
