import { calculateDeterministicCost, DEFAULT_PRICING_CATALOG } from '../pricing';
import { generateEventFingerprint } from '../importer';
import { PricingRate, UsageEvent } from '../../types';
import {
  ConnectionTestResult,
  IProviderAdapter,
  IntegrationMetadata,
  SyncOptions,
  SyncResult,
} from './types';

export class OpenAIUsageAdapter implements IProviderAdapter {
  metadata: IntegrationMetadata = {
    id: 'openai_admin_api',
    name: 'openai',
    displayName: 'OpenAI Organization Usage API',
    providerKey: 'openai',
    version: '1.0.0',
    description:
      'Official OpenAI Organization Usage REST API (/v1/organization/usage/completions). Ingests verified hourly token buckets with project attribution.',
    status: 'credentials_required',
    capabilities: {
      supportsDirectSync: true,
      supportsIncrementalSync: true,
      supportsReportedCost: false, // Usage endpoint reports token buckets; costs calculated via verified rate cards
      supportsGranularRequests: false, // Hourly bucket aggregation rather than per-request traces
      supportsProjectGrouping: true,
      supportsUserGrouping: true,
      supportsCachedTokens: true,
      supportsReasoningTokens: false,
      supportsLatency: false,
      supportsRetryCount: false,
    },
    documentation: {
      supportedFields: [
        'id (synthetic bucket identifier)',
        'timestamp (hourly bucket start)',
        'provider ("openai")',
        'model',
        'project (project_id attribution)',
        'inputTokens',
        'outputTokens',
        'cachedInputTokens',
        'requestCount (num_model_requests)',
        'estimatedCost (deterministic rate card calculation)',
      ],
      unsupportedFields: [
        'durationMs (request latency not exposed in billing buckets)',
        'retryCount (retries counted as distinct requests by provider)',
        'status (aggregate counts do not delineate HTTP failure codes)',
        'raw request/response payloads',
      ],
      historicalWindowLimit: 'Typically up to 90 days of hourly aggregate history',
      syncDelayLatency: 'Usage metrics typically lag live calls by 5 to 60 minutes',
      dataGranularity: 'Hourly token aggregate buckets grouped by model and project_id',
      requiredPermissions: [
        'Organization Admin API Key (Admin permissions required)',
        'Scoped permission: usage.read',
      ],
      reconciliationCaveats: [
        'OpenAI Usage API returns aggregated buckets rather than individual request traces.',
        'Cost is labeled costBasis: "estimated" calculated via verified OpenAI rate cards.',
        'To reconcile with invoices, compare 30-day cumulative sums against the OpenAI dashboard invoice totals.',
      ],
    },
    credentialFields: [
      {
        key: 'adminApiKey',
        label: 'OpenAI Admin API Key',
        type: 'password',
        placeholder: 'sk-admin-...',
        required: true,
        description: 'An Admin API key generated from platform.openai.com with usage.read permission. Never stored in client bundles.',
        isSecret: true,
      },
      {
        key: 'organizationId',
        label: 'Organization ID',
        type: 'text',
        placeholder: 'org-...',
        required: false,
        description: 'Optional Organization ID (e.g. org-xyz) if your account belongs to multiple organizations.',
      },
    ],
    officialDocsUrl: 'https://platform.openai.com/docs/api-reference/usage',
  };

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    const apiKey = credentials.adminApiKey?.trim();
    const orgId = credentials.organizationId?.trim();

    if (!apiKey) {
      return {
        ok: false,
        status: 'unauthorized',
        message: 'OpenAI Admin API Key is required.',
      };
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (orgId) {
        headers['OpenAI-Organization'] = orgId;
      }

      // Check models or usage endpoint with narrow 1-hour window
      const nowSec = Math.floor(Date.now() / 1000);
      const testStart = nowSec - 3600;

      const res = await fetch(
        `https://api.openai.com/v1/organization/usage/completions?start_time=${testStart}&limit=1`,
        {
          method: 'GET',
          headers,
        }
      );

      if (res.status === 401) {
        return {
          ok: false,
          status: 'unauthorized',
          message: 'Invalid OpenAI API key. Ensure you are using an Admin key with usage.read permission.',
        };
      }

      if (res.status === 403) {
        return {
          ok: false,
          status: 'forbidden',
          message: 'Permission denied: This key lacks usage.read admin permissions in the specified organization.',
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          status: 'rate_limited',
          message: 'OpenAI API rate limit exceeded during connection test. Please retry in a few moments.',
        };
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        return {
          ok: false,
          status: 'network_error',
          message: errorBody?.error?.message || `HTTP ${res.status}: Failed to reach OpenAI Usage API.`,
        };
      }

      const body = await res.json();

      return {
        ok: true,
        status: 'authenticated',
        message: 'Connected to OpenAI Organization Usage API successfully.',
        details: {
          organizationId: orgId || 'Default Organization',
          availableModelsCount: Array.isArray(body?.data) ? body.data.length : undefined,
          testedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 'network_error',
        message: `Network error connecting to OpenAI: ${err?.message || 'Check internet connectivity.'}`,
      };
    }
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    const apiKey = options.credentials.adminApiKey?.trim();
    const orgId = options.credentials.organizationId?.trim();

    if (!apiKey) {
      return {
        success: false,
        state: 'failed',
        events: [],
        newEventsCount: 0,
        duplicatesCount: 0,
        error: 'Missing OpenAI Admin API Key.',
      };
    }

    const batchId = `sync_openai_${Date.now()}`;
    const pricingRates = options.pricingRates || DEFAULT_PRICING_CATALOG;
    const existingEvents = options.existingEvents || [];
    const existingIds = new Set(existingEvents.map((e) => e.id));
    const existingFingerprints = new Set(existingEvents.map((e) => e.fingerprint));

    // Calculate time bounds (default to last 7 days if not provided)
    const endSec = options.endDate
      ? Math.floor(new Date(options.endDate).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    const startSec = options.startDate
      ? Math.floor(new Date(options.startDate).getTime() / 1000)
      : endSec - 7 * 86400;

    let url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startSec}&end_time=${endSec}&bucket_width=1h&limit=${options.batchSize || 50}&group_by[]=model&group_by[]=project_id`;

    if (options.cursor) {
      url += `&after=${encodeURIComponent(options.cursor)}`;
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (orgId) {
        headers['OpenAI-Organization'] = orgId;
      }

      const res = await fetch(url, { headers });

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after') || '60';
        return {
          success: false,
          state: 'failed',
          events: [],
          newEventsCount: 0,
          duplicatesCount: 0,
          error: `OpenAI Rate limit reached (HTTP 429). Retry after ${retryAfter} seconds.`,
        };
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return {
          success: false,
          state: 'failed',
          events: [],
          newEventsCount: 0,
          duplicatesCount: 0,
          error: errJson?.error?.message || `OpenAI Usage API error (HTTP ${res.status}).`,
        };
      }

      const responseBody = await res.json();
      const rawData = Array.isArray(responseBody?.data) ? responseBody.data : [];
      const hasMore = Boolean(responseBody?.has_more);
      const nextCursor = responseBody?.next_page || undefined;

      const events: UsageEvent[] = [];
      let duplicatesCount = 0;

      for (const bucket of rawData) {
        const canonical = this.mapToCanonical(bucket, batchId, pricingRates);
        if (!canonical) continue;

        if (existingIds.has(canonical.id) || existingFingerprints.has(canonical.fingerprint)) {
          duplicatesCount++;
          continue;
        }

        events.push(canonical);
      }

      return {
        success: true,
        state: hasMore ? 'partial' : 'success',
        events,
        newEventsCount: events.length,
        duplicatesCount,
        nextCursor,
        lastSyncedTimestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        state: 'failed',
        events: [],
        newEventsCount: 0,
        duplicatesCount: 0,
        error: `Sync failed: ${err?.message || 'Network failure'}`,
      };
    }
  }

  mapToCanonical(
    raw: any,
    batchId: string,
    pricingRates: PricingRate[] = DEFAULT_PRICING_CATALOG
  ): UsageEvent | null {
    if (!raw) return null;

    // Handle OpenAI bucket structure: aggregation_timestamp or timestamp
    const timestampSec = raw.aggregation_timestamp || raw.timestamp;
    if (!timestampSec && !raw.date) return null;

    const timestamp = timestampSec
      ? new Date(Number(timestampSec) * 1000).toISOString()
      : new Date(raw.date).toISOString();

    const model = String(raw.model || 'gpt-4o');
    const inputTokens = Number(raw.input_tokens || raw.prompt_tokens || 0);
    const outputTokens = Number(raw.output_tokens || raw.completion_tokens || 0);
    const cachedInputTokens =
      raw.input_cached_tokens !== undefined ? Number(raw.input_cached_tokens) : null;
    const requestCount = Number(raw.num_model_requests || raw.request_count || 1);
    const project = String(raw.project_id || raw.project || 'Default');

    // Deterministic synthetic event ID based on bucket dimensions
    const syntheticId = `openai_bucket_${Math.floor(new Date(timestamp).getTime() / 1000)}_${model}_${project}`.replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

    // Compute deterministic estimated cost via verified catalog
    const costEstimate = calculateDeterministicCost(
      {
        model,
        inputTokens,
        outputTokens,
        cachedInputTokens: cachedInputTokens || 0,
        reasoningTokens: 0,
      },
      pricingRates
    );

    const fingerprint = generateEventFingerprint({
      id: syntheticId,
      timestamp,
      model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      project,
      task: 'usage_bucket',
    });

    return {
      id: syntheticId,
      timestamp,
      provider: 'openai',
      model,
      project,
      task: 'api_usage_aggregate',
      source: 'openai_admin_api',
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningTokens: null, // Reasoning tokens grouped inside output in usage buckets
      requestCount,
      retryCount: 0,
      status: 'success',
      reportedCost: null, // Usage API does not report per-bucket exact charge; explicitly estimated
      estimatedCost: costEstimate.costUsd,
      reportedCurrency: 'USD',
      costBasis: 'estimated',
      durationMs: null, // Latency not recorded in billing aggregates
      metadata: {
        rawBucket: true,
        projectId: raw.project_id || null,
        userId: raw.user_id || null,
        apiKeyId: raw.api_key_id || null,
      },
      importBatchId: batchId,
      fingerprint,
      qualityScore: null,
      isSample: false,
      recordOrigin: 'imported',
    };
  }
}
