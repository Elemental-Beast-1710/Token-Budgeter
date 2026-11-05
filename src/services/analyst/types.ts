/**
 * Phase 7: Optional AI Analyst Types
 * Verifiable analytics explanation without chatbot bloat or delegated arithmetic.
 */

export type AnalystTopic =
  | 'spending_change'
  | 'retry_rates'
  | 'optimization_experiments'
  | 'telemetry_audit';

export interface PrecomputedMetrics {
  totalEvents: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  timeWindow: {
    start: string;
    end: string;
    durationDays: number;
  };
  topModels: Array<{
    model: string;
    eventCount: number;
    costUsd: number;
    costSharePercent: number;
    avgCostPerEventUsd: number;
  }>;
  topTasks: Array<{
    task: string;
    eventCount: number;
    costUsd: number;
  }>;
  retryStats: {
    totalRetries: number;
    eventsWithRetriesCount: number;
    retryRatePercent: number;
    failedEventsCount: number;
    failureWasteCostUsd: number;
  };
  periodComparison?: {
    baselineCostUsd: number;
    currentCostUsd: number;
    deltaUsd: number;
    deltaPercent: number;
    primaryDriverModel: string;
  };
  findingsSummary: Array<{
    id: string;
    type: string;
    title: string;
    severity: string;
    estimatedExcessCostUsd: number;
    confidenceLevel: string;
  }>;
  missingTelemetry: string[];
}

export interface CandidateEvidenceItem {
  evidenceId: string;
  timestamp: string;
  model: string;
  task: string;
  tokens: number;
  costUsd: number;
  status: string;
  retries: number;
  sanitizedTag: string;
}

export interface AnalystRequest {
  topic: AnalystTopic;
  focusQuestion?: string;
  metrics: PrecomputedMetrics;
  candidateEvidence: CandidateEvidenceItem[];
  allowExternalProcessing: boolean;
}

export interface RecommendedExperiment {
  title: string;
  hypothesis: string;
  riskLevel: 'low' | 'medium' | 'high';
  metricToWatch: string;
  actionableChecklist: string[];
}

export interface AnalystValidationResult {
  isValid: boolean;
  rejectedFabricatedIds: string[];
  unsupportedClaims: string[];
  warnings: string[];
}

export interface AnalystResponse {
  provider: 'gemini-3.8-flash' | 'rule_based_offline';
  generatedAt: string;
  topic: AnalystTopic;
  summary: string;
  observedFacts: string[];
  citedEvidenceIds: string[];
  hypotheses: string[];
  recommendedExperiments: RecommendedExperiment[];
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string;
  limitations: string[];
  missingData: string[];
  validation: AnalystValidationResult;
}

export interface IAnalystProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  analyze(request: AnalystRequest): Promise<AnalystResponse>;
}
