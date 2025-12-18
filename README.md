# LLM-Automation-Core

Phase-8 Layer-3 integration bundle for LLM automation and workflow coordination.

## Overview

LLM-Automation-Core is a thin coordination layer that orchestrates interactions between multiple LLM infrastructure components. It provides a unified interface for executing automation pipelines while delegating all core functionality to upstream services.

### Integrated Systems

| System | Purpose |
|--------|---------|
| **LLM-Forge** | Pipeline and SDK definitions |
| **LLM-Auto-Optimizer** | Feedback-driven optimization signals |
| **LLM-Orchestrator** | Workflow and multi-model pipeline execution |
| **LLM-Connector-Hub** | Standardized provider adapters |

## Installation

```bash
npm install llm-automation-core
```

### Peer Dependencies

The following packages are optional peer dependencies that enable full functionality:

```bash
npm install llm-forge llm-auto-optimizer llm-orchestrator llm-connector-hub
```

## Usage

### SDK

```typescript
import { createClient } from 'llm-automation-core/sdk';

const client = createClient();

// Simple execution
const result = await client.run(
  { prompt: 'Hello, world!' },
  { hints: { modelTier: 'fast' } }
);

// Full request
const result = await client.execute({
  pipelineId: 'my-pipeline',
  input: { prompt: 'Process this' },
  routingHints: {
    preferredProvider: 'openai',
    modelTier: 'quality',
    maxLatencyMs: 5000,
  },
});

console.log(result.output);
console.log(result.metadata);
```

### Library

```typescript
import { createAutomationCore } from 'llm-automation-core';

const core = createAutomationCore();

const result = await core.execute({
  pipelineId: 'analysis-pipeline',
  input: { data: 'content to analyze' },
  routingHints: { modelTier: 'balanced' },
});
```

### CLI

```bash
# Execute with default pipeline
llm-automation execute --input '{"prompt":"Hello"}'

# Execute with specific pipeline and provider
llm-automation execute \
  --pipeline my-pipeline \
  --input '{"prompt":"Process this"}' \
  --provider openai \
  --tier quality

# Show help
llm-automation help
```

## Architecture

LLM-Automation-Core follows a strict Layer-3 architecture pattern:

```
┌─────────────────────────────────────────────────────────┐
│                    AutomationService                     │
│              (Coordination & Orchestration)              │
├─────────────┬─────────────┬──────────────┬──────────────┤
│ ForgeAdapter│OptimizerAdpt│OrchestratorAd│ConnectorAdapt│
├─────────────┼─────────────┼──────────────┼──────────────┤
│  LLM-Forge  │ LLM-Auto-   │    LLM-      │LLM-Connector-│
│             │ Optimizer   │ Orchestrator │     Hub      │
└─────────────┴─────────────┴──────────────┴──────────────┘
```

### Execution Flow

1. **Pipeline Resolution** - ForgeAdapter retrieves pipeline definition from LLM-Forge
2. **Optimization** - OptimizerAdapter obtains routing signals from LLM-Auto-Optimizer
3. **Provider Selection** - ConnectorAdapter resolves the optimal provider via LLM-Connector-Hub
4. **Execution** - OrchestratorAdapter executes the workflow through LLM-Orchestrator

### Design Principles

- **Coordination Only** - No core business logic; all functionality delegated to upstream services
- **No Infrastructure Duplication** - No local retry logic, caching, metrics, or logging frameworks
- **Thin Adapters** - Adapters are pure delegation layers with minimal transformation
- **Simulator Compatible** - All adapters include stub implementations for testing

## API Reference

### AutomationRequest

```typescript
interface AutomationRequest {
  pipelineId?: string;           // Pipeline to execute
  workflowId?: string;           // Existing workflow to resume
  input: Record<string, unknown>; // Input data
  routingHints?: RoutingHints;   // Optimization hints
  options?: ExecutionOptions;    // Execution configuration
}
```

### RoutingHints

```typescript
interface RoutingHints {
  preferredProvider?: string;              // Preferred provider ID
  modelTier?: 'fast' | 'balanced' | 'quality'; // Model selection tier
  maxLatencyMs?: number;                   // Maximum acceptable latency
  costBudget?: number;                     // Cost constraint
}
```

### AutomationResult

```typescript
interface AutomationResult {
  success: boolean;
  output: unknown;
  metadata: ExecutionMetadata;
}

interface ExecutionMetadata {
  pipelineId: string;
  workflowId?: string;
  providerId: string;
  modelId: string;
  durationMs: number;
  optimizationApplied?: string;
}
```

## Custom Adapters

Inject custom adapter implementations for production use:

```typescript
import { AutomationService } from 'llm-automation-core';
import { createForgeClient } from 'llm-forge';
import { createOptimizerClient } from 'llm-auto-optimizer';
import { createOrchestratorClient } from 'llm-orchestrator';
import { createConnectorClient } from 'llm-connector-hub';

const service = new AutomationService({
  forge: createForgeAdapter(createForgeClient()),
  optimizer: createOptimizerAdapter(createOptimizerClient()),
  orchestrator: createOrchestratorAdapter(createOrchestratorClient()),
  connector: createConnectorAdapter(createConnectorClient()),
});
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run lint
```

## License

MIT License - see [LICENSE.md](LICENSE.md) for details.
