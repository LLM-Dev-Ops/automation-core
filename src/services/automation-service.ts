// Core automation service - execution coordinator for multi-repo workflows
//
// MANDATES:
// 1. This Core MUST be invoked by agentics-simulation-engine (parentSpanId required)
// 2. For simulation workflows, delegate to: LLM-Orchestrator, LLM-Connector-Hub,
//    LLM-Auto-Optimizer (if enabled)
// 3. Each delegation MUST create a repo-level span, require agent-level spans,
//    fail if spans are missing
// 4. This Core MUST NOT simulate results itself - it coordinates, it does not compute
// 5. Execution without downstream repos is INVALID
// 6. Expose all downstream spans verbatim

import type {
  AutomationRequest, CoreExecutionResult, ExecutionMetadata, ExecutionSpan,
  OptimizationSignal,
} from '../types.js';
import type { ForgeAdapter } from '../adapters/forge-adapter.js';
import type { OptimizerAdapter } from '../adapters/optimizer-adapter.js';
import type { OrchestratorAdapter } from '../adapters/orchestrator-adapter.js';
import type { ConnectorAdapter } from '../adapters/connector-adapter.js';
import { createSpan, completeSpan } from '../execution/spans.js';
import {
  buildExecutionGraph, validateDelegationSpans, validateExecutionGraph,
} from '../execution/graph.js';

export interface AutomationServiceDeps {
  forge: ForgeAdapter;
  optimizer?: OptimizerAdapter;
  orchestrator: OrchestratorAdapter;
  connector: ConnectorAdapter;
}

/** Execution coordinator for multi-repo workflows. Coordinates, does not compute. */
export class AutomationService {
  constructor(private deps: AutomationServiceDeps) {
    // Mandate 5: Execution without downstream repos is INVALID.
    if (!deps.forge) {
      throw new Error(
        'Missing required downstream repo: llm-forge. ' +
        'Execution without downstream repos is invalid.'
      );
    }
    if (!deps.orchestrator) {
      throw new Error(
        'Missing required downstream repo: llm-orchestrator. ' +
        'Execution without downstream repos is invalid.'
      );
    }
    if (!deps.connector) {
      throw new Error(
        'Missing required downstream repo: llm-connector-hub. ' +
        'Execution without downstream repos is invalid.'
      );
    }
  }

  async execute(request: AutomationRequest): Promise<CoreExecutionResult> {
    // Mandate 1: This Core MUST be invoked by agentics-simulation-engine.
    // Require parentSpanId to prove invocation from an instrumented execution context.
    if (!request.options?.parentSpanId) {
      throw new Error(
        'Invocation rejected: options.parentSpanId is required. ' +
        'This core must be invoked by agentics-simulation-engine, not called directly.'
      );
    }

    const startTime = Date.now();
    const allSpans: ExecutionSpan[] = [];
    const parentSpanId = request.options.parentSpanId;

    // Create core-level execution span (linked to simulation engine's span)
    const coreSpan = createSpan({
      type: 'core',
      name: 'automation-core',
      parent_span_id: parentSpanId,
    });
    allSpans.push(coreSpan);

    try {
      // Step 1: Resolve pipeline via LLM-Forge
      const forgeResult = await this.deps.forge.resolvePipeline(
        request.pipelineId,
        coreSpan.span_id
      );
      // Mandate 3: validate delegation produced repo + agent spans
      validateDelegationSpans(forgeResult.spans, 'llm-forge');
      // Mandate 6: expose downstream spans verbatim
      allSpans.push(...forgeResult.spans);
      const pipeline = forgeResult.result;

      // Step 2: Optimization signal from LLM-Auto-Optimizer (mandate 2: if enabled)
      let signal: OptimizationSignal = {};
      if (this.deps.optimizer) {
        const optimizerResult = await this.deps.optimizer.getSignal(
          pipeline,
          request.routingHints,
          coreSpan.span_id
        );
        validateDelegationSpans(optimizerResult.spans, 'llm-auto-optimizer');
        allSpans.push(...optimizerResult.spans);
        signal = optimizerResult.result;
      }

      // Step 3: Resolve provider via LLM-Connector-Hub (mandate 2: required)
      const connectorResult = await this.deps.connector.resolveProvider(
        signal,
        coreSpan.span_id
      );
      validateDelegationSpans(connectorResult.spans, 'llm-connector-hub');
      allSpans.push(...connectorResult.spans);
      const provider = connectorResult.result;

      // Step 4: Execute workflow via LLM-Orchestrator (mandate 2: required)
      const orchestratorResult = await this.deps.orchestrator.execute(
        pipeline,
        provider,
        request.input,
        coreSpan.span_id
      );
      validateDelegationSpans(orchestratorResult.spans, 'llm-orchestrator');
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

      // Collect any spans attached to the error by adapters (verbatim)
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
