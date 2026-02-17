// Handler for workflow trigger events
// Routes trigger payloads to downstream services (non-blocking)

/** Configuration for downstream routing targets */
export interface WorkflowTriggerConfig {
  orchestratorUrl: string;
  optimizerUrl: string;
}

/** Incoming trigger payload */
export interface WorkflowTriggerPayload {
  event: string;
  source: string;
  [key: string]: unknown;
}

/** Response returned to caller */
export interface WorkflowTriggerResponse {
  accepted: boolean;
  routed_to: string[];
}

const DEFAULT_CONFIG: WorkflowTriggerConfig = {
  orchestratorUrl: process.env.LLM_ORCHESTRATOR_URL
    || 'https://llm-orchestrator-1062287243982.us-central1.run.app',
  optimizerUrl: process.env.LLM_AUTO_OPTIMIZER_URL
    || 'https://llm-auto-optimizer-1062287243982.us-central1.run.app',
};

/** Validates the trigger payload has required fields */
function validateTriggerPayload(body: unknown): WorkflowTriggerPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.event !== 'string' || !payload.event) {
    throw new Error('Invalid payload: event must be a non-empty string');
  }
  if (typeof payload.source !== 'string' || !payload.source) {
    throw new Error('Invalid payload: source must be a non-empty string');
  }
  return payload as WorkflowTriggerPayload;
}

/** Fire-and-forget POST to a downstream service */
function fireAndForget(url: string, body: unknown): void {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // Non-blocking: swallow errors from downstream routing
  });
}

/** Handles POST /v1/workflow/trigger — routes events to downstream services */
export function handleWorkflowTrigger(
  payload: unknown,
  config: WorkflowTriggerConfig = DEFAULT_CONFIG,
): WorkflowTriggerResponse {
  const validated = validateTriggerPayload(payload);
  const now = new Date().toISOString();

  const routed_to: string[] = [];

  // Route to llm-orchestrator
  fireAndForget(`${config.orchestratorUrl}/api/v1/workflows/trigger`, {
    event: validated.event,
    source: validated.source,
    context: validated,
    timestamp: now,
  });
  routed_to.push('llm-orchestrator');

  // Route to llm-auto-optimizer
  fireAndForget(`${config.optimizerUrl}/api/v1/optimize`, {
    event: validated.event,
    metrics: validated,
    timestamp: now,
  });
  routed_to.push('llm-auto-optimizer');

  return { accepted: true, routed_to };
}
