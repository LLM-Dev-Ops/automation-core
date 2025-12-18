// Adapter for LLM-Connector-Hub (20) - Standardized provider adapters
// This adapter delegates to LLM-Connector-Hub for provider resolution

import type { ProviderAdapter, OptimizationSignal } from '../types.js';

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

  async resolveProvider(signal: OptimizationSignal): Promise<ProviderAdapter> {
    if (signal.recommendedProvider) {
      const provider = await this.client.getProvider(signal.recommendedProvider);
      if (provider && await provider.isAvailable()) {
        return provider;
      }
    }
    return this.client.getDefaultProvider();
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
