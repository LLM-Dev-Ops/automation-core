// LLM-Automation-Core SDK
// Programmatic interface for automation integration

import { createAutomationCore, AutomationService } from './lib.js';
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

  constructor(service?: AutomationService) {
    this.service = service ?? createAutomationCore();
  }

  /** Execute an automation request with full execution graph */
  async execute(request: AutomationRequest): Promise<CoreExecutionResult> {
    return this.service.execute(request);
  }

  /** Convenience method for simple execution */
  async run(
    input: Record<string, unknown>,
    options?: { pipelineId?: string; hints?: RoutingHints }
  ): Promise<CoreExecutionResult> {
    return this.execute({
      input,
      pipelineId: options?.pipelineId,
      routingHints: options?.hints,
    });
  }
}

/** Create a new automation client */
export function createClient(service?: AutomationService): AutomationClient {
  return new AutomationClient(service);
}

// Default export for convenience
export default AutomationClient;
