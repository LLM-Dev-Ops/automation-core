// LLM-Automation-Core SDK
// Programmatic interface for automation integration

import { createAutomationCore, AutomationService } from './lib.js';
import type { AutomationRequest, AutomationResult, RoutingHints } from './types.js';

export type { AutomationRequest, AutomationResult, RoutingHints };
export type { ExecutionMetadata, PipelineDefinition, OptimizationSignal } from './types.js';

/** SDK client for LLM-Automation-Core */
export class AutomationClient {
  private service: AutomationService;

  constructor(service?: AutomationService) {
    this.service = service ?? createAutomationCore();
  }

  /** Execute an automation request */
  async execute(request: AutomationRequest): Promise<AutomationResult> {
    return this.service.execute(request);
  }

  /** Convenience method for simple execution */
  async run(
    input: Record<string, unknown>,
    options?: { pipelineId?: string; hints?: RoutingHints }
  ): Promise<AutomationResult> {
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
