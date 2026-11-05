import { PricingRate, UsageEvent } from '../../types';

export type IntegrationStatus =
  | 'connected'
  | 'credentials_required'
  | 'syncing'
  | 'error'
  | 'file_export_only'
  | 'mock_sandbox';

export type SyncState = 'idle' | 'syncing' | 'success' | 'partial' | 'failed';

export interface CredentialField {
  key: string;
  label: string;
  type: 'password' | 'text';
  placeholder: string;
  required: boolean;
  description: string;
  isSecret?: boolean;
}

export interface ProviderCapabilities {
  supportsDirectSync: boolean;
  supportsIncrementalSync: boolean;
  supportsReportedCost: boolean;
  supportsGranularRequests: boolean; // e.g. per-request logs vs bucketed hourly aggregates
  supportsProjectGrouping: boolean;
  supportsUserGrouping: boolean;
  supportsCachedTokens: boolean;
  supportsReasoningTokens: boolean;
  supportsLatency: boolean;
  supportsRetryCount: boolean;
}

export interface FieldSupportDocumentation {
  supportedFields: string[];
  unsupportedFields: string[];
  historicalWindowLimit: string;
  syncDelayLatency: string;
  dataGranularity: string; // e.g. "Hourly token aggregates by model & project"
  requiredPermissions: string[];
  reconciliationCaveats: string[];
}

export interface IntegrationMetadata {
  id: string;
  name: string;
  displayName: string;
  providerKey: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'meta' | 'mistral' | 'other';
  version: string;
  description: string;
  status: IntegrationStatus;
  capabilities: ProviderCapabilities;
  documentation: FieldSupportDocumentation;
  credentialFields: CredentialField[];
  officialDocsUrl: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  status: 'authenticated' | 'unauthorized' | 'forbidden' | 'network_error' | 'rate_limited';
  message: string;
  details?: {
    organizationId?: string;
    organizationName?: string;
    availableModelsCount?: number;
    grantedScopes?: string[];
    testedAt: string;
  };
}

export interface SyncOptions {
  credentials: Record<string, string>;
  startDate?: string; // ISO date or YYYY-MM-DD
  endDate?: string;
  cursor?: string;
  batchSize?: number;
  pricingRates?: PricingRate[];
  existingEvents?: UsageEvent[];
}

export interface SyncResult {
  success: boolean;
  state: SyncState;
  events: UsageEvent[];
  newEventsCount: number;
  duplicatesCount: number;
  nextCursor?: string;
  lastSyncedTimestamp?: string;
  error?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Common Provider Adapter Interface.
 * Standardizes discovery, authentication, sync, pagination, and canonical mapping.
 */
export interface IProviderAdapter {
  metadata: IntegrationMetadata;

  testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult>;

  sync(options: SyncOptions): Promise<SyncResult>;

  mapToCanonical(
    rawRecord: any,
    batchId: string,
    pricingRates?: PricingRate[]
  ): UsageEvent | null;
}
