import { integrationRegistry } from './integrations/registry';
import {
  ConnectionTestResult,
  IntegrationMetadata,
  SyncOptions,
  SyncResult,
} from './integrations/types';

/**
 * Client service to communicate with secure server-side integration proxy,
 * with fallback to client-side integration registry in offline/local-only mode.
 */

export async function fetchIntegrationList(): Promise<IntegrationMetadata[]> {
  try {
    const res = await fetch('/api/integrations');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.integrations)) {
        return data.integrations;
      }
    }
  } catch {
    // fallback to local registry
  }
  return integrationRegistry.getAllMetadata();
}

export async function testProviderConnection(
  providerId: string,
  credentials: Record<string, string>
): Promise<ConnectionTestResult> {
  try {
    const res = await fetch('/api/integrations/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, credentials }),
    });
    if (res.ok) {
      return await res.json();
    }
    const errBody = await res.json().catch(() => ({}));
    return {
      ok: false,
      status: 'network_error',
      message: errBody?.error || `HTTP ${res.status}: Failed to test connection`,
    };
  } catch {
    // fallback to in-memory registry
    return integrationRegistry.testConnection(providerId, credentials);
  }
}

export async function executeProviderSync(
  providerId: string,
  options: SyncOptions
): Promise<SyncResult> {
  try {
    const res = await fetch('/api/integrations/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        credentials: options.credentials,
        startDate: options.startDate,
        endDate: options.endDate,
        cursor: options.cursor,
        batchSize: options.batchSize,
        existingEvents: options.existingEvents?.slice(-200) || [],
      }),
    });
    if (res.ok) {
      return await res.json();
    }
    const errBody = await res.json().catch(() => ({}));
    return {
      success: false,
      state: 'failed',
      events: [],
      newEventsCount: 0,
      duplicatesCount: 0,
      error: errBody?.error || `HTTP ${res.status}: Synchronization failed.`,
    };
  } catch (err: any) {
    // fallback to in-memory registry
    return integrationRegistry.syncProvider(providerId, options);
  }
}
