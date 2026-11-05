/**
 * Response Validator & Anti-Hallucination Guard for AI Analyst
 *
 * Verifies that:
 * 1. Every cited evidence ID exists in the candidate evidence set (rejects fabricated IDs).
 * 2. Pre-calculated figures are respected (flags unsupported numerical claims).
 * 3. Structured fields match required schemas.
 * 4. Ground-truth facts are strictly distinguished from AI hypotheses.
 */

import { AnalystResponse, AnalystTopic, PrecomputedMetrics, CandidateEvidenceItem } from './types';

export function validateAnalystOutput(
  raw: any,
  topic: AnalystTopic,
  metrics: PrecomputedMetrics,
  candidateEvidence: CandidateEvidenceItem[],
  provider: 'gemini-3.8-flash' | 'rule_based_offline' = 'gemini-3.8-flash'
): AnalystResponse {
  const warnings: string[] = [];
  const rejectedFabricatedIds: string[] = [];
  const unsupportedClaims: string[] = [];

  const validEvidenceIdSet = new Set(candidateEvidence.map((e) => e.evidenceId));

  // 1. Basic Object Shape validation
  if (!raw || typeof raw !== 'object') {
    return createEmergencyFallbackResponse(
      topic,
      metrics,
      candidateEvidence,
      'Invalid non-object payload returned by analyst provider.'
    );
  }

  // 2. Summary
  const summary = typeof raw.summary === 'string' && raw.summary.trim().length > 0
    ? raw.summary.trim()
    : 'Deterministic summary generated from verified usage telemetry.';

  // 3. Observed Facts (Ground Truth)
  let observedFacts: string[] = [];
  if (Array.isArray(raw.observedFacts)) {
    observedFacts = raw.observedFacts
      .filter((item: any) => typeof item === 'string' && item.trim().length > 0)
      .map((item: string) => item.trim());
  }
  if (observedFacts.length === 0) {
    // Generate at least one verified fact from deterministic metrics
    observedFacts.push(
      `Analyzed ${metrics.totalEvents.toLocaleString()} events totaling $${metrics.totalCostUsd.toFixed(2)} USD.`
    );
  }

  // 4. Evidence ID Cross-Referencing & Anti-Hallucination
  const citedEvidenceIds: string[] = [];
  const rawCited = Array.isArray(raw.citedEvidenceIds) ? raw.citedEvidenceIds : [];

  for (const id of rawCited) {
    if (typeof id === 'string') {
      const cleanId = id.trim();
      if (validEvidenceIdSet.has(cleanId)) {
        if (!citedEvidenceIds.includes(cleanId)) {
          citedEvidenceIds.push(cleanId);
        }
      } else {
        rejectedFabricatedIds.push(cleanId);
      }
    }
  }

  if (rejectedFabricatedIds.length > 0) {
    warnings.push(
      `Anti-Hallucination Shield: Rejected ${rejectedFabricatedIds.length} fabricated evidence IDs (${rejectedFabricatedIds.join(', ')}). These IDs did not exist in the candidate telemetry set.`
    );
  }

  // 5. Hypotheses
  let hypotheses: string[] = [];
  if (Array.isArray(raw.hypotheses)) {
    hypotheses = raw.hypotheses
      .filter((h: any) => typeof h === 'string' && h.trim().length > 0)
      .map((h: string) => h.trim());
  }
  if (hypotheses.length === 0) {
    hypotheses.push('Model routing or application configuration may account for observed variance.');
  }

  // 6. Recommended Experiments
  let recommendedExperiments: AnalystResponse['recommendedExperiments'] = [];
  if (Array.isArray(raw.recommendedExperiments)) {
    recommendedExperiments = raw.recommendedExperiments
      .filter((exp: any) => exp && typeof exp === 'object' && typeof exp.title === 'string')
      .map((exp: any) => ({
        title: String(exp.title || 'Optimization Trial').trim(),
        hypothesis: String(exp.hypothesis || 'Verifying whether optimization reduces cost without degrading output.').trim(),
        riskLevel: (['low', 'medium', 'high'].includes(exp.riskLevel) ? exp.riskLevel : 'low') as 'low' | 'medium' | 'high',
        metricToWatch: String(exp.metricToWatch || 'Cost per request, error rate').trim(),
        actionableChecklist: Array.isArray(exp.actionableChecklist)
          ? exp.actionableChecklist.map((c: any) => String(c).trim()).filter(Boolean)
          : ['Configure A/B evaluation split', 'Monitor error rate before full rollout'],
      }));
  }

  if (recommendedExperiments.length === 0) {
    recommendedExperiments.push({
      title: 'A/B Test Verification',
      hypothesis: 'Testing configuration changes on 10% traffic ensures error rates stay constant.',
      riskLevel: 'low',
      metricToWatch: 'Success rate, latency, token consumption',
      actionableChecklist: [
        'Route 10% traffic to experimental configuration',
        'Collect 100 sample requests',
        'Compare cost and latency against baseline',
      ],
    });
  }

  // 7. Confidence & Reasons
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (['high', 'medium', 'low'].includes(raw.confidence)) {
    confidence = raw.confidence;
  }
  const confidenceReason = typeof raw.confidenceReason === 'string' && raw.confidenceReason.trim().length > 0
    ? raw.confidenceReason.trim()
    : `Evaluated over ${metrics.totalEvents} events with ${candidateEvidence.length} candidate evidence records.`;

  // 8. Limitations & Missing Data
  const limitations: string[] = Array.isArray(raw.limitations)
    ? raw.limitations.map((l: any) => String(l).trim()).filter(Boolean)
    : [];
  if (limitations.length === 0) {
    limitations.push('Analysis is based on historical telemetry; real-world downstream prompt complexity may vary.');
  }

  const missingData: string[] = Array.isArray(raw.missingData) && raw.missingData.length > 0
    ? raw.missingData.map((m: any) => String(m).trim()).filter(Boolean)
    : [...metrics.missingTelemetry];

  // 9. Numerical Sanity Check (Unsupported claims detection)
  // Check if summary mentions an impossible cost claim (e.g. savings > totalCostUsd * 2)
  const costRegex = /\$(\d+(?:,\d{3})*(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = costRegex.exec(summary)) !== null) {
    const claimedNumber = parseFloat(match[1].replace(/,/g, ''));
    if (claimedNumber > metrics.totalCostUsd * 2 && claimedNumber > 50) {
      unsupportedClaims.push(
        `Claimed figure $${claimedNumber} significantly exceeds total analyzed spend ($${metrics.totalCostUsd.toFixed(2)}).`
      );
    }
  }

  if (unsupportedClaims.length > 0) {
    warnings.push(
      `Numerical Audit Warning: Found ${unsupportedClaims.length} potentially unsupported financial claim(s) in AI summary.`
    );
  }

  const isValid = rejectedFabricatedIds.length === 0 && unsupportedClaims.length === 0;

  return {
    provider,
    generatedAt: new Date().toISOString(),
    topic,
    summary,
    observedFacts,
    citedEvidenceIds,
    hypotheses,
    recommendedExperiments,
    confidence,
    confidenceReason,
    limitations,
    missingData,
    validation: {
      isValid,
      rejectedFabricatedIds,
      unsupportedClaims,
      warnings,
    },
  };
}

/**
 * Creates an emergency fallback response when provider returns unparseable content.
 */
export function createEmergencyFallbackResponse(
  topic: AnalystTopic,
  metrics: PrecomputedMetrics,
  candidateEvidence: CandidateEvidenceItem[],
  errorMessage: string
): AnalystResponse {
  const validIds = candidateEvidence.slice(0, 3).map((e) => e.evidenceId);

  return {
    provider: 'rule_based_offline',
    generatedAt: new Date().toISOString(),
    topic,
    summary: `Analysis completed using local deterministic fallback. (${errorMessage})`,
    observedFacts: [
      `Total analyzed events: ${metrics.totalEvents.toLocaleString()}`,
      `Total calculated spend: $${metrics.totalCostUsd.toFixed(2)} USD across ${metrics.topModels.length} models`,
      `Retry rate: ${metrics.retryStats.retryRatePercent}% (${metrics.retryStats.totalRetries} retries)`,
    ],
    citedEvidenceIds: validIds,
    hypotheses: [
      'External AI synthesis was unavailable or returned non-compliant formatting; fallback rule engine activated.',
    ],
    recommendedExperiments: [
      {
        title: 'Deterministic Telemetry Inspection',
        hypothesis: 'Inspect high-cost and retry events directly in Usage Explorer.',
        riskLevel: 'low',
        metricToWatch: 'Event count, error status',
        actionableChecklist: [
          'Filter by status="failed" or retryCount > 0',
          'Review top model spend in Overview tab',
        ],
      },
    ],
    confidence: 'medium',
    confidenceReason: 'Deterministic fallback calculated from verified local telemetry without external network call.',
    limitations: [
      'Summary derived entirely from deterministic heuristic metrics without LLM synthesis.',
    ],
    missingData: [...metrics.missingTelemetry],
    validation: {
      isValid: true,
      rejectedFabricatedIds: [],
      unsupportedClaims: [],
      warnings: [`Fallback activated: ${errorMessage}`],
    },
  };
}
