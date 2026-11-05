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

export class MockProviderAdapter implements IProviderAdapter {
  metadata: IntegrationMetadata = {
    id: 'mock_sandbox',
    name: 'mock',
    displayName: 'Mock / Sandbox Provider Adapter',
    providerKey: 'other',
    version: '1.0.0',
    description:
      'Deterministic sandbox adapter for continuous integration, offline simulation, and adapter testing. Generates predictable usage records.',
    status: 'mock_sandbox',
    capabilities: {
      supportsDirectSync: true,
      supportsIncrementalSync: true,
      supportsReportedCost: true,
      supportsGranularRequests: true,
      supportsProjectGrouping: true,
      supportsUserGrouping: true,
      supportsCachedTokens: true,
      supportsReasoningTokens: true,
      supportsLatency: true,
      supportsRetryCount: true,
    },
    documentation: {
      supportedFields: [
        'id',
        'timestamp',
        'model',
        'provider',
        'project',
        'task',
        'inputTokens',
        'outputTokens',
        'cachedInputTokens',
        'reasoningTokens',
        'reportedCost',
        'durationMs',
        'retryCount',
        'status',
      ],
      unsupportedFields: [],
      historicalWindowLimit: 'Unlimited (deterministic synthetic records)',
      syncDelayLatency: 'Zero latency (in-memory simulation)',
      dataGranularity: 'Per-request telemetry events with explicit timestamps',
      requiredPermissions: ['mock.read (No real cloud permissions required)'],
      reconciliationCaveats: [
        'Records are generated for verification and must not be used for real billing audits.',
        'Clearly tagged with source: mock_sandbox and recordOrigin: imported.',
      ],
    },
    credentialFields: [
      {
        key: 'sandboxKey',
        label: 'Sandbox Test Key',
        type: 'text',
        placeholder: 'sbx_test_token_123',
        required: false,
        description: 'Optional test key. Use "invalid_token" to simulate authentication failures, or "rate_limit" to simulate 429 throttling.',
      },
    ],
    officialDocsUrl: 'https://github.com/tokenbudgeter/tokenbudgeter',
  };

  async testConnection(credentials: Record<string, string>): Promise<ConnectionTestResult> {
    const key = credentials.sandboxKey || '';
    if (key === 'invalid_token') {
      return {
        ok: false,
        status: 'unauthorized',
        message: 'Sandbox authentication failed: Simulated invalid token.',
      };
    }
    if (key === 'rate_limit') {
      return {
        ok: false,
        status: 'rate_limited',
        message: 'Sandbox rate limit reached: Simulated HTTP 429 backoff required.',
      };
    }

    return {
      ok: true,
      status: 'authenticated',
      message: 'Sandbox adapter connected successfully in local deterministic mode.',
      details: {
        organizationId: 'org_sandbox_demo',
        organizationName: 'Sandbox Verification Org',
        availableModelsCount: 12,
        grantedScopes: ['mock.read', 'mock.telemetry.read'],
        testedAt: new Date().toISOString(),
      },
    };
  }

  async sync(options: SyncOptions): Promise<SyncResult> {
    const key = options.credentials.sandboxKey || '';
    if (key === 'invalid_token') {
      return {
        success: false,
        state: 'failed',
        events: [],
        newEventsCount: 0,
        duplicatesCount: 0,
        error: 'Authentication failed: Invalid sandbox token.',
      };
    }
    if (key === 'rate_limit') {
      return {
        success: false,
        state: 'failed',
        events: [],
        newEventsCount: 0,
        duplicatesCount: 0,
        error: 'Rate limit exceeded: HTTP 429 Too Many Requests (simulated).',
      };
    }

    const batchId = `sync_mock_${Date.now()}`;
    const pricingRates = options.pricingRates || DEFAULT_PRICING_CATALOG;
    const existingEvents = options.existingEvents || [];
    const existingIds = new Set(existingEvents.map((e) => e.id));
    const existingFingerprints = new Set(existingEvents.map((e) => e.fingerprint));

    // Simulate 2-page pagination: page_1 -> page_2 -> done
    const isFirstPage = !options.cursor || options.cursor === 'page_1';
    const isSecondPage = options.cursor === 'page_2';

    if (!isFirstPage && !isSecondPage) {
      // Completed / no more records
      return {
        success: true,
        state: 'success',
        events: [],
        newEventsCount: 0,
        duplicatesCount: 0,
        nextCursor: undefined,
        lastSyncedTimestamp: new Date().toISOString(),
      };
    }

    const rawRecords = isFirstPage
      ? [
          {
            record_id: 'mock_rec_101',
            timestamp: '2026-10-23T01:00:00Z',
            model: 'gpt-4o',
            tokens_in: 1200,
            tokens_out: 350,
            cache_read_tokens: 800,
            cost_usd: 0.0075,
            latency: 650,
            project: 'BillingEngine',
            task: 'invoice_gen',
            status: 'success',
            retries: 0,
          },
          {
            record_id: 'mock_rec_102',
            timestamp: '2026-10-23T01:15:00Z',
            model: 'claude-3-5-sonnet',
            tokens_in: 4500,
            tokens_out: 620,
            cache_read_tokens: 3600,
            cost_usd: 0.0165,
            latency: 1420,
            project: 'BillingEngine',
            task: 'code_review',
            status: 'success',
            retries: 1,
          },
        ]
      : [
          {
            record_id: 'mock_rec_103',
            timestamp: '2026-10-23T01:45:00Z',
            model: 'gemini-1.5-pro',
            tokens_in: 8000,
            tokens_out: 400,
            cache_read_tokens: 0,
            cost_usd: 0.028,
            latency: 980,
            project: 'SearchPortal',
            task: 'query_expansion',
            status: 'success',
            retries: 0,
          },
        ];

    const mappedEvents: UsageEvent[] = [];
    let duplicatesCount = 0;

    for (const raw of rawRecords) {
      const canonical = this.mapToCanonical(raw, batchId, pricingRates);
      if (!canonical) continue;

      if (existingIds.has(canonical.id) || existingFingerprints.has(canonical.fingerprint)) {
        duplicatesCount++;
        continue;
      }

      mappedEvents.push(canonical);
    }

    return {
      success: true,
      state: isFirstPage ? 'partial' : 'success',
      events: mappedEvents,
      newEventsCount: mappedEvents.length,
      duplicatesCount,
      nextCursor: isFirstPage ? 'page_2' : undefined,
      lastSyncedTimestamp: mappedEvents[mappedEvents.length - 1]?.timestamp || new Date().toISOString(),
    };
  }

  mapToCanonical(
    raw: any,
    batchId: string,
    pricingRates: PricingRate[] = DEFAULT_PRICING_CATALOG
  ): UsageEvent | null {
    if (!raw || !raw.record_id || !raw.timestamp || !raw.model) {
      return null;
    }

    const inputTokens = Number(raw.tokens_in) || 0;
    const outputTokens = Number(raw.tokens_out) || 0;
    const cachedInputTokens = raw.cache_read_tokens !== undefined ? Number(raw.cache_read_tokens) : null;
    const reportedCost = raw.cost_usd !== undefined && raw.cost_usd !== null ? Number(raw.cost_usd) : null;

    let estimatedCost: number | null = null;
    let costBasis: UsageEvent['costBasis'] = 'reported';

    if (reportedCost === null || isNaN(reportedCost)) {
      const calc = calculateDeterministicCost(
        {
          model: raw.model,
          inputTokens,
          outputTokens,
          cachedInputTokens: cachedInputTokens || 0,
          reasoningTokens: 0,
        },
        pricingRates
      );
      estimatedCost = calc.costUsd;
      costBasis = calc.costBasis;
    }

    const fingerprint = generateEventFingerprint({
      id: String(raw.record_id),
      timestamp: raw.timestamp,
      model: raw.model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      project: raw.project || 'General',
      task: raw.task || 'default',
    });

    return {
      id: String(raw.record_id),
      timestamp: new Date(raw.timestamp).toISOString(),
      provider: 'other',
      model: String(raw.model),
      project: String(raw.project || 'General'),
      task: String(raw.task || 'default'),
      source: 'mock_sandbox',
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningTokens: null,
      requestCount: 1,
      retryCount: Number(raw.retries) || 0,
      status: (raw.status as any) || 'success',
      reportedCost,
      estimatedCost,
      reportedCurrency: 'USD',
      costBasis,
      durationMs: raw.latency !== undefined ? Number(raw.latency) : null,
      metadata: { mockGenerated: true, simulationSeed: raw.record_id },
      importBatchId: batchId,
      fingerprint,
      qualityScore: 90,
      isSample: false,
      recordOrigin: 'imported',
    };
  }
}
