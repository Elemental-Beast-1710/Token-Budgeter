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

export class AnthropicConsoleAdapter implements IProviderAdapter {
  metadata: IntegrationMetadata = {
    id: 'anthropic_console_export',
    name: 'anthropic',
    displayName: 'Anthropic Console (Billing & Usage Export)',
    providerKey: 'anthropic',
    version: '1.0.0',
    description:
      'Anthropic Workspace billing exports. Anthropic does not currently provide a live public per-request usage API for direct sync; ingestion is officially supported via Console CSV/JSON export.',
    status: 'file_export_only',
    capabilities: {
      supportsDirectSync: false,
      supportsIncrementalSync: false,
      supportsReportedCost: true,
      supportsGranularRequests: false,
      supportsProjectGrouping: true,
      supportsUserGrouping: true,
      supportsCachedTokens: true,
      supportsReasoningTokens: false,
      supportsLatency: false,
      supportsRetryCount: false,
    },
    documentation: {
      supportedFields: [
        'timestamp (date / hourly bucket)',
        'model (e.g. claude-3-5-sonnet, claude-3-opus)',
        'provider ("anthropic")',
        'project (Workspace name)',
        'inputTokens',
        'outputTokens',
        'cachedInputTokens (prompt cache read tokens)',
        'reportedCost (reported USD spend from console invoice log)',
      ],
      unsupportedFields: [
        'Live background polling (Anthropic API does not offer a public /v1/usage REST endpoint)',
        'durationMs (latency not present in console billing ledger)',
        'retryCount (telemetry retries not distinguished in invoice export)',
      ],
      historicalWindowLimit: 'Console allows monthly export back to account inception',
      syncDelayLatency: 'Updated daily in console.anthropic.com billing portal',
      dataGranularity: 'Daily or hourly billing aggregates by workspace and model',
      requiredPermissions: [
        'Anthropic Console Workspace Admin or Billing Owner (to download CSV logs from console.anthropic.com/settings/billing)',
      ],
      reconciliationCaveats: [
        'Anthropic invoices apply prompt caching discounts (cache_read vs cache_write). Ingested CSV files preserve reported cost directly.',
        'To ingest Anthropic logs, export the CSV from the Anthropic Console and use TokenBudgeter File Ingestion.',
      ],
    },
    credentialFields: [],
    officialDocsUrl: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#pricing',
  };

  async testConnection(_credentials: Record<string, string>): Promise<ConnectionTestResult> {
    return {
      ok: true,
      status: 'authenticated',
      message:
        'Anthropic integration operational via verified Console CSV/JSON export pipeline. Direct API polling is not currently offered by Anthropic.',
      details: {
        testedAt: new Date().toISOString(),
      },
    };
  }

  async sync(_options: SyncOptions): Promise<SyncResult> {
    return {
      success: true,
      state: 'idle',
      events: [],
      newEventsCount: 0,
      duplicatesCount: 0,
      warnings: [
        'Direct live API polling is not supported by Anthropic. Please export your usage spreadsheet from console.anthropic.com and upload via File Ingestion.',
      ],
    };
  }

  mapToCanonical(
    raw: any,
    batchId: string,
    pricingRates: PricingRate[] = DEFAULT_PRICING_CATALOG
  ): UsageEvent | null {
    if (!raw || !raw.timestamp || !raw.model) return null;

    const inputTokens = Number(raw.inputTokens || raw.prompt_tokens || 0);
    const outputTokens = Number(raw.outputTokens || raw.completion_tokens || 0);
    const cachedInputTokens =
      raw.cachedInputTokens !== undefined ? Number(raw.cachedInputTokens) : null;
    const reportedCost =
      raw.reportedCost !== undefined && raw.reportedCost !== null
        ? Number(raw.reportedCost)
        : null;

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
      timestamp: raw.timestamp,
      model: raw.model,
      inputTokens,
      outputTokens,
      project: raw.project || 'AnthropicWorkspace',
      task: raw.task || 'default',
    });

    return {
      id: raw.id || `anthropic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date(raw.timestamp).toISOString(),
      provider: 'anthropic',
      model: String(raw.model),
      project: String(raw.project || 'AnthropicWorkspace'),
      task: String(raw.task || 'default'),
      source: 'anthropic_console',
      inputTokens,
      outputTokens,
      cachedInputTokens,
      reasoningTokens: null,
      requestCount: Number(raw.requestCount) || 1,
      retryCount: 0,
      status: 'success',
      reportedCost,
      estimatedCost,
      reportedCurrency: 'USD',
      costBasis,
      durationMs: null,
      metadata: raw.metadata || {},
      importBatchId: batchId,
      fingerprint,
      qualityScore: null,
      isSample: false,
      recordOrigin: 'imported',
    };
  }
}
