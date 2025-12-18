// Core types for LLM-Automation-Core Layer-3 integration bundle
// These types define the contract between integrated systems

/** Automation request accepted by the core */
export interface AutomationRequest {
  pipelineId?: string;
  workflowId?: string;
  input: Record<string, unknown>;
  routingHints?: RoutingHints;
  options?: ExecutionOptions;
}

/** Hints for model routing decisions */
export interface RoutingHints {
  preferredProvider?: string;
  modelTier?: 'fast' | 'balanced' | 'quality';
  maxLatencyMs?: number;
  costBudget?: number;
}

/** Execution options passed through to orchestrator */
export interface ExecutionOptions {
  timeout?: number;
  retryPolicy?: string;
  traceId?: string;
}

/** Structured result from automation execution */
export interface AutomationResult {
  success: boolean;
  output: unknown;
  metadata: ExecutionMetadata;
}

/** Metadata about execution for observability */
export interface ExecutionMetadata {
  pipelineId: string;
  workflowId?: string;
  providerId: string;
  modelId: string;
  durationMs: number;
  optimizationApplied?: string;
}

/** Pipeline definition from LLM-Forge */
export interface PipelineDefinition {
  id: string;
  steps: PipelineStep[];
  defaultProvider?: string;
}

export interface PipelineStep {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

/** Optimization signal from LLM-Auto-Optimizer */
export interface OptimizationSignal {
  recommendedProvider?: string;
  recommendedModel?: string;
  pipelineOverrides?: Record<string, unknown>;
  reason?: string;
}

/** Provider adapter interface from LLM-Connector-Hub */
export interface ProviderAdapter {
  id: string;
  execute(request: unknown): Promise<unknown>;
  isAvailable(): Promise<boolean>;
}

/** Workflow execution context from LLM-Orchestrator */
export interface WorkflowContext {
  workflowId: string;
  state: Record<string, unknown>;
  execute(step: PipelineStep, provider: ProviderAdapter): Promise<unknown>;
}
