// Core automation service - the main glue logic for LLM-Automation-Core
// Coordinates between LLM-Forge, LLM-Auto-Optimizer, LLM-Orchestrator, and LLM-Connector-Hub
// Instrumented for agentics-execution-engine with hierarchical execution spans

import type {
  AutomationRequest, CoreExecutionResult, ExecutionMetadata, ExecutionSpan,
} from '../types.js';
import type { ForgeAdapter } from '../adapters/forge-adapter.js';
import type { OptimizerAdapter } from '../adapters/optimizer-adapter.js';
import type { OrchestratorAdapter } from '../adapters/orchestrator-adapter.js';
import type { ConnectorAdapter } from '../adapters/connector-adapter.js';
import { createSpan, completeSpan } from '../execution/spans.js';
import { buildExecutionGraph, validateExecutionGraph } from '../execution/graph.js';

export interface AutomationServiceDeps {
  forge: ForgeAdapter;
  optimizer: OptimizerAdapter;
  orchestrator: OrchestratorAdapter;
  connector: ConnectorAdapter;
}

/** Main automation service - thin glue coordinating integrated systems */
export class AutomationService {
  constructor(private deps: AutomationServiceDeps) {}

  async execute(request: AutomationRequest): Promise<CoreExecutionResult> {
    const startTime = Date.now();
    const allSpans: ExecutionSpan[] = [];
    const parentSpanId = request.options?.parentSpanId ?? null;

    // 1. Create core-level execution span
    const coreSpan = createSpan({
      type: 'core',
      name: 'automation-core',
      parent_span_id: parentSpanId,
    });
    allSpans.push(coreSpan);

    try {
      // 2. Resolve pipeline definition via LLM-Forge
      const forgeResult = await this.deps.forge.resolvePipeline(
        request.pipelineId,
        coreSpan.span_id
      );
      allSpans.push(...forgeResult.spans);
      const pipeline = forgeResult.result;

      // 3. Get optimization signal from LLM-Auto-Optimizer
      const optimizerResult = await this.deps.optimizer.getSignal(
        pipeline,
        request.routingHints,
        coreSpan.span_id
      );
      allSpans.push(...optimizerResult.spans);
      const signal = optimizerResult.result;

      // 4. Resolve provider via LLM-Connector-Hub
      const connectorResult = await this.deps.connector.resolveProvider(
        signal,
        coreSpan.span_id
      );
      allSpans.push(...connectorResult.spans);
      const provider = connectorResult.result;

      // 5. Execute workflow through LLM-Orchestrator
      const orchestratorResult = await this.deps.orchestrator.execute(
        pipeline,
        provider,
        request.input,
        coreSpan.span_id
      );
      allSpans.push(...orchestratorResult.spans);
      const { workflowId, output } = orchestratorResult.result;

      const metadata: ExecutionMetadata = {
        pipelineId: pipeline.id,
        workflowId,
        providerId: provider.id,
        modelId: signal.recommendedModel ?? 'default',
        durationMs: Date.now() - startTime,
        optimizationApplied: signal.reason,
      };

      // Complete core span
      allSpans[0] = completeSpan(coreSpan);

      // Build and validate execution graph
      const graph = buildExecutionGraph(coreSpan.span_id, allSpans);
      const validation = validateExecutionGraph(graph);

      if (!validation.valid) {
        // Mark core span as failed per enforcement semantics
        allSpans[0] = completeSpan(coreSpan, { status: 'failed' });
        const failedGraph = buildExecutionGraph(coreSpan.span_id, allSpans);
        return {
          success: false,
          output,
          metadata,
          execution_graph: failedGraph,
          failure_reasons: validation.failure_reasons,
        };
      }

      return { success: true, output, metadata, execution_graph: graph };
    } catch (error) {
      // Complete core span as failed
      allSpans[0] = completeSpan(coreSpan, { status: 'failed' });

      // Collect any spans attached to the error by adapters
      const errorSpans = (error as { spans?: ExecutionSpan[] }).spans;
      if (errorSpans) {
        allSpans.push(...errorSpans);
      }

      const graph = buildExecutionGraph(coreSpan.span_id, allSpans);

      const metadata: ExecutionMetadata = {
        pipelineId: request.pipelineId ?? 'unknown',
        providerId: 'unknown',
        modelId: 'unknown',
        durationMs: Date.now() - startTime,
      };

      return {
        success: false,
        output: null,
        metadata,
        execution_graph: graph,
        failure_reasons: [
          (error as Error).message ?? 'Unknown execution error',
        ],
      };
    }
  }
}
