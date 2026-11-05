/**
 * Rule-Based Offline Analyst Provider
 * Provides 100% deterministic analysis with zero network requests or third-party dependencies.
 * Ensures the platform is fully functional offline or without Gemini API keys.
 */

import {
  IAnalystProvider,
  AnalystRequest,
  AnalystResponse,
  RecommendedExperiment,
} from './types';
import { validateAnalystOutput } from './validator';

export class RuleBasedAnalystProvider implements IAnalystProvider {
  public readonly id = 'rule_based_offline';
  public readonly name = 'Offline Deterministic Rule Engine';

  public async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    return { available: true, reason: 'Offline deterministic rule engine is always available.' };
  }

  public async analyze(request: AnalystRequest): Promise<AnalystResponse> {
    const { topic, metrics, candidateEvidence, focusQuestion } = request;
    const topModel = metrics.topModels[0];
    const evidenceIds = candidateEvidence.slice(0, 4).map((e) => e.evidenceId);

    let summary = '';
    const observedFacts: string[] = [];
    const hypotheses: string[] = [];
    const recommendedExperiments: RecommendedExperiment[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'high';
    let confidenceReason = '';
    const limitations: string[] = [];

    // Construct topic-specific deterministic analysis
    switch (topic) {
      case 'spending_change': {
        const period = metrics.periodComparison;
        if (period) {
          const direction = period.deltaPercent >= 0 ? 'increased' : 'decreased';
          summary = `Spend ${direction} by ${Math.abs(period.deltaPercent)}% ($${Math.abs(period.deltaUsd).toFixed(2)} USD) between chronological halves of the telemetry window. The primary cost driver was ${period.primaryDriverModel}.`;
          observedFacts.push(
            `Baseline period spend was $${period.baselineCostUsd.toFixed(2)}, transitioning to $${period.currentCostUsd.toFixed(2)} in the comparison period.`,
            `Top model by total expenditure is ${topModel ? topModel.model : 'none'} accounting for ${topModel ? topModel.costSharePercent : 0}% ($${topModel ? topModel.costUsd.toFixed(2) : 0}) of total spend.`,
            `Total tokens consumed across all periods: ${(metrics.totalInputTokens + metrics.totalOutputTokens).toLocaleString()} tokens.`
          );
          hypotheses.push(
            `Shift in model selection or prompt length in ${period.primaryDriverModel} is the leading hypothesis for the cost shift.`,
            'Traffic volume change or increased task complexity could account for the remaining variance.'
          );
        } else {
          summary = `Analyzed ${metrics.totalEvents} events with cumulative expenditure of $${metrics.totalCostUsd.toFixed(2)} USD. Insufficient chronological spread to compute a 2-period delta.`;
          observedFacts.push(
            `Total recorded events: ${metrics.totalEvents}`,
            `Dominant model: ${topModel ? topModel.model : 'N/A'} ($${topModel ? topModel.costUsd.toFixed(2) : 0})`
          );
          hypotheses.push('Longer recording windows with multiple days of logs are needed for multi-period drift comparison.');
        }

        recommendedExperiments.push({
          title: `Prompt Length and Model Routing Audit for ${topModel ? topModel.model : 'Primary Model'}`,
          hypothesis: `Downgrading simple categorization tasks from ${topModel ? topModel.model : 'flagship'} to a cost-effective tier reduces cost by 40-70%.`,
          riskLevel: 'low',
          metricToWatch: 'Cost per 1k tokens, output quality score',
          actionableChecklist: [
            'Filter Usage Explorer by the top model and examine token length distribution',
            'Isolate short prompt tasks vs complex reasoning tasks',
            'Run a trial with a lighter tier model on 50 non-critical tasks',
          ],
        });
        confidence = metrics.totalEvents > 20 ? 'high' : 'medium';
        confidenceReason = `Calculated deterministically from ${metrics.totalEvents} timestamped events.`;
        break;
      }

      case 'retry_rates': {
        const stats = metrics.retryStats;
        summary = `Detected ${stats.totalRetries} retries across ${stats.eventsWithRetriesCount} events (${stats.retryRatePercent}% retry incidence). Recorded failure waste totals $${stats.failureWasteCostUsd.toFixed(2)} USD across ${stats.failedEventsCount} failed calls.`;

        observedFacts.push(
          `Retry rate stands at ${stats.retryRatePercent}% of all recorded requests.`,
          `Failed requests account for ${stats.failedEventsCount} events, wasting $${stats.failureWasteCostUsd.toFixed(2)} USD in unrecovered spend.`,
          `Candidate evidence includes ${candidateEvidence.filter((e) => e.retries > 0).length} verified retry events.`
        );

        if (stats.retryRatePercent > 10) {
          hypotheses.push(
            'High retry rate (>10%) strongly suggests aggressive immediate retries without exponential backoff or client-side rate limit throttling.',
            'Downstream upstream provider 429 (Rate Limit) or 503 (Overloaded) errors may be cascading across concurrent workers.'
          );
        } else {
          hypotheses.push(
            'Retry rate is within nominal operational boundaries (<10%), representing isolated transient network interruptions.'
          );
        }

        recommendedExperiments.push({
          title: 'Exponential Backoff with Jitter Implementation',
          hypothesis: 'Adding randomized jitter and a 2x backoff multiplier prevents retry storms and cuts failed retry tokens by >50%.',
          riskLevel: 'low',
          metricToWatch: 'Retry count, error recovery rate, p99 latency',
          actionableChecklist: [
            'Configure client SDK retry policy to use exponential backoff with full jitter (e.g. min 500ms, max 10s)',
            'Set maximum retry budget to 2 attempts per request',
            'Monitor failedEventsCount over 24 hours',
          ],
        });
        confidence = 'high';
        confidenceReason = `Based on direct counting of retryCount and status fields in telemetry.`;
        break;
      }

      case 'optimization_experiments': {
        const count = metrics.findingsSummary.length;
        const totalExcess = metrics.findingsSummary.reduce((s, f) => s + f.estimatedExcessCostUsd, 0);
        summary = `Identified ${count} verifiable optimization opportunities with an estimated recoverable waste of $${totalExcess.toFixed(2)} USD across active telemetry.`;

        for (const f of metrics.findingsSummary.slice(0, 3)) {
          observedFacts.push(
            `Finding: ${f.title} (${f.severity} severity) - Est. excess: $${f.estimatedExcessCostUsd.toFixed(2)} USD (${f.confidenceLevel} confidence)`
          );
        }
        if (observedFacts.length === 0) {
          observedFacts.push('No acute inefficiency patterns detected above trigger thresholds in current dataset.');
        }

        hypotheses.push(
          'Implementing prompt prefix caching and eliminating repeated duplicate requests represent the highest ROI levers with minimal engineering risk.'
        );

        recommendedExperiments.push(
          {
            title: 'Prompt Prefix Caching Verification',
            hypothesis: 'Structuring static system prompts at the beginning of requests enables provider-side cache hits (saving up to 80% on cached inputs).',
            riskLevel: 'low',
            metricToWatch: 'cachedInputTokens, cost per request',
            actionableChecklist: [
              'Move dynamic variables (timestamps, user inputs) to the very end of messages',
              'Keep the system instruction and tool declarations identical across calls',
              'Inspect cachedInputTokens in the Usage Explorer after deployment',
            ],
          },
          {
            title: 'Idempotency and Request Deduplication Gate',
            hypothesis: 'Adding SHA-256 fingerprinting on identical input prompts within 60-second windows eliminates redundant identical requests.',
            riskLevel: 'low',
            metricToWatch: 'Duplicate request count, gateway cache hit rate',
            actionableChecklist: [
              'Deploy an in-memory cache for deterministic queries',
              'Return cached completions for identical hashes within 10 minutes',
            ],
          }
        );
        confidence = 'high';
        confidenceReason = 'Prioritized according to deterministic mathematical rules from detectInefficiencies engine.';
        break;
      }

      case 'telemetry_audit':
      default: {
        const gapCount = metrics.missingTelemetry.length;
        summary = `Telemetry audit completed for ${metrics.totalEvents} events. Detected ${gapCount} telemetry coverage gap(s) that impact analytical certainty.`;

        observedFacts.push(
          `Dataset spans ${metrics.timeWindow.durationDays} day(s) from ${new Date(metrics.timeWindow.start).toLocaleDateString()} to ${new Date(metrics.timeWindow.end).toLocaleDateString()}.`,
          `Total events evaluated: ${metrics.totalEvents.toLocaleString()}, representing $${metrics.totalCostUsd.toFixed(2)} USD.`,
          `Number of identified data collection gaps: ${gapCount}`
        );

        hypotheses.push(
          'Enriching client-side logger wrappers with latency, cache tracking, and quality outcomes will significantly elevate confidence for model routing decisions.'
        );

        recommendedExperiments.push({
          title: 'Logger Instrumentation Enrichment',
          hypothesis: 'Recording durationMs and cachedInputTokens in client wrapper bridges 100% of telemetry gaps.',
          riskLevel: 'low',
          metricToWatch: 'Telemetry completeness percentage',
          actionableChecklist: [
            'Update logger to measure response time in milliseconds',
            'Record usage.prompt_tokens_details.cached_tokens from API completion responses',
            'Capture tenant/project tags in request headers',
          ],
        });
        confidence = gapCount === 0 ? 'high' : 'medium';
        confidenceReason = `Audit checks completeness of standard telemetry fields (duration, cache, cost, errors).`;
        break;
      }
    }

    if (focusQuestion) {
      observedFacts.push(`User focus query addressed: "${focusQuestion}"`);
    }

    limitations.push(
      'Deterministic analysis relies strictly on recorded parameters without qualitative understanding of prompt nuances.',
      'Cost estimations depend on active rate cards when reported provider billing is missing.'
    );

    const rawResponse = {
      summary,
      observedFacts,
      citedEvidenceIds: evidenceIds,
      hypotheses,
      recommendedExperiments,
      confidence,
      confidenceReason,
      limitations,
      missingData: [...metrics.missingTelemetry],
    };

    return validateAnalystOutput(
      rawResponse,
      topic,
      metrics,
      candidateEvidence,
      'rule_based_offline'
    );
  }
}
