// Adapter for LLM-Connector-Hub (20) - Standardized provider adapters
// This adapter delegates to LLM-Connector-Hub for provider resolution

import type {
  ProviderAdapter, OptimizationSignal,
  InstrumentedResult, SpanEvidence,
} from '../types.js';
import { createSpan, completeSpan } from '../execution/spans.js';

/** Stub interface matching LLM-Connector-Hub's exported API */
interface ConnectorHubClient {
  getProvider(providerId: string): Promise<ProviderAdapter | null>;
  getDefaultProvider(): Promise<ProviderAdapter>;
}

/** Creates a connector adapter - in production, inject the real client */
export function createConnectorAdapter(client?: ConnectorHubClient): ConnectorAdapter {
  return new ConnectorAdapter(client ?? createSimulatorClient());
}

class ConnectorAdapter {
  constructor(private client: ConnectorHubClient) {}

  async resolveProvider(
    signal: OptimizationSignal,
    parentSpanId: string
  ): Promise<InstrumentedResult<ProviderAdapter>> {
    const repoSpan = createSpan({
      type: 'repo',
      name: 'llm-connector-hub',
      repo_name: 'llm-connector-hub',
      parent_span_id: parentSpanId,
    });

    const agentSpan = createSpan({
      type: 'agent',
      name: 'provider-resolver-agent',
      parent_span_id: repoSpan.span_id,
    });

    let provider: ProviderAdapter;
    try {
      if (signal.recommendedProvider) {
        const found = await this.client.getProvider(signal.recommendedProvider);
        if (found && await found.isAvailable()) {
          provider = found;
        } else {
          provider = await this.client.getDefaultProvider();
        }
      } else {
        provider = await this.client.getDefaultProvider();
      }
    } catch (error) {
      const spans = [
        completeSpan(repoSpan, { status: 'failed' }),
        completeSpan(agentSpan, { status: 'failed' }),
      ];
      throw Object.assign(error as Error, { spans });
    }

    const evidence: SpanEvidence[] = [{
      id: `provider-${provider.id}`,
      type: 'provider-resolution',
      uri: `provider://${provider.id}`,
    }];

    const spans = [
      completeSpan(repoSpan),
      completeSpan(agentSpan, { evidence }),
    ];

    return { result: provider, spans };
  }
}

/** Simulator-compatible stub client */
function createSimulatorClient(): ConnectorHubClient {
  const createStubProvider = (id: string): ProviderAdapter => ({
    id,
    async execute(request: unknown) {
      return { providerId: id, request, simulated: true };
    },
    async isAvailable() { return true; },
  });

  return {
    async getProvider(providerId: string) {
      return createStubProvider(providerId);
    },
    async getDefaultProvider() {
      return createStubProvider('default-provider');
    },
  };
}

export type { ConnectorAdapter };
