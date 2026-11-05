import { AnthropicConsoleAdapter } from './anthropicAdapter';
import { MockProviderAdapter } from './mockAdapter';
import { OpenAIUsageAdapter } from './openaiAdapter';
import { OpenTelemetryAdapter } from './otelAdapter';
import {
  ConnectionTestResult,
  IProviderAdapter,
  IntegrationMetadata,
  SyncOptions,
  SyncResult,
} from './types';

export class IntegrationRegistry {
  private adapters: Map<string, IProviderAdapter> = new Map();

  constructor() {
    this.registerAdapter(new OpenAIUsageAdapter());
    this.registerAdapter(new MockProviderAdapter());
    this.registerAdapter(new OpenTelemetryAdapter());
    this.registerAdapter(new AnthropicConsoleAdapter());
  }

  registerAdapter(adapter: IProviderAdapter): void {
    this.adapters.set(adapter.metadata.id, adapter);
  }

  getAllAdapters(): IProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  getAllMetadata(): IntegrationMetadata[] {
    return Array.from(this.adapters.values()).map((a) => a.metadata);
  }

  getAdapterById(id: string): IProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  async testConnection(
    id: string,
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      return {
        ok: false,
        status: 'network_error',
        message: `Unknown integration provider: "${id}"`,
      };
    }
    return adapter.testConnection(credentials);
  }

  async syncProvider(id: string, options: SyncOptions): Promise<SyncResult> {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      return {
        success: false,
        state: 'failed',
        events: [],
        newEventsCount: 0,
        duplicatesCount: 0,
        error: `Unknown integration provider: "${id}"`,
      };
    }
    return adapter.sync(options);
  }
}

export const integrationRegistry = new IntegrationRegistry();
