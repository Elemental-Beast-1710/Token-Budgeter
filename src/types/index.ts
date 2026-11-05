/**
 * Canonical types for TokenBudgeter
 * Open-source AI usage analytics and optimization platform
 */

export type ProviderKey = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'meta' | 'mistral' | 'other';

export type EventStatus = 'success' | 'failed' | 'rate_limited' | 'cancelled';

export type CostBasis = 'reported' | 'estimated' | 'unknown';

export type RecordOrigin = 'sample' | 'imported' | 'manual';

export type NavTab =
  | 'overview'
  | 'explorer'
  | 'projects'
  | 'optimization'
  | 'analyst'
  | 'simulator'
  | 'imports'
  | 'reports'
  | 'settings';

export interface UsageEvent {
  id: string;
  timestamp: string; // ISO-8601 string
  provider: ProviderKey;
  model: string;
  project: string;
  task: string;
  source: string; // e.g., 'cursor', 'copilot', 'aider', 'cli', 'api_gateway', 'manual'
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  requestCount: number;
  retryCount: number;
  status: EventStatus;
  reportedCost: number | null; // ONLY explicitly reported in source records
  estimatedCost: number | null; // Calculated deterministically via rate cards
  reportedCurrency: string; // e.g. 'USD', 'EUR', 'GBP'
  costBasis: CostBasis;
  durationMs: number | null;
  metadata: Record<string, any>;
  importBatchId: string;
  fingerprint: string;
  qualityScore: number | null; // 1-100 outcome quality evaluation if recorded
  isSample: boolean;
  recordOrigin?: RecordOrigin;
}

export interface ProjectBudget {
  id: string;
  name: string;
  description: string;
  monthlyLimitUsd: number;
  warningThresholdPercent: number; // e.g. 80 means warn at 80%
  color: string;
  createdAt: string;
}

export interface PricingRate {
  id: string;
  provider: ProviderKey;
  model: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
  reasoningPerMillionUsd?: number;
  inputPricingUnit?: number; // default 1,000,000
  outputPricingUnit?: number; // default 1,000,000
  cachedInputPricingUnit?: number; // default 1,000,000
  reasoningPricingUnit?: number; // default 1,000,000
  effectiveDate: string;
  source: string;
}

export type DateRangePreset = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';

export interface FilterState {
  datePreset: DateRangePreset;
  customStartDate?: string;
  customEndDate?: string;
  provider: string; // 'all' or specific
  model: string; // 'all' or specific
  project: string; // 'all' or specific
  task: string; // 'all' or specific
  status: string; // 'all' or specific
  costBasis: string; // 'all' or specific
  source: string; // 'all' or specific
  searchQuery: string;
}

export interface KPIStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalTokens: number;
  reportedCostUsd: number;
  estimatedCostUsd: number;
  totalEffectiveCostUsd: number;
  unknownCostCount: number;
  totalRequests: number;
  failedRequests: number;
  retryCount: number;
  retryRatePercent: number;
  avgCostPerRequestUsd: number;
  avgDurationMs: number | null;
  sampleCount: number;
  actualCount: number;
  costByCurrency: Record<string, { reported: number; estimated: number; total: number }>;
  hasMixedCurrencies: boolean;
  primaryCurrency: string;
}

export type InefficiencyType =
  | 'retry_loop'
  | 'high_context_ratio'
  | 'duplicate_requests'
  | 'uncached_prompt'
  | 'cost_concentration'
  | 'expensive_model_simple_task'
  | 'failure_waste';

export interface OptimizationFinding {
  id: string;
  type: InefficiencyType;
  title: string;
  severity: 'high' | 'medium' | 'low';
  pattern: string;
  supportingEventIds: string[];
  calculationRule: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceJustification: string;
  proposedAction: string;
  expectedTradeOffs: string;
  verificationMethod: string;
  metrics: {
    affectedEventsCount: number;
    estimatedExcessCostUsd: number;
    potentialReductionPercent?: number;
    retryRatio?: number;
    contextRatio?: number;
    duplicateHashCount?: number;
    failedEventsCount?: number;
    failureCostUsd?: number;
    baselineCostUsd?: number;
  };
  measuredFacts: {
    baselineSpendUsd: number;
    recordsAnalyzed: number;
    facts: string[];
  };
  hypotheses: string[];
  recommendedExperiments: Array<{
    name: string;
    description: string;
    targetMetric: string;
    sampleSize: string;
  }>;
  knownLimitations: string[];
  baselineVsComparison: {
    baselineLabel: string;
    baselineValue: string;
    projectedLabel: string;
    projectedValue: string;
    certainty: string;
  };
}

export interface ExperimentRun {
  id?: string;
  timestamp?: string;
  tokensIn: number;
  tokensOut: number;
  cachedTokens?: number | null;
  costUsd: number;
  costBasis?: 'reported' | 'estimated';
  reportedCost?: number | null;
  estimatedCost?: number | null;
  latencyMs: number;
  success: boolean;
  retryCount?: number;
  qualityScore?: number; // 0-100 human evaluation or automated benchmark score
  notes?: string;
}

export type ExperimentStatus =
  | 'draft'
  | 'collecting_data'
  | 'ready_for_review'
  | 'completed'
  | 'inconclusive'
  | 'archived';

export interface Experiment {
  id: string;
  name: string;
  objective?: string;
  project?: string;
  task?: string;
  taskCategory: string;
  status?: ExperimentStatus;
  baselineModel: string;
  experimentalModel: string;
  baselineConfig: string;
  experimentalConfig: string;
  startDate?: string;
  endDate?: string;
  sampleSizeTarget?: number;
  inclusionCriteria?: string;
  evaluationMethod?: 'human_eval' | 'automated_benchmark' | 'unit_tests' | 'llm_judge' | 'production_ab';
  baselineRuns: ExperimentRun[];
  experimentalRuns: ExperimentRun[];
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ExperimentEvaluation {
  baselineCount: number;
  experimentalCount: number;
  isSmallSample: boolean;

  // Costs
  baselineTotalCostUsd: number;
  experimentalTotalCostUsd: number;
  baselineAvgCostUsd: number;
  experimentalAvgCostUsd: number;
  costSavingsPercent: number; // Positive = savings, negative = more expensive
  absoluteCostDeltaUsd: number;

  // Cost per successful request (null if 0 successful requests)
  baselineCostPerSuccessUsd: number | null;
  experimentalCostPerSuccessUsd: number | null;
  costPerSuccessDeltaPercent: number | null;

  // Reliability & Latency
  baselineSuccessRatePercent: number;
  experimentalSuccessRatePercent: number;
  successRateDeltaPercent: number;
  baselineAvgLatencyMs: number | null;
  experimentalAvgLatencyMs: number | null;
  latencyDeltaMs: number | null;

  // Tokens
  baselineAvgInputTokens: number;
  experimentalAvgInputTokens: number;
  baselineAvgOutputTokens: number;
  experimentalAvgOutputTokens: number;
  baselineAvgCachedTokens: number;
  experimentalAvgCachedTokens: number;

  // Quality
  baselineAvgQuality: number | null;
  experimentalAvgQuality: number | null;
  qualityDelta: number | null;

  // Warnings and limitations
  warnings: string[];
  limitations: string[];
  hasMixedCurrencies?: boolean;
}

export interface SimulationParams {
  inputReductionPercent: number; // 0 - 80%
  retryReductionPercent: number; // 0 - 90%
  cachingAdoptionPercent: number; // 0 - 100%
  modelShiftTarget?: string; // e.g., 'gpt-4o-mini' or 'gemini-1.5-flash'
  modelShiftPercent: number; // 0 - 100%
  volumeScalingPercent?: number; // -50% to +100%
}

export interface SimulationResult {
  baselineCostUsd: number;
  simulatedCostUsd: number;
  absoluteSavingsUsd: number;
  percentageSavings: number;
  inputTokenSavings: number;
  retryCostSavings: number;
  cachingCostSavings: number;
  modelShiftSavings: number;
  volumeScalingCostDeltaUsd: number;
  baselineEventsCount: number;
  unratedEventsCount: number;
  assumptions: string[];
  limitations: string[];
  tradeOffs: string[];
}

export interface ImportPreviewResult {
  fileName: string;
  fileSize: number;
  fileType: 'csv' | 'json';
  rawRowCount: number;
  detectedColumns: string[];
  columnMapping: Record<string, keyof UsageEvent | 'ignore'>;
  validRows: UsageEvent[];
  invalidRows: Array<{
    rowNumber: number;
    raw: Record<string, any>;
    reason: string;
  }>;
  duplicates: UsageEvent[];
  warnings: string[];
}

export interface ImportBatchRecord {
  id: string;
  fileName: string;
  fileType: 'csv' | 'json';
  fileSize: number;
  importedAt: string; // ISO-8601
  validCount: number;
  duplicateCount: number;
  rejectedCount: number;
  totalTokens: number;
  totalCostUsd: number;
  isSample: boolean;
}

export interface StorageHealth {
  isAvailable: boolean;
  storageType: 'indexeddb' | 'memory' | 'localstorage';
  quotaEstimate?: {
    usageBytes?: number;
    quotaBytes?: number;
    percentUsed?: number;
  };
  schemaVersion: number;
  corruptedRecordsCount: number;
  totalBatchesCount: number;
  statusMessage: string;
}

export interface TokenBudgeterBackup {
  app: 'TokenBudgeter';
  version: string;
  schemaVersion: number;
  exportedAt: string;
  data: {
    events: UsageEvent[];
    projects: ProjectBudget[];
    pricing: PricingRate[];
    experiments: Experiment[];
    importBatches: ImportBatchRecord[];
    settings: AppSettings;
  };
  provenanceSummary?: {
    sampleEventsCount: number;
    realEventsCount: number;
    totalEventsCount: number;
  };
}

export interface AppSettings {
  currency: string;
  theme: 'dark' | 'light';
  timezone: string;
  hasSeenWelcome: boolean;
  activeBatchIds: string[];
  storageType?: 'indexeddb' | 'memory' | 'localstorage';
  workspaceMode?: 'real' | 'demo';
}

