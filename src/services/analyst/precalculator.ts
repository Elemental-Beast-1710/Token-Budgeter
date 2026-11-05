/**
 * Pre-calculator for AI Analyst
 * Pre-computes all statistical, financial, and comparison metrics deterministically
 * BEFORE any AI prompt is constructed. Guarantees that arithmetic is never delegated to an LLM.
 */

import { UsageEvent, OptimizationFinding } from '../../types';
import { getEffectiveEventCost, detectInefficiencies } from '../analytics';
import { detectMissingTelemetry } from './sanitizer';
import { PrecomputedMetrics } from './types';

export function computePrecalculatedMetrics(
  events: UsageEvent[],
  existingFindings?: OptimizationFinding[]
): PrecomputedMetrics {
  if (!events || events.length === 0) {
    return {
      totalEvents: 0,
      totalCostUsd: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCachedTokens: 0,
      timeWindow: {
        start: new Date().toISOString(),
        end: new Date().toISOString(),
        durationDays: 0,
      },
      topModels: [],
      topTasks: [],
      retryStats: {
        totalRetries: 0,
        eventsWithRetriesCount: 0,
        retryRatePercent: 0,
        failedEventsCount: 0,
        failureWasteCostUsd: 0,
      },
      findingsSummary: [],
      missingTelemetry: ['No usage events provided for analysis.'],
    };
  }

  // 1. Sort events chronologically
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const startTimestamp = sorted[0].timestamp;
  const endTimestamp = sorted[sorted.length - 1].timestamp;
  const startTime = new Date(startTimestamp).getTime();
  const endTime = new Date(endTimestamp).getTime();
  const durationDays = Math.max(1, Math.round((endTime - startTime) / (1000 * 60 * 60 * 24)));

  // 2. Aggregate sums
  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalRetries = 0;
  let eventsWithRetriesCount = 0;
  let failedEventsCount = 0;
  let failureWasteCostUsd = 0;

  const modelMap: Record<string, { eventCount: number; costUsd: number }> = {};
  const taskMap: Record<string, { eventCount: number; costUsd: number }> = {};

  for (const ev of sorted) {
    const cost = getEffectiveEventCost(ev);
    totalCostUsd += cost;
    totalInputTokens += ev.inputTokens || 0;
    totalOutputTokens += ev.outputTokens || 0;
    totalCachedTokens += ev.cachedInputTokens || 0;

    const retries = ev.retryCount || 0;
    totalRetries += retries;
    if (retries > 0) {
      eventsWithRetriesCount += 1;
    }

    if (ev.status !== 'success') {
      failedEventsCount += 1;
      failureWasteCostUsd += cost;
    }

    const m = ev.model || 'unknown';
    if (!modelMap[m]) modelMap[m] = { eventCount: 0, costUsd: 0 };
    modelMap[m].eventCount += 1;
    modelMap[m].costUsd += cost;

    const t = ev.task || 'general';
    if (!taskMap[t]) taskMap[t] = { eventCount: 0, costUsd: 0 };
    taskMap[t].eventCount += 1;
    taskMap[t].costUsd += cost;
  }

  // 3. Top models
  const topModels = Object.entries(modelMap)
    .map(([model, data]) => ({
      model,
      eventCount: data.eventCount,
      costUsd: Number(data.costUsd.toFixed(4)),
      costSharePercent: totalCostUsd > 0 ? Number(((data.costUsd / totalCostUsd) * 100).toFixed(1)) : 0,
      avgCostPerEventUsd: data.eventCount > 0 ? Number((data.costUsd / data.eventCount).toFixed(5)) : 0,
    }))
    .sort((a, b) => b.costUsd - a.costUsd);

  // 4. Top tasks
  const topTasks = Object.entries(taskMap)
    .map(([task, data]) => ({
      task,
      eventCount: data.eventCount,
      costUsd: Number(data.costUsd.toFixed(4)),
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10);

  // 5. Retry Stats
  const retryRatePercent =
    sorted.length > 0
      ? Number(((eventsWithRetriesCount / sorted.length) * 100).toFixed(1))
      : 0;

  // 6. Chronological Period Comparison (first 50% vs second 50%)
  let periodComparison: PrecomputedMetrics['periodComparison'] = undefined;
  if (sorted.length >= 4) {
    const midIndex = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midIndex);
    const secondHalf = sorted.slice(midIndex);

    const baselineCostUsd = firstHalf.reduce((sum, e) => sum + getEffectiveEventCost(e), 0);
    const currentCostUsd = secondHalf.reduce((sum, e) => sum + getEffectiveEventCost(e), 0);
    const deltaUsd = currentCostUsd - baselineCostUsd;
    const deltaPercent =
      baselineCostUsd > 0
        ? Number(((deltaUsd / baselineCostUsd) * 100).toFixed(1))
        : 0;

    // Find which model drove the biggest change
    const firstHalfModelSpend: Record<string, number> = {};
    for (const e of firstHalf) {
      firstHalfModelSpend[e.model] = (firstHalfModelSpend[e.model] || 0) + getEffectiveEventCost(e);
    }
    const secondHalfModelSpend: Record<string, number> = {};
    for (const e of secondHalf) {
      secondHalfModelSpend[e.model] = (secondHalfModelSpend[e.model] || 0) + getEffectiveEventCost(e);
    }

    let maxModelDelta = -Infinity;
    let primaryDriverModel = topModels[0]?.model || 'all';
    for (const model of Object.keys({ ...firstHalfModelSpend, ...secondHalfModelSpend })) {
      const delta = (secondHalfModelSpend[model] || 0) - (firstHalfModelSpend[model] || 0);
      if (Math.abs(delta) > maxModelDelta) {
        maxModelDelta = Math.abs(delta);
        primaryDriverModel = model;
      }
    }

    periodComparison = {
      baselineCostUsd: Number(baselineCostUsd.toFixed(4)),
      currentCostUsd: Number(currentCostUsd.toFixed(4)),
      deltaUsd: Number(deltaUsd.toFixed(4)),
      deltaPercent,
      primaryDriverModel,
    };
  }

  // 7. Optimization Findings Summary
  const findings = existingFindings || detectInefficiencies(sorted);
  const findingsSummary = findings.map((f) => ({
    id: f.id,
    type: f.type,
    title: f.title,
    severity: f.severity,
    estimatedExcessCostUsd: Number((f.metrics.estimatedExcessCostUsd || 0).toFixed(4)),
    confidenceLevel: f.confidenceLevel,
  }));

  // 8. Missing Telemetry
  const missingTelemetry = detectMissingTelemetry(sorted);

  return {
    totalEvents: sorted.length,
    totalCostUsd: Number(totalCostUsd.toFixed(4)),
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    timeWindow: {
      start: startTimestamp,
      end: endTimestamp,
      durationDays,
    },
    topModels,
    topTasks,
    retryStats: {
      totalRetries,
      eventsWithRetriesCount,
      retryRatePercent,
      failedEventsCount,
      failureWasteCostUsd: Number(failureWasteCostUsd.toFixed(4)),
    },
    periodComparison,
    findingsSummary,
    missingTelemetry,
  };
}
