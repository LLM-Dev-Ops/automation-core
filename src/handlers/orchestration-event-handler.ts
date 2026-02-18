// Handler for orchestration events from Layer 4 services
// Fans out events to Layer 1 services using non-blocking Promise.allSettled

/** Incoming orchestration event payload */
export interface OrchestrationEvent {
  source: string;
  event_type: string;
  execution_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

/** Response returned to caller */
export interface OrchestrationEventResponse {
  status: 'accepted';
  execution_id: string;
}

/** Resolve Layer 1 fanout targets from env vars with hardcoded defaults */
function getLayer1Targets() {
  const forgeBase = process.env.FORGE_ENDPOINT
    || 'https://llm-forge-1062287243982.us-central1.run.app';
  const optimizerBase = process.env.LLM_AUTO_OPTIMIZER_URL
    || 'https://llm-auto-optimizer-1062287243982.us-central1.run.app';
  const orchestratorBase = process.env.LLM_ORCHESTRATOR_URL
    || 'https://llm-orchestrator-1062287243982.us-central1.run.app';
  const connectorBase = process.env.CONNECTOR_HUB_ENDPOINT
    || 'https://llm-connector-hub-1062287243982.us-central1.run.app';

  return [
    { name: 'llm-forge', url: `${forgeBase}/api/v1/events` },
    { name: 'llm-auto-optimizer', url: `${optimizerBase}/api/v1/optimize` },
    { name: 'llm-orchestrator', url: `${orchestratorBase}/api/v1/events` },
    { name: 'llm-connector-hub', url: `${connectorBase}/api/v1/events` },
  ];
}

/** Validates the orchestration event payload */
function validateOrchestrationEvent(body: unknown): OrchestrationEvent {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid payload: must be an object');
  }
  const event = body as Record<string, unknown>;
  if (typeof event.source !== 'string' || !event.source) {
    throw new Error('Invalid payload: source must be a non-empty string');
  }
  if (typeof event.event_type !== 'string' || !event.event_type) {
    throw new Error('Invalid payload: event_type must be a non-empty string');
  }
  if (typeof event.execution_id !== 'string' || !event.execution_id) {
    throw new Error('Invalid payload: execution_id must be a non-empty string');
  }
  if (typeof event.timestamp !== 'string' || !event.timestamp) {
    throw new Error('Invalid payload: timestamp must be a non-empty string');
  }
  if (!event.payload || typeof event.payload !== 'object') {
    throw new Error('Invalid payload: payload must be an object');
  }
  return event as unknown as OrchestrationEvent;
}

/** Handles POST /v1/orchestration/event — fans out to Layer 1 services */
export function handleOrchestrationEvent(body: unknown): OrchestrationEventResponse {
  const event = validateOrchestrationEvent(body);

  console.log(`[orchestration-event] source=${event.source} execution_id=${event.execution_id} event_type=${event.event_type}`);

  // Non-blocking fanout to Layer 1 services
  const targets = getLayer1Targets();
  Promise.allSettled(
    targets.map(target =>
      fetch(target.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
    )
  ).then(results => {
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.warn(`[orchestration-event] fanout failed for ${targets[i].name}: ${result.reason}`);
      } else if (!result.value.ok) {
        console.warn(`[orchestration-event] fanout non-OK for ${targets[i].name}: ${result.value.status}`);
      }
    });
  });

  return { status: 'accepted', execution_id: event.execution_id };
}
