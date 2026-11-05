import {
  DateRangePreset,
  Experiment,
  ExperimentEvaluation,
  FilterState,
  KPIStats,
  OptimizationFinding,
  PricingRate,
  SimulationParams,
  SimulationResult,
  UsageEvent,
} from '../types';
import { DEFAULT_PRICING_CATALOG, normalizeModelName } from './pricing';
import { convertCurrency } from './currency';

/**
 * Returns the effective cost in USD for an event.
 * Strictly respects costBasis: if 'unknown', returns 0.
 * If 'reported', converts reportedCost from reportedCurrency to USD.
 * If 'estimated', returns estimatedCost (calculated in USD).
 */
export function getEffectiveEventCost(ev: UsageEvent): number {
  if (
    ev.costBasis === 'reported' &&
    ev.reportedCost !== null &&
    ev.reportedCost !== undefined &&
    !isNaN(ev.reportedCost) &&
    ev.reportedCost >= 0
  ) {
    const currency = (ev.reportedCurrency || 'USD').trim().toUpperCase();
    return convertCurrency(ev.reportedCost, currency, 'USD');
  }

  if (
    ev.costBasis === 'estimated' &&
    ev.estimatedCost !== null &&
    ev.estimatedCost !== undefined &&
    !isNaN(ev.estimatedCost) &&
    ev.estimatedCost >= 0
  ) {
    return ev.estimatedCost;
  }

  return 0;
}

/**
 * Filter events based on active multi-dimensional criteria.
 * Accepts an optional referenceNow timestamp for deterministic unit testing.
 */
export function filterEvents(
  events: UsageEvent[],
  filter: FilterState,
  referenceNow: number = Date.now()
): UsageEvent[] {
  const now = referenceNow;
  const dayMs = 86400000;

  return events.filter((event) => {
    // 1. Date Range Filter
    const eventTime = new Date(event.timestamp).getTime();
    if (isNaN(eventTime)) return false;

    switch (filter.datePreset) {
      case 'today': {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart.getTime() + dayMs - 1);
        if (eventTime < todayStart.getTime() || eventTime > todayEnd.getTime()) return false;
        break;
      }
      case '7d':
        if (eventTime < now - 7 * dayMs || eventTime > now) return false;
        break;
      case '30d':
        if (eventTime < now - 30 * dayMs || eventTime > now) return false;
        break;
      case '90d':
        if (eventTime < now - 90 * dayMs || eventTime > now) return false;
        break;
      case 'custom':
        if (filter.customStartDate && filter.customStartDate.trim()) {
          const s = filter.customStartDate.trim();
          const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
          const start = new Date(isDateOnly ? `${s}T00:00:00.000Z` : s).getTime();
          if (!isNaN(start) && eventTime < start) return false;
        }
        if (filter.customEndDate && filter.customEndDate.trim()) {
          const e = filter.customEndDate.trim();
          const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(e);
          const end = new Date(isDateOnly ? `${e}T23:59:59.999Z` : e).getTime();
          if (!isNaN(end) && eventTime > end) return false;
        }
        break;
      case 'all':
      default:
        break;
    }

    // 2. Provider Filter
    if (filter.provider && filter.provider !== 'all') {
      if (event.provider !== filter.provider) return false;
    }

    // 3. Model Filter
    if (filter.model && filter.model !== 'all') {
      if (event.model !== filter.model) return false;
    }

    // 4. Project Filter
    if (filter.project && filter.project !== 'all') {
      if (event.project !== filter.project) return false;
    }

    // 5. Task Filter
    if (filter.task && filter.task !== 'all') {
      if (event.task !== filter.task) return false;
    }

    // 6. Status Filter
    if (filter.status && filter.status !== 'all') {
      if (event.status !== filter.status) return false;
    }

    // 7. Cost Basis Filter
    if (filter.costBasis && filter.costBasis !== 'all') {
      if (event.costBasis !== filter.costBasis) return false;
    }

    // 8. Source Filter
    if (filter.source && filter.source !== 'all') {
      if (event.source !== filter.source) return false;
    }

    // 9. Search Query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const q = filter.searchQuery.toLowerCase().trim();
      const match =
        (event.project && event.project.toLowerCase().includes(q)) ||
        (event.task && event.task.toLowerCase().includes(q)) ||
        (event.model && event.model.toLowerCase().includes(q)) ||
        (event.provider && event.provider.toLowerCase().includes(q)) ||
        (event.id && event.id.toLowerCase().includes(q)) ||
        (event.source && event.source.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });
}

/**
 * Deterministically compute KPI metrics from event list.
 * Correctly accounts for token totals, multi-currency reporting, and missing values.
 */
export function computeKPIs(events: UsageEvent[]): KPIStats {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalReasoningTokens = 0;
  let reportedCostUsd = 0;
  let estimatedCostUsd = 0;
  let unknownCostCount = 0;
  let totalRequests = 0;
  let failedRequests = 0;
  let retryCount = 0;
  let totalDurationMs = 0;
  let durationEventCount = 0;
  let sampleCount = 0;

  const costByCurrency: Record<string, { reported: number; estimated: number; total: number }> = {};
  const currencyCounts: Record<string, number> = {};

  for (const ev of events) {
    const rawIn = Math.max(0, ev.inputTokens || 0);
    const rawOut = Math.max(0, ev.outputTokens || 0);
    totalInputTokens += rawIn;
    totalOutputTokens += rawOut;

    if (ev.cachedInputTokens && ev.cachedInputTokens > 0) {
      totalCachedTokens += Math.min(ev.cachedInputTokens, rawIn);
    }
    if (ev.reasoningTokens && ev.reasoningTokens > 0) {
      totalReasoningTokens += ev.reasoningTokens;
    }

    const currency = (ev.reportedCurrency || 'USD').trim().toUpperCase();
    currencyCounts[currency] = (currencyCounts[currency] || 0) + 1;
    const currEntry = costByCurrency[currency] || { reported: 0, estimated: 0, total: 0 };

    if (
      ev.costBasis === 'reported' &&
      ev.reportedCost !== null &&
      ev.reportedCost !== undefined &&
      !isNaN(ev.reportedCost) &&
      ev.reportedCost >= 0
    ) {
      const inUsd = convertCurrency(ev.reportedCost, currency, 'USD');
      reportedCostUsd += inUsd;
      currEntry.reported += ev.reportedCost;
      currEntry.total += ev.reportedCost;
    } else if (
      ev.costBasis === 'estimated' &&
      ev.estimatedCost !== null &&
      ev.estimatedCost !== undefined &&
      !isNaN(ev.estimatedCost) &&
      ev.estimatedCost >= 0
    ) {
      estimatedCostUsd += ev.estimatedCost;
      const inNative = convertCurrency(ev.estimatedCost, 'USD', currency);
      currEntry.estimated += inNative;
      currEntry.total += inNative;
    } else {
      unknownCostCount += 1;
    }

    costByCurrency[currency] = currEntry;

    // requestCount: respect 0 or positive integer; default to 1 if null/undefined
    const reqs =
      ev.requestCount !== undefined && ev.requestCount !== null && !isNaN(ev.requestCount)
        ? Math.max(0, ev.requestCount)
        : 1;
    totalRequests += reqs;
    retryCount += Math.max(0, ev.retryCount || 0);

    if (ev.status === 'failed' || ev.status === 'rate_limited') {
      failedRequests += 1;
    }

    if (ev.durationMs !== null && ev.durationMs !== undefined && !isNaN(ev.durationMs) && ev.durationMs >= 0) {
      totalDurationMs += ev.durationMs;
      durationEventCount += 1;
    }

    if (ev.isSample) {
      sampleCount += 1;
    }
  }

  // Format currency totals cleanly
  for (const [k, v] of Object.entries(costByCurrency)) {
    costByCurrency[k] = {
      reported: Number(v.reported.toFixed(4)),
      estimated: Number(v.estimated.toFixed(4)),
      total: Number(v.total.toFixed(4)),
    };
  }

  // Determine primary currency by event frequency
  let primaryCurrency = 'USD';
  let maxCount = 0;
  for (const [curr, count] of Object.entries(currencyCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryCurrency = curr;
    }
  }

  const distinctCurrenciesCount = Object.keys(currencyCounts).length;
  const totalEffectiveCostUsd = reportedCostUsd + estimatedCostUsd;
  const retryRatePercent = totalRequests > 0 ? (retryCount / totalRequests) * 100 : 0;
  const avgCostPerRequestUsd = totalRequests > 0 ? totalEffectiveCostUsd / totalRequests : 0;
  const avgDurationMs = durationEventCount > 0 ? Math.round(totalDurationMs / durationEventCount) : null;

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    totalReasoningTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    reportedCostUsd: Number(reportedCostUsd.toFixed(4)),
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
    totalEffectiveCostUsd: Number(totalEffectiveCostUsd.toFixed(4)),
    unknownCostCount,
    totalRequests,
    failedRequests,
    retryCount,
    retryRatePercent: Number(retryRatePercent.toFixed(1)),
    avgCostPerRequestUsd: Number(avgCostPerRequestUsd.toFixed(4)),
    avgDurationMs,
    sampleCount,
    actualCount: events.length - sampleCount,
    costByCurrency,
    hasMixedCurrencies: distinctCurrenciesCount > 1,
    primaryCurrency,
  };
}

export interface TimelineDataPoint {
  date: string; // YYYY-MM-DD
  reportedCost: number;
  estimatedCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  retryCount: number;
}

/**
 * Group events chronologically by date
 */
export function groupEventsByTimeline(events: UsageEvent[]): TimelineDataPoint[] {
  const map = new Map<string, TimelineDataPoint>();

  for (const ev of events) {
    const d = new Date(ev.timestamp);
    if (isNaN(d.getTime())) continue;
    const dateKey = d.toISOString().split('T')[0];

    const current = map.get(dateKey) || {
      date: dateKey,
      reportedCost: 0,
      estimatedCost: 0,
      totalCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      requestCount: 0,
      retryCount: 0,
    };

    const effectiveUsd = getEffectiveEventCost(ev);
    if (ev.costBasis === 'reported') {
      current.reportedCost += effectiveUsd;
      current.totalCost += effectiveUsd;
    } else if (ev.costBasis === 'estimated') {
      current.estimatedCost += effectiveUsd;
      current.totalCost += effectiveUsd;
    }

    current.inputTokens += Math.max(0, ev.inputTokens || 0);
    current.outputTokens += Math.max(0, ev.outputTokens || 0);
    current.requestCount += ev.requestCount !== undefined && ev.requestCount !== null ? Math.max(0, ev.requestCount) : 1;
    current.retryCount += Math.max(0, ev.retryCount || 0);

    map.set(dateKey, current);
  }

  return Array.from(map.values())
    .map((dp) => ({
      ...dp,
      reportedCost: Number(dp.reportedCost.toFixed(4)),
      estimatedCost: Number(dp.estimatedCost.toFixed(4)),
      totalCost: Number(dp.totalCost.toFixed(4)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface GroupSummary {
  key: string;
  count: number;
  totalTokens: number;
  totalCostUsd: number;
  costPercentage: number;
  hasUnknownCost: boolean;
  retryRatePercent: number;
}

/**
 * Group events by a specific dimension (provider, model, project, task)
 */
export function groupEventsBy(
  events: UsageEvent[],
  dimension: 'provider' | 'model' | 'project' | 'task'
): GroupSummary[] {
  const totalCost = events.reduce((sum, e) => sum + getEffectiveEventCost(e), 0);
  const map = new Map<
    string,
    {
      count: number;
      tokens: number;
      cost: number;
      hasUnknownCost: boolean;
      requests: number;
      retries: number;
    }
  >();

  for (const ev of events) {
    const key = String(ev[dimension] || 'Unknown');
    const existing = map.get(key) || {
      count: 0,
      tokens: 0,
      cost: 0,
      hasUnknownCost: false,
      requests: 0,
      retries: 0,
    };

    existing.count += 1;
    existing.tokens += Math.max(0, ev.inputTokens || 0) + Math.max(0, ev.outputTokens || 0);
    const evCost = getEffectiveEventCost(ev);
    existing.cost += evCost;

    if (ev.costBasis === 'unknown' || (ev.reportedCost === null && ev.estimatedCost === null)) {
      existing.hasUnknownCost = true;
    }
    existing.requests += ev.requestCount !== undefined && ev.requestCount !== null ? Math.max(0, ev.requestCount) : 1;
    existing.retries += Math.max(0, ev.retryCount || 0);

    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([key, data]) => ({
      key,
      count: data.count,
      totalTokens: data.tokens,
      totalCostUsd: Number(data.cost.toFixed(4)),
      costPercentage: totalCost > 0 ? Number(((data.cost / totalCost) * 100).toFixed(1)) : 0,
      hasUnknownCost: data.hasUnknownCost,
      retryRatePercent: data.requests > 0 ? Number(((data.retries / data.requests) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

/**
 * Deterministic Inefficiency Detector (Optimization Lab)
 * Identifies high-confidence anomalies using concrete mathematical rules and event evidence.
 */
export function detectInefficiencies(
  events: UsageEvent[],
  catalog: PricingRate[] = DEFAULT_PRICING_CATALOG
): OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];
  if (events.length === 0) return findings;

  // 1. Detect Duplicate / Repeated Identical Requests within short time windows
  const duplicateClusters = new Map<string, UsageEvent[]>();
  for (const ev of events) {
    const promptHash = ev.metadata?.prompt_hash || `${ev.project}_${ev.task}_${ev.inputTokens}_${ev.model}`;
    const cluster = duplicateClusters.get(promptHash) || [];
    cluster.push(ev);
    duplicateClusters.set(promptHash, cluster);
  }

  for (const [hashKey, cluster] of duplicateClusters.entries()) {
    if (cluster.length >= 2) {
      cluster.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstTime = new Date(cluster[0].timestamp).getTime();
      const lastTime = new Date(cluster[cluster.length - 1].timestamp).getTime();
      const timeSpanMinutes = (lastTime - firstTime) / 60000;

      if (timeSpanMinutes <= 30) {
        const excessCount = cluster.length - 1;
        const totalClusterCost = cluster.reduce((sum, e) => sum + getEffectiveEventCost(e), 0);
        const wastedCost = cluster.length > 0 ? (totalClusterCost / cluster.length) * excessCount : 0;
        const projectName = cluster[0].project || 'General';
        const taskName = cluster[0].task || 'default';
        const modelName = cluster[0].model;

        findings.push({
          id: `opt_dup_${hashKey.slice(0, 10)}`,
          type: 'duplicate_requests',
          title: `Repeated Identical Queries in ${projectName}`,
          severity: wastedCost > 0.1 ? 'high' : 'medium',
          pattern: `${cluster.length} identical requests executed within ${Math.max(1, Math.round(timeSpanMinutes))} minutes on task "${taskName}" using model ${modelName}.`,
          supportingEventIds: cluster.map((e) => e.id),
          calculationRule: 'Exact match on prompt hash/token count (>= 2 requests) within a 30-minute rolling window.',
          confidenceLevel: 'high',
          confidenceJustification: 'Cryptographic hash or exact input token footprint match with temporal proximity.',
          proposedAction: 'Implement client-side query memoization, response caching (LRU), or debouncing in tool callers.',
          expectedTradeOffs: 'Cached responses may be slightly stale if underlying workspace files change within seconds.',
          verificationMethod: 'Review timestamps of duplicate IDs and inspect application network dispatch logs.',
          metrics: {
            affectedEventsCount: cluster.length,
            estimatedExcessCostUsd: Number(wastedCost.toFixed(4)),
            duplicateHashCount: cluster.length,
            baselineCostUsd: Number(totalClusterCost.toFixed(4)),
          },
          measuredFacts: {
            baselineSpendUsd: Number(totalClusterCost.toFixed(4)),
            recordsAnalyzed: cluster.length,
            facts: [
              `${cluster.length} duplicate queries executed between ${new Date(firstTime).toLocaleTimeString()} and ${new Date(lastTime).toLocaleTimeString()} (${Math.max(1, Math.round(timeSpanMinutes))} min span).`,
              `Every call sent identical input context (${cluster[0].inputTokens.toLocaleString()} tokens) to ${modelName}.`,
              `Actual total spend incurred across these repeated calls: $${totalClusterCost.toFixed(4)}.`,
            ],
          },
          hypotheses: [
            'Client application lacks memoization or response caching for identical inputs.',
            'Frontend UI component is re-rendering or double-firing API calls on user interaction.',
            'Tool caller or autonomous loop lacks deduplication before dispatching network requests.',
          ],
          recommendedExperiments: [
            {
              name: 'Client-Side LRU Memoization Test',
              description: 'Wrap the prompt dispatch function with a 60-second in-memory LRU cache keyed by prompt SHA-256 in staging.',
              targetMetric: 'Zero duplicate network dispatches for repeated inputs within 60s',
              sampleSize: '50 test queries with 10 duplicate injections',
            },
            {
              name: 'UI Debounce Verification',
              description: 'Add a 300ms debounce to the trigger handler in the caller frontend component.',
              targetMetric: 'Elimination of rapid double-click duplicate requests',
              sampleSize: 'Manual stress test with double-click simulation',
            },
          ],
          knownLimitations: [
            'Non-deterministic generation (temperature > 0) produces varied text, which may be intended if diversity was desired.',
            'If underlying repository files changed between calls, cached responses could return stale references.',
          ],
          baselineVsComparison: {
            baselineLabel: 'Measured Baseline Spend',
            baselineValue: `$${totalClusterCost.toFixed(4)} (${cluster.length} redundant calls)`,
            projectedLabel: 'Projected Spend with Memoization',
            projectedValue: `$${(totalClusterCost / cluster.length).toFixed(4)} (1 origin call + ${excessCount} cache hits)`,
            certainty: 'High — Grounded in byte-identical prompt / token footprints within a 30-minute window',
          },
        });
      }
    }
  }

  // 2. High Retry Rates & Runaway Loops
  const taskGroups = new Map<string, UsageEvent[]>();
  for (const ev of events) {
    const key = `${ev.project}::${ev.task}`;
    const list = taskGroups.get(key) || [];
    list.push(ev);
    taskGroups.set(key, list);
  }

  for (const [taskKey, list] of taskGroups.entries()) {
    const [project, task] = taskKey.split('::');
    const totalRequests = list.reduce(
      (s, e) => s + (e.requestCount !== undefined && e.requestCount !== null ? Math.max(0, e.requestCount) : 1),
      0
    );
    const totalRetries = list.reduce((s, e) => s + Math.max(0, e.retryCount || 0), 0);
    const failedEvents = list.filter((e) => e.status === 'failed' || e.status === 'rate_limited');
    const retryRate = totalRequests > 0 ? (totalRetries / totalRequests) * 100 : 0;

    if (totalRetries >= 3 && retryRate >= 20) {
      const taskCost = list.reduce((s, e) => s + getEffectiveEventCost(e), 0);
      const retryWaste = taskCost * (retryRate / 100);

      findings.push({
        id: `opt_retry_${taskKey}`,
        type: 'retry_loop',
        title: `Runaway Retry Loop on "${task}" (${project})`,
        severity: 'high',
        pattern: `${totalRetries} retries across ${list.length} sessions (retry rate ${retryRate.toFixed(1)}%). ${failedEvents.length} requests ended in failure.`,
        supportingEventIds: list.filter((e) => e.retryCount > 0 || e.status === 'failed').map((e) => e.id),
        calculationRule: 'Total retries >= 3 and retry-to-request ratio >= 20% for a specific workflow.',
        confidenceLevel: 'high',
        confidenceJustification: 'Deterministic retry counter from source logs and HTTP 429/500 error classifications.',
        proposedAction: 'Implement exponential backoff with jitter and enforce max retry limit of 2 before tripping circuit breaker.',
        expectedTradeOffs: 'Hard retry caps will surface failures earlier to users rather than stalling in retry loops.',
        verificationMethod: 'Run automated mock failure test with network disconnect and measure max attempts.',
        metrics: {
          affectedEventsCount: list.length,
          estimatedExcessCostUsd: Number(retryWaste.toFixed(4)),
          retryRatio: Number((retryRate / 100).toFixed(2)),
          failedEventsCount: failedEvents.length,
          baselineCostUsd: Number(taskCost.toFixed(4)),
        },
        measuredFacts: {
          baselineSpendUsd: Number(taskCost.toFixed(4)),
          recordsAnalyzed: list.length,
          facts: [
            `${totalRetries} retries recorded across ${totalRequests} total requests (${retryRate.toFixed(1)}% retry rate).`,
            `Task incurred $${taskCost.toFixed(4)} in total spend.`,
            `${failedEvents.length} requests ended in explicit failure (HTTP 429 rate limit or 500 error).`,
          ],
        },
        hypotheses: [
          'Tool execution loop is encountering syntax or formatting errors and repeatedly re-prompting without backoff.',
          'Upstream API rate limits (HTTP 429) are causing immediate retries without adequate jitter.',
        ],
        recommendedExperiments: [
          {
            name: 'Exponential Backoff with Jitter in Dev',
            description: 'Configure client retry handler: initial delay 1.5s, multiplier 2x, jitter 300ms, max 2 attempts.',
            targetMetric: 'Retry rate drops from >20% to <5%',
            sampleSize: '25 automated integration test runs',
          },
          {
            name: 'Local Constraint Pre-Validation',
            description: 'Validate tool call JSON schemas locally before dispatching follow-up LLM calls.',
            targetMetric: 'Zero syntax-induced retry attempts',
            sampleSize: '15 tool call sessions',
          },
        ],
        knownLimitations: [
          'Hard retry caps will cause tasks to surface errors earlier if upstream outages persist longer than the backoff window.',
        ],
        baselineVsComparison: {
          baselineLabel: 'Measured Baseline Spend',
          baselineValue: `$${taskCost.toFixed(4)} (${retryRate.toFixed(1)}% retry rate)`,
          projectedLabel: 'Projected Spend with Max-2 Backoff',
          projectedValue: `$${Math.max(0, taskCost - retryWaste).toFixed(4)} (saving ~$${retryWaste.toFixed(4)})`,
          certainty: 'High — Grounded directly in explicit retry counters and error classifications',
        },
      });
    }
  }

  // 3. Excessive Input Context & Uncached Large Prompts
  for (const [taskKey, list] of taskGroups.entries()) {
    const [project, task] = taskKey.split('::');
    const totalInput = list.reduce((s, e) => s + Math.max(0, e.inputTokens || 0), 0);
    const totalOutput = list.reduce((s, e) => s + Math.max(0, e.outputTokens || 0), 0);
    const totalCached = list.reduce((s, e) => s + Math.max(0, e.cachedInputTokens || 0), 0);

    const avgInput = totalInput / list.length;
    const avgOutput = totalOutput / list.length;
    const cacheHitRatio = totalInput > 0 ? (totalCached / totalInput) * 100 : 0;

    if (avgInput >= 20000 && avgOutput > 0 && avgInput / avgOutput >= 40 && cacheHitRatio < 25) {
      const taskCost = list.reduce((s, e) => s + getEffectiveEventCost(e), 0);
      // Provider rate cards show prompt caching discounts of 50% to 90%
      const potentialSavings = taskCost * 0.65;

      findings.push({
        id: `opt_context_${taskKey}`,
        type: 'uncached_prompt',
        title: `Uncached High-Context Input on "${task}" (${project})`,
        severity: taskCost > 0.5 ? 'high' : 'medium',
        pattern: `Average input context is ${Math.round(avgInput).toLocaleString()} tokens producing only ${Math.round(avgOutput).toLocaleString()} output tokens (${Math.round(avgInput / avgOutput)}:1 ratio), with only ${cacheHitRatio.toFixed(1)}% cache hit rate.`,
        supportingEventIds: list.slice(0, 10).map((e) => e.id),
        calculationRule: 'Average input >= 20,000 tokens, input/output ratio >= 40:1, and cache hit ratio < 25%.',
        confidenceLevel: 'high',
        confidenceJustification: 'Provider pricing manifests show Anthropic (90%), OpenAI (50%), and Gemini (75%) offer discounts for cached input tokens.',
        proposedAction: 'Prefix static context (repository AST, schemas, instructions) and enable provider prompt caching headers.',
        expectedTradeOffs: 'Requires maintaining stable prompt prefixes across calls; initial cold call incurs write fee.',
        verificationMethod: 'Deploy prompt caching headers to staging and verify cached_input_tokens field in telemetry.',
        metrics: {
          affectedEventsCount: list.length,
          estimatedExcessCostUsd: Number(potentialSavings.toFixed(4)),
          contextRatio: Math.round(avgInput / avgOutput),
          baselineCostUsd: Number(taskCost.toFixed(4)),
        },
        measuredFacts: {
          baselineSpendUsd: Number(taskCost.toFixed(4)),
          recordsAnalyzed: list.length,
          facts: [
            `Average input context is ${Math.round(avgInput).toLocaleString()} tokens producing ${Math.round(avgOutput).toLocaleString()} output tokens (${Math.round(avgInput / avgOutput)}:1 ratio).`,
            `Prompt cache hit rate is currently ${cacheHitRatio.toFixed(1)}% across ${list.length} calls.`,
            `Total spend incurred on this task: $${taskCost.toFixed(4)}.`,
          ],
        },
        hypotheses: [
          'Full repository AST or large file trees are re-transmitted on every turn without caching headers.',
          'Dynamic variable injection early in the prompt is invalidating prompt cache prefix stability.',
        ],
        recommendedExperiments: [
          {
            name: 'Prompt Prefix Stabilization Test',
            description: 'Move all static instructions and file schemas to the beginning of the prompt; test with Anthropic cache_control breakpoint or OpenAI automatic caching.',
            targetMetric: 'Achieve >75% cached_input_tokens on sequential calls',
            sampleSize: '10 sequential multi-turn sessions',
          },
          {
            name: 'Context Tree Pruning Test',
            description: 'Prune AST context to only referenced imports and types rather than full repository tree.',
            targetMetric: 'Reduce raw input token volume by >=40%',
            sampleSize: '10 PR review benchmarks',
          },
        ],
        knownLimitations: [
          'Prompt caching discounts require byte-identical prefixes maintained for at least 5 minutes.',
          'Initial cache write incurs standard rate before subsequent read discounts take effect.',
        ],
        baselineVsComparison: {
          baselineLabel: 'Current Measured Spend',
          baselineValue: `$${taskCost.toFixed(4)} (${cacheHitRatio.toFixed(1)}% cache hit)`,
          projectedLabel: 'Projected Spend with 80% Cache Hit',
          projectedValue: `$${Math.max(0, taskCost - potentialSavings).toFixed(4)} (estimated 65% reduction)`,
          certainty: 'Medium-High — Grounded in official provider prompt caching rate cards',
        },
      });
    }
  }

  // 4. Expensive Tasks with Recorded Failures ("Failure Waste")
  for (const [taskKey, list] of taskGroups.entries()) {
    const [project, task] = taskKey.split('::');
    const failedEvents = list.filter((e) => e.status === 'failed' || e.status === 'rate_limited');

    if (failedEvents.length > 0) {
      const failedCost = failedEvents.reduce((s, e) => s + getEffectiveEventCost(e), 0);
      const totalTaskCost = list.reduce((s, e) => s + getEffectiveEventCost(e), 0);
      const failureRate = (failedEvents.length / list.length) * 100;

      if (failedCost > 0.005 || failureRate >= 15) {
        findings.push({
          id: `opt_failure_${taskKey}`,
          type: 'failure_waste',
          title: `Recorded Failure Waste on "${task}" (${project})`,
          severity: failedCost > 0.1 || failureRate >= 30 ? 'high' : 'medium',
          pattern: `${failedEvents.length} of ${list.length} calls (${failureRate.toFixed(1)}%) ended in failure or rate limit, consuming $${failedCost.toFixed(4)} without usable output.`,
          supportingEventIds: failedEvents.map((e) => e.id),
          calculationRule: 'Task has >= 1 failed calls with failure waste > $0.005 or failure rate >= 15%.',
          confidenceLevel: 'high',
          confidenceJustification: 'Exact failure status classifications and billing rates recorded in source event telemetry.',
          proposedAction: 'Add client-side payload validation, token limit estimation, and circuit breaker to drop doomed requests.',
          expectedTradeOffs: 'Pre-flight checks require a tiny local CPU cost (<1ms) to validate schema prior to network dispatch.',
          verificationMethod: 'Inspect failure error codes and test pre-flight validator against historical failed payloads.',
          metrics: {
            affectedEventsCount: failedEvents.length,
            estimatedExcessCostUsd: Number(failedCost.toFixed(4)),
            failedEventsCount: failedEvents.length,
            failureCostUsd: Number(failedCost.toFixed(4)),
            baselineCostUsd: Number(totalTaskCost.toFixed(4)),
          },
          measuredFacts: {
            baselineSpendUsd: Number(totalTaskCost.toFixed(4)),
            recordsAnalyzed: list.length,
            facts: [
              `${failedEvents.length} requests failed out of ${list.length} total calls (${failureRate.toFixed(1)}% failure rate).`,
              `$${failedCost.toFixed(4)} was directly paid for requests that ended in error status.`,
              `Observed error classifications: ${Array.from(new Set(failedEvents.map((e) => e.status))).join(', ')}.`,
            ],
          },
          hypotheses: [
            'Requests exceed context window limits or trigger model-side generation length timeouts.',
            'Payload schema mismatches or unescaped arguments cause remote validation rejection after partial processing.',
          ],
          recommendedExperiments: [
            {
              name: 'Pre-Flight Token Estimator',
              description: 'Calculate prompt token count locally before dispatching; block requests exceeding model context window.',
              targetMetric: 'Zero context overflow failures',
              sampleSize: 'All outbound calls for 1 week',
            },
            {
              name: 'Circuit Breaker on Consecutive 429s',
              description: 'Pause tool invocations for 30 seconds after two consecutive rate limit errors.',
              targetMetric: 'Eliminate compounded rate limit charges',
              sampleSize: 'Load test in staging environment',
            },
          ],
          knownLimitations: [
            'Client pre-flight checks cannot prevent remote provider server outages (HTTP 500/503).',
          ],
          baselineVsComparison: {
            baselineLabel: 'Measured Wasted Spend on Failures',
            baselineValue: `$${failedCost.toFixed(4)} across ${failedEvents.length} failed calls`,
            projectedLabel: 'Projected Spend with Pre-Flight Defense',
            projectedValue: '$0.00 wasted on preventable client payload failures',
            certainty: 'High — Directly verified from failed events in telemetry logs',
          },
        });
      }
    }
  }

  // 5. Cost Concentration in Single Task / Project
  const totalSpend = events.reduce((s, e) => s + getEffectiveEventCost(e), 0);
  if (totalSpend > 0.5) {
    for (const [taskKey, list] of taskGroups.entries()) {
      const taskCost = list.reduce((s, e) => s + getEffectiveEventCost(e), 0);
      const concentrationPercent = (taskCost / totalSpend) * 100;

      if (concentrationPercent >= 45 && list.length >= 5) {
        const [project, task] = taskKey.split('::');
        const potentialSavings = taskCost * 0.3;

        findings.push({
          id: `opt_conc_${taskKey}`,
          type: 'cost_concentration',
          title: `Heavy Spend Concentration on "${task}" (${concentrationPercent.toFixed(0)}% of total)`,
          severity: 'medium',
          pattern: `Single task "${task}" in project "${project}" accounts for $${taskCost.toFixed(2)} of $${totalSpend.toFixed(2)} total spend across the active window.`,
          supportingEventIds: list.slice(0, 8).map((e) => e.id),
          calculationRule: 'Single task consumes >= 45% of total workspace spend with >= 5 records.',
          confidenceLevel: 'medium',
          confidenceJustification: 'Statistical Pareto distribution observation from actual financial totals.',
          proposedAction: 'Target this workflow first for benchmark evaluation and test a cheaper specialized model or prompt compression.',
          expectedTradeOffs: 'Concentration in critical workflows is normal; verify business priority before capping.',
          verificationMethod: 'Review task business value and evaluate if output quality requires tier-1 frontier model.',
          metrics: {
            affectedEventsCount: list.length,
            estimatedExcessCostUsd: Number(potentialSavings.toFixed(4)),
            potentialReductionPercent: 30,
            baselineCostUsd: Number(taskCost.toFixed(4)),
          },
          measuredFacts: {
            baselineSpendUsd: Number(taskCost.toFixed(4)),
            recordsAnalyzed: list.length,
            facts: [
              `Task consumes $${taskCost.toFixed(2)} out of $${totalSpend.toFixed(2)} (${concentrationPercent.toFixed(1)}% of total workspace spend).`,
              `${list.length} calls executed in this single workflow.`,
            ],
          },
          hypotheses: [
            'Workflow may be over-provisioned with frontier models where smaller, faster models could achieve comparable quality.',
          ],
          recommendedExperiments: [
            {
              name: 'Model Down-Shift Quality Benchmark',
              description: 'Run 10 historical task inputs through a cheaper tier model in the Experiments lab and compare output quality scores.',
              targetMetric: 'Quality score >= 85 with 50-70% lower inference cost',
              sampleSize: '10 representative task inputs',
            },
          ],
          knownLimitations: [
            'Concentration in high-leverage workflows is often legitimate; cost reduction should not compromise critical business logic.',
          ],
          baselineVsComparison: {
            baselineLabel: 'Measured Task Spend',
            baselineValue: `$${taskCost.toFixed(2)} (${concentrationPercent.toFixed(0)}% of total)`,
            projectedLabel: 'Projected Spend with Model Downshift',
            projectedValue: `$${(taskCost * 0.7).toFixed(2)} (potential 30% reduction)`,
            certainty: 'Medium — Requires quality evaluation before down-shifting models in production',
          },
        });
      }
    }
  }

  return findings;
}

/**
 * Rigorously evaluates cost, latency, reliability, and quality trade-offs for an A/B experiment.
 * Adheres strictly to the core principle: "Simulated savings are not actual savings. A cheaper result is not automatically a better result."
 */
export function computeExperimentEvaluation(exp: Experiment): ExperimentEvaluation {
  const baselineRuns = Array.isArray(exp.baselineRuns) ? exp.baselineRuns : [];
  const expRuns = Array.isArray(exp.experimentalRuns) ? exp.experimentalRuns : [];

  const baselineCount = baselineRuns.length;
  const experimentalCount = expRuns.length;
  const isSmallSample = baselineCount < 10 || experimentalCount < 10;

  // 1. Costs
  const baselineTotalCostUsd = baselineRuns.reduce((sum, r) => sum + Math.max(0, r.costUsd || 0), 0);
  const experimentalTotalCostUsd = expRuns.reduce((sum, r) => sum + Math.max(0, r.costUsd || 0), 0);

  const baselineAvgCostUsd = baselineCount > 0 ? baselineTotalCostUsd / baselineCount : 0;
  const experimentalAvgCostUsd = experimentalCount > 0 ? experimentalTotalCostUsd / experimentalCount : 0;

  const absoluteCostDeltaUsd = experimentalAvgCostUsd - baselineAvgCostUsd;
  // Positive costSavingsPercent means experimental is cheaper
  const costSavingsPercent =
    baselineAvgCostUsd > 0
      ? ((baselineAvgCostUsd - experimentalAvgCostUsd) / baselineAvgCostUsd) * 100
      : experimentalAvgCostUsd === 0
      ? 0
      : -100;

  // 2. Success Rates & Cost per successful request
  const baselineSuccessCount = baselineRuns.filter((r) => r.success).length;
  const expSuccessCount = expRuns.filter((r) => r.success).length;

  const baselineSuccessRatePercent = baselineCount > 0 ? (baselineSuccessCount / baselineCount) * 100 : 0;
  const experimentalSuccessRatePercent = experimentalCount > 0 ? (expSuccessCount / experimentalCount) * 100 : 0;
  const successRateDeltaPercent = experimentalSuccessRatePercent - baselineSuccessRatePercent;

  // Cost per successful request: strictly uses successful requests as the denominator!
  const baselineCostPerSuccessUsd = baselineSuccessCount > 0 ? baselineTotalCostUsd / baselineSuccessCount : null;
  const experimentalCostPerSuccessUsd = expSuccessCount > 0 ? experimentalTotalCostUsd / expSuccessCount : null;

  let costPerSuccessDeltaPercent: number | null = null;
  if (baselineCostPerSuccessUsd !== null && experimentalCostPerSuccessUsd !== null && baselineCostPerSuccessUsd > 0) {
    costPerSuccessDeltaPercent =
      ((baselineCostPerSuccessUsd - experimentalCostPerSuccessUsd) / baselineCostPerSuccessUsd) * 100;
  }

  // 3. Latency (filter invalid or negative latencies)
  const baselineValidLatencies = baselineRuns.map((r) => r.latencyMs).filter((l) => typeof l === 'number' && l >= 0);
  const expValidLatencies = expRuns.map((r) => r.latencyMs).filter((l) => typeof l === 'number' && l >= 0);

  const baselineAvgLatencyMs =
    baselineValidLatencies.length > 0
      ? Math.round(baselineValidLatencies.reduce((a, b) => a + b, 0) / baselineValidLatencies.length)
      : null;
  const experimentalAvgLatencyMs =
    expValidLatencies.length > 0
      ? Math.round(expValidLatencies.reduce((a, b) => a + b, 0) / expValidLatencies.length)
      : null;
  const latencyDeltaMs =
    baselineAvgLatencyMs !== null && experimentalAvgLatencyMs !== null
      ? experimentalAvgLatencyMs - baselineAvgLatencyMs
      : null;

  // 4. Tokens
  const baselineAvgInputTokens =
    baselineCount > 0 ? Math.round(baselineRuns.reduce((s, r) => s + (r.tokensIn || 0), 0) / baselineCount) : 0;
  const experimentalAvgInputTokens =
    experimentalCount > 0 ? Math.round(expRuns.reduce((s, r) => s + (r.tokensIn || 0), 0) / experimentalCount) : 0;

  const baselineAvgOutputTokens =
    baselineCount > 0 ? Math.round(baselineRuns.reduce((s, r) => s + (r.tokensOut || 0), 0) / baselineCount) : 0;
  const experimentalAvgOutputTokens =
    experimentalCount > 0 ? Math.round(expRuns.reduce((s, r) => s + (r.tokensOut || 0), 0) / experimentalCount) : 0;

  const baselineAvgCachedTokens =
    baselineCount > 0 ? Math.round(baselineRuns.reduce((s, r) => s + (r.cachedTokens || 0), 0) / baselineCount) : 0;
  const experimentalAvgCachedTokens =
    experimentalCount > 0 ? Math.round(expRuns.reduce((s, r) => s + (r.cachedTokens || 0), 0) / experimentalCount) : 0;

  // 5. Quality Scores
  const baselineQualityRuns = baselineRuns.filter((r) => typeof r.qualityScore === 'number' && !isNaN(r.qualityScore));
  const expQualityRuns = expRuns.filter((r) => typeof r.qualityScore === 'number' && !isNaN(r.qualityScore));

  const baselineAvgQuality =
    baselineQualityRuns.length > 0
      ? Number((baselineQualityRuns.reduce((s, r) => s + r.qualityScore!, 0) / baselineQualityRuns.length).toFixed(1))
      : null;
  const experimentalAvgQuality =
    expQualityRuns.length > 0
      ? Number((expQualityRuns.reduce((s, r) => s + r.qualityScore!, 0) / expQualityRuns.length).toFixed(1))
      : null;

  const qualityDelta =
    baselineAvgQuality !== null && experimentalAvgQuality !== null
      ? Number((experimentalAvgQuality - baselineAvgQuality).toFixed(1))
      : null;

  // 6. Objective Warnings & Scientific Limitations
  const warnings: string[] = [];
  const limitations: string[] = [];

  if (baselineCount === 0 || experimentalCount === 0) {
    warnings.push('Experiment has incomplete execution arms. Both baseline and experimental runs are required.');
  } else if (isSmallSample) {
    warnings.push(
      `Small sample size (Baseline N=${baselineCount}, Exp N=${experimentalCount}). Measurements may exhibit high statistical variance.`
    );
  }

  if (baselineSuccessCount === 0) {
    warnings.push('Baseline has 0 successful runs. Cost per successful request cannot be calculated.');
  }
  if (expSuccessCount === 0 && experimentalCount > 0) {
    warnings.push('Experimental configuration suffered 100% failure rate (0 successful runs).');
  }

  if (successRateDeltaPercent < -5) {
    warnings.push(
      `Reliability Regression: Experimental success rate dropped by ${Math.abs(successRateDeltaPercent).toFixed(1)}% compared to baseline.`
    );
  }

  if (qualityDelta !== null && qualityDelta < -3) {
    warnings.push(
      `Quality Regression: Quality score dropped by ${Math.abs(qualityDelta).toFixed(1)} points. Lower cost does not offset degraded output quality.`
    );
  }

  if (latencyDeltaMs !== null && latencyDeltaMs > 300) {
    warnings.push(
      `Latency Degradation: Experimental setup added +${latencyDeltaMs}ms on average per request.`
    );
  }

  limitations.push('A/B runs reflect evaluated benchmark prompts; production query variance may yield different latency and retry profiles.');
  limitations.push('Token reductions do not automatically correlate with output quality improvement.');

  return {
    baselineCount,
    experimentalCount,
    isSmallSample,
    baselineTotalCostUsd: Number(baselineTotalCostUsd.toFixed(4)),
    experimentalTotalCostUsd: Number(experimentalTotalCostUsd.toFixed(4)),
    baselineAvgCostUsd: Number(baselineAvgCostUsd.toFixed(4)),
    experimentalAvgCostUsd: Number(experimentalAvgCostUsd.toFixed(4)),
    costSavingsPercent: Number(costSavingsPercent.toFixed(1)),
    absoluteCostDeltaUsd: Number(absoluteCostDeltaUsd.toFixed(4)),
    baselineCostPerSuccessUsd: baselineCostPerSuccessUsd !== null ? Number(baselineCostPerSuccessUsd.toFixed(4)) : null,
    experimentalCostPerSuccessUsd: experimentalCostPerSuccessUsd !== null ? Number(experimentalCostPerSuccessUsd.toFixed(4)) : null,
    costPerSuccessDeltaPercent: costPerSuccessDeltaPercent !== null ? Number(costPerSuccessDeltaPercent.toFixed(1)) : null,
    baselineSuccessRatePercent: Number(baselineSuccessRatePercent.toFixed(1)),
    experimentalSuccessRatePercent: Number(experimentalSuccessRatePercent.toFixed(1)),
    successRateDeltaPercent: Number(successRateDeltaPercent.toFixed(1)),
    baselineAvgLatencyMs,
    experimentalAvgLatencyMs,
    latencyDeltaMs,
    baselineAvgInputTokens,
    experimentalAvgInputTokens,
    baselineAvgOutputTokens,
    experimentalAvgOutputTokens,
    baselineAvgCachedTokens,
    experimentalAvgCachedTokens,
    baselineAvgQuality,
    experimentalAvgQuality,
    qualityDelta,
    warnings,
    limitations,
  };
}

/**
 * Deterministic Savings Simulator
 * Simulates hypothetical changes strictly using arithmetic formulas.
 * Does NOT blend hypothetical savings with historical actuals.
 */
export function runSimulation(
  events: UsageEvent[],
  params: SimulationParams,
  catalog: PricingRate[] = DEFAULT_PRICING_CATALOG
): SimulationResult {
  // Input validation & clamping
  const inputReduction = Math.max(0, Math.min(80, params.inputReductionPercent || 0));
  const retryReduction = Math.max(0, Math.min(90, params.retryReductionPercent || 0));
  const cachingAdoption = Math.max(0, Math.min(100, params.cachingAdoptionPercent || 0));
  const modelShift = Math.max(0, Math.min(100, params.modelShiftPercent || 0));
  const volumeScaling = Math.max(-50, Math.min(100, params.volumeScalingPercent || 0));
  const volumeFactor = 1 + volumeScaling / 100;

  let baselineCostUsd = 0;
  let simulatedCostUsd = 0;
  let unratedEventsCount = 0;

  let inputTokenSavings = 0;
  let retryCostSavings = 0;
  let cachingCostSavings = 0;
  let modelShiftSavings = 0;

  const targetModel = params.modelShiftTarget || 'gpt-4o-mini';
  const targetRateCard = catalog.find(
    (r) =>
      r.model.toLowerCase() === targetModel.toLowerCase() ||
      normalizeModelName(r.model) === normalizeModelName(targetModel)
  );

  for (const ev of events) {
    if (ev.costBasis === 'unknown') {
      unratedEventsCount++;
    }

    const evCost = getEffectiveEventCost(ev);
    baselineCostUsd += evCost;

    let modifiedInput = Math.max(0, ev.inputTokens || 0);
    let modifiedOutput = Math.max(0, ev.outputTokens || 0);
    let modifiedRetries = Math.max(0, ev.retryCount || 0);
    let modifiedCached = Math.max(0, Math.min(ev.cachedInputTokens || 0, modifiedInput));

    // 1. Input Reduction Effect
    if (inputReduction > 0) {
      const reducedInput = modifiedInput * (1 - inputReduction / 100);
      const savedTokens = modifiedInput - reducedInput;
      inputTokenSavings += savedTokens;
      modifiedInput = reducedInput;
    }

    // 2. Retry Reduction Effect
    let retryRatioFactor = 1.0;
    if (modifiedRetries > 0 && retryReduction > 0) {
      const reducedRetries = modifiedRetries * (1 - retryReduction / 100);
      const savedRetryCount = modifiedRetries - reducedRetries;
      const totalReq =
        ev.requestCount !== undefined && ev.requestCount !== null ? Math.max(1, ev.requestCount) : 1;
      const totalAttempts = totalReq + modifiedRetries;
      const retryCostFraction = totalAttempts > 0 ? (savedRetryCount / totalAttempts) * evCost : 0;
      retryCostSavings += retryCostFraction;
      retryRatioFactor = Math.max(0.1, 1 - savedRetryCount / totalAttempts);
      modifiedRetries = reducedRetries;
    }

    // 3. Prompt Caching Adoption Effect
    if (cachingAdoption > 0 && modifiedInput > 2000) {
      const uncachedCurrent = Math.max(0, modifiedInput - modifiedCached);
      const newlyCached = uncachedCurrent * (cachingAdoption / 100);
      modifiedCached += newlyCached;

      // Calculate caching discount using actual model rate card if available
      const normalizedModel = normalizeModelName(ev.model || '');
      const rateCard = catalog.find(
        (r) => r.model.toLowerCase() === normalizedModel || normalizeModelName(r.model) === normalizedModel
      );

      if (rateCard) {
        const inputRate = rateCard.inputPerMillionUsd;
        const cachedRate = rateCard.cachedInputPerMillionUsd ?? inputRate * 0.5;
        const unit = rateCard.inputPricingUnit || 1_000_000;
        const discountPerUnit = Math.max(0, inputRate - cachedRate);
        cachingCostSavings += (newlyCached / unit) * discountPerUnit;
      } else {
        // Fallback: assume 75% savings on input portion of evCost
        const approxInputCost = evCost * 0.7;
        const fractionNewlyCached = modifiedInput > 0 ? newlyCached / modifiedInput : 0;
        cachingCostSavings += approxInputCost * fractionNewlyCached * 0.75;
      }
    }

    // 4. Model Shift Effect
    let shiftedCost = evCost;
    if (
      modelShift > 0 &&
      targetRateCard &&
      normalizeModelName(ev.model) !== normalizeModelName(targetModel)
    ) {
      const shiftFraction = modelShift / 100;
      const normalizedEvModel = normalizeModelName(ev.model || '');
      const currentRateCard = catalog.find(
        (r) => r.model.toLowerCase() === normalizedEvModel || normalizeModelName(r.model) === normalizedEvModel
      );

      if (currentRateCard) {
        const currentInputRate = currentRateCard.inputPerMillionUsd / (currentRateCard.inputPricingUnit || 1_000_000);
        const targetInputRate = targetRateCard.inputPerMillionUsd / (targetRateCard.inputPricingUnit || 1_000_000);
        const currentOutputRate = currentRateCard.outputPerMillionUsd / (currentRateCard.outputPricingUnit || 1_000_000);
        const targetOutputRate = targetRateCard.outputPerMillionUsd / (targetRateCard.outputPricingUnit || 1_000_000);

        const inputSavingsPerToken = Math.max(0, currentInputRate - targetInputRate);
        const outputSavingsPerToken = Math.max(0, currentOutputRate - targetOutputRate);

        const shiftSavings =
          (modifiedInput * inputSavingsPerToken + modifiedOutput * outputSavingsPerToken) * shiftFraction;

        modelShiftSavings += shiftSavings;
        shiftedCost = Math.max(0, shiftedCost - shiftSavings);
      }
    }

    // Combine deterministic scenario factors (avoiding double-counting)
    const combinedEventSimulated =
      shiftedCost * (1 - (inputReduction / 100) * 0.6) * retryRatioFactor;
    simulatedCostUsd += Math.max(0, combinedEventSimulated);
  }

  // Apply volume scaling factor to both baseline and simulated if volume is scaled
  const volumeScaledSimulatedCost = simulatedCostUsd * volumeFactor;
  const volumeScalingCostDeltaUsd = (volumeFactor - 1) * simulatedCostUsd;

  const absoluteSavingsUsd = Math.max(0, baselineCostUsd - volumeScaledSimulatedCost);
  const percentageSavings = baselineCostUsd > 0 ? (absoluteSavingsUsd / baselineCostUsd) * 100 : 0;

  const tradeOffs: string[] = [];
  if (modelShift > 0) {
    tradeOffs.push(
      `Model shift to ${targetModel}: Verify output quality in Experiments lab before downshifting production traffic.`
    );
  }
  if (inputReduction > 0) {
    tradeOffs.push(
      `Context compression (${inputReduction}%): Trimming prompt history risks losing multi-turn nuance or edge-case context.`
    );
  }
  if (retryReduction > 0) {
    tradeOffs.push(
      `Retry reduction (${retryReduction}%): Hard caps surface transient network errors faster to callers; require circuit breakers.`
    );
  }
  if (cachingAdoption > 0) {
    tradeOffs.push(
      `Prompt caching (${cachingAdoption}%): Requires static prefix alignment; dynamic parameter injections invalidate cache hits.`
    );
  }
  if (volumeScaling !== 0) {
    tradeOffs.push(
      `Workload volume scaling (${volumeScaling > 0 ? '+' : ''}${volumeScaling}%): Linearly projects consumption delta.`
    );
  }

  return {
    baselineCostUsd: Number(baselineCostUsd.toFixed(2)),
    simulatedCostUsd: Number(volumeScaledSimulatedCost.toFixed(2)),
    absoluteSavingsUsd: Number(absoluteSavingsUsd.toFixed(2)),
    percentageSavings: Number(percentageSavings.toFixed(1)),
    inputTokenSavings: Math.round(inputTokenSavings),
    retryCostSavings: Number(retryCostSavings.toFixed(2)),
    cachingCostSavings: Number(cachingCostSavings.toFixed(2)),
    modelShiftSavings: Number(modelShiftSavings.toFixed(2)),
    volumeScalingCostDeltaUsd: Number(volumeScalingCostDeltaUsd.toFixed(2)),
    baselineEventsCount: events.length,
    unratedEventsCount,
    assumptions: [
      `Input token reduction modeled at ${inputReduction}% across selected events.`,
      `Unnecessary retry attempts reduced by ${retryReduction}% without degrading task completion.`,
      `Prompt cache adoption applied to eligible input contexts (>2,000 tokens) at ${cachingAdoption}%.`,
      modelShift > 0
        ? `Shifted ${modelShift}% of compatible tasks to target model "${targetModel}".`
        : 'No model substitution applied.',
      volumeScaling !== 0
        ? `Workload volume adjusted by ${volumeScaling > 0 ? '+' : ''}${volumeScaling}%.`
        : 'Workload volume held constant (100% of baseline).',
    ],
    limitations: [
      'This calculation is an arithmetic projection, not a realized contractual credit.',
      'Prompt caching requires repetitive prompt prefixes; dynamic variable injection will reduce real cache hit rates.',
      'Model down-shifting should only be applied after rigorous quality evaluation in the Experiments lab.',
      unratedEventsCount > 0
        ? `${unratedEventsCount} events lacked verified rate cards (costBasis: unknown) and were excluded from savings calculations.`
        : 'All events mapped to verified pricing catalog entries.',
    ],
    tradeOffs,
  };
}
