// Handler for automation execution requests
// Validates input and delegates to AutomationService

import type { AutomationRequest, AutomationResult } from '../types.js';
import type { AutomationService } from '../services/automation-service.js';

export interface ExecuteHandlerDeps {
  automationService: AutomationService;
}

/** Request handler for execute operations */
export async function handleExecute(
  deps: ExecuteHandlerDeps,
  request: unknown
): Promise<AutomationResult> {
  const validated = validateRequest(request);
  return deps.automationService.execute(validated);
}

function validateRequest(request: unknown): AutomationRequest {
  if (!request || typeof request !== 'object') {
    throw new Error('Invalid request: must be an object');
  }
  const req = request as Record<string, unknown>;
  if (!req.input || typeof req.input !== 'object') {
    throw new Error('Invalid request: input must be an object');
  }
  return {
    pipelineId: typeof req.pipelineId === 'string' ? req.pipelineId : undefined,
    workflowId: typeof req.workflowId === 'string' ? req.workflowId : undefined,
    input: req.input as Record<string, unknown>,
    routingHints: req.routingHints as AutomationRequest['routingHints'],
    options: req.options as AutomationRequest['options'],
  };
}
