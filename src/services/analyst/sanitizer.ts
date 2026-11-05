/**
 * Sanitization & Privacy Shield for AI Analyst
 * Guarantees that only sanitized aggregates and safe references are transmitted.
 * Defends against prompt injection and data leaks.
 */

import { UsageEvent } from '../../types';
import { getEffectiveEventCost } from '../analytics';
import { CandidateEvidenceItem } from './types';

/**
 * Strips prompt-injection patterns, control characters, and enforces length limits.
 */
export function sanitizeUserQuestion(input?: string): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input
    // Remove null bytes and non-printable control characters
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Strip common prompt injection markers
    .replace(/(?:\bignore\b|\boverride\b|\bforget\b)\s+(?:\ball\b|\bprevious\b|\bprior\b)?\s*(?:\brules\b|\binstructions\b|\bprompts\b)/gi, '[blocked]')
    .replace(/<\/?(?:system|prompt|assistant|user|instructions)>/gi, '')
    .replace(/\[(?:INST|\/?INST|SYS|\/?SYS)\]/gi, '')
    .replace(/```(?:json|markdown|system)?/gi, '')
    .trim();

  // Enforce max character limit of 200
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 197) + '...';
  }

  return sanitized;
}

/**
 * Extracts strictly sanitized evidence records from real events.
 * Strips all prompt text, request bodies, customer keys, and unstructured headers.
 */
export function extractCandidateEvidence(events: UsageEvent[], maxItems = 15): CandidateEvidenceItem[] {
  if (!events || events.length === 0) return [];

  // Sort events to find the most analytically significant:
  // 1. Events with retries > 0
  // 2. Events that failed
  // 3. Events with high token volume or high cost
  const significantEvents = [...events].sort((a, b) => {
    const aPriority = (a.retryCount > 0 ? 100 : 0) + (a.status !== 'success' ? 50 : 0) + getEffectiveEventCost(a);
    const bPriority = (b.retryCount > 0 ? 100 : 0) + (b.status !== 'success' ? 50 : 0) + getEffectiveEventCost(b);
    return bPriority - aPriority;
  });

  const selected = significantEvents.slice(0, maxItems);

  return selected.map((ev, index) => {
    const cost = getEffectiveEventCost(ev);
    const totalTokens = ev.inputTokens + ev.outputTokens;

    let tag = `Sample #${index + 1}`;
    if (ev.retryCount > 0) tag += ` (Retry x${ev.retryCount})`;
    if (ev.status !== 'success') tag += ` [${ev.status}]`;
    if (ev.cachedInputTokens && ev.cachedInputTokens > 0) tag += ' (Cached)';

    return {
      evidenceId: ev.id,
      timestamp: ev.timestamp,
      model: ev.model || 'unknown',
      task: ev.task || 'general',
      tokens: totalTokens,
      costUsd: Number(cost.toFixed(5)),
      status: ev.status,
      retries: ev.retryCount || 0,
      sanitizedTag: tag,
    };
  });
}

/**
 * Audits event telemetry to discover missing metrics and explain data gaps.
 */
export function detectMissingTelemetry(events: UsageEvent[]): string[] {
  if (!events || events.length === 0) {
    return ['No usage events found in the selected time range.'];
  }

  const missing: string[] = [];
  const total = events.length;

  // 1. Latency / duration check
  const missingDurationCount = events.filter((e) => e.durationMs === null || e.durationMs === undefined).length;
  if (missingDurationCount > 0) {
    const pct = Math.round((missingDurationCount / total) * 100);
    missing.push(`Request latency (durationMs) is missing in ${pct}% of events (${missingDurationCount}/${total}). Latency-sensitive cost trade-offs cannot be evaluated.`);
  }

  // 2. Cache status check
  const missingCacheTracking = events.every((e) => e.cachedInputTokens === null || e.cachedInputTokens === undefined);
  if (missingCacheTracking) {
    missing.push('Prompt cache telemetry (cachedInputTokens) is completely untracked across all records. Caching efficiency estimates are based on prompt repetition heuristic.');
  }

  // 3. Quality evaluation check
  const missingQuality = events.every((e) => e.qualityScore === null || e.qualityScore === undefined);
  if (missingQuality) {
    missing.push('Output quality score is not recorded in ingested logs. Model degradation risks for cheaper models cannot be quantitatively proven.');
  }

  // 4. Reported cost vs estimated
  const missingReportedCost = events.filter((e) => e.reportedCost === null || e.reportedCost === undefined).length;
  if (missingReportedCost === total) {
    missing.push('Source logs do not contain provider-reported billing charges. All financial calculations rely on local deterministic rate card estimates.');
  }

  // 5. Retry instrumentation
  const allZeroRetries = events.every((e) => !e.retryCount || e.retryCount === 0);
  const hasErrors = events.some((e) => e.status !== 'success');
  if (allZeroRetries && hasErrors) {
    missing.push('Error events are present, but retryCount is 0 across all events. Client SDK retry loop instrumentation may be unconfigured.');
  }

  return missing;
}
