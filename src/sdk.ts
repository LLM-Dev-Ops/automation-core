// LLM-Automation-Core SDK
// Programmatic interface for automation integration

import { AutomationService } from './services/index.js';
import type { AutomationRequest, CoreExecutionResult, RoutingHints } from './types.js';

export type { AutomationRequest, CoreExecutionResult, RoutingHints };
export type {
  AutomationResult,
  ExecutionMetadata,
  PipelineDefinition,
  OptimizationSignal,
  ExecutionGraph,
  ExecutionSpan,
  SpanArtifact,
  SpanEvidence,
  InstrumentedResult,
} from './types.js';

/** SDK client for LLM-Automation-Core */
export class AutomationClient {
  private service: AutomationService;

  constructor(service: AutomationService) {
    this.service = service;
  }

  /** Execute an automation request with full execution graph */
  async execute(request: AutomationRequest): Promise<CoreExecutionResult> {
    return this.service.execute(request);
  }

  /** Convenience method for simple execution */
  async run(
    input: Record<string, unknown>,
    options?: { pipelineId?: string; hints?: RoutingHints; parentSpanId?: string }
  ): Promise<CoreExecutionResult> {
    return this.execute({
      input,
      pipelineId: options?.pipelineId,
      routingHints: options?.hints,
      options: { parentSpanId: options?.parentSpanId },
    });
  }
}

/** Create a new automation client - service is required */
export function createClient(service: AutomationService): AutomationClient {
  return new AutomationClient(service);
}

// Default export for convenience
export default AutomationClient;
