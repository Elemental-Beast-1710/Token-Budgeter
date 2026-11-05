import { KPIStats, UsageEvent } from '../types';

/**
 * Escapes HTML entities to prevent XSS / markup injection in generated documents.
 */
export function escapeHtml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes CSV values and neutralizes CSV Formula Injection (DDE attacks).
 * If a cell begins with '=', '+', '-', '@', '\t', '\r', '\n', '%', or '|'
 * (even with leading whitespace), prefix with an apostrophe.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Check for dangerous formula injection prefixes directly or after leading whitespace, BOM, or control characters
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '\n', '%', '|'];
  const stripped = str.replace(/^[\s\uFEFF\u0000-\u001f\u007f-\u009f]+/, '');
  const hasDangerousPrefix =
    dangerousPrefixes.some((prefix) => str.startsWith(prefix)) ||
    dangerousPrefixes.some((prefix) => stripped.startsWith(prefix));

  if (hasDangerousPrefix) {
    str = `'${str}`;
  }

  // Escape inner quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Exports an array of usage events to a safe CSV string.
 */
export function exportEventsToCsv(events: UsageEvent[]): string {
  const headers = [
    'id',
    'timestamp',
    'provider',
    'model',
    'project',
    'task',
    'source',
    'input_tokens',
    'output_tokens',
    'cached_input_tokens',
    'reasoning_tokens',
    'request_count',
    'retry_count',
    'status',
    'reported_cost_usd',
    'estimated_cost_usd',
    'reported_currency',
    'cost_basis',
    'duration_ms',
    'quality_score',
    'is_sample',
    'record_origin',
  ];

  const rows = events.map((ev) => [
    sanitizeCsvCell(ev.id),
    sanitizeCsvCell(ev.timestamp),
    sanitizeCsvCell(ev.provider),
    sanitizeCsvCell(ev.model),
    sanitizeCsvCell(ev.project),
    sanitizeCsvCell(ev.task),
    sanitizeCsvCell(ev.source),
    sanitizeCsvCell(ev.inputTokens),
    sanitizeCsvCell(ev.outputTokens),
    sanitizeCsvCell(ev.cachedInputTokens ?? ''),
    sanitizeCsvCell(ev.reasoningTokens ?? ''),
    sanitizeCsvCell(ev.requestCount),
    sanitizeCsvCell(ev.retryCount),
    sanitizeCsvCell(ev.status),
    sanitizeCsvCell(ev.reportedCost !== null ? ev.reportedCost.toFixed(6) : ''),
    sanitizeCsvCell(ev.estimatedCost !== null ? ev.estimatedCost.toFixed(6) : ''),
    sanitizeCsvCell(ev.reportedCurrency || 'USD'),
    sanitizeCsvCell(ev.costBasis),
    sanitizeCsvCell(ev.durationMs ?? ''),
    sanitizeCsvCell(ev.qualityScore ?? ''),
    sanitizeCsvCell(ev.isSample ? 'true' : 'false'),
    sanitizeCsvCell(ev.recordOrigin || (ev.isSample ? 'sample' : ev.source === 'manual' ? 'manual' : 'imported')),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Exports filtered events to a formatted JSON string.
 */
export function exportEventsToJson(events: UsageEvent[]): string {
  return JSON.stringify(events, null, 2);
}

/**
 * Triggers a browser file download safely.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates an executive HTML report for printing or archiving.
 */
export function generatePrintableReportHtml(
  events: UsageEvent[],
  kpis: KPIStats,
  title: string,
  dateWindowDescription: string
): string {
  const safeTitle = escapeHtml(title);
  const safeWindow = escapeHtml(dateWindowDescription);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; line-height: 1.5; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .card { border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; }
    .card-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-val { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-weight: 600; color: #475569; }
    .num { text-align: right; font-variant-numeric: tabular-nums; font-family: monospace; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  <div class="subtitle">Window: ${safeWindow} · Generated on ${new Date().toLocaleDateString()}</div>

  <div class="grid">
    <div class="card">
      <div class="card-label">Total Spend (USD)</div>
      <div class="card-val">$${kpis.totalEffectiveCostUsd.toFixed(2)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Tokens</div>
      <div class="card-val">${kpis.totalTokens.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Prompt Cache Tokens</div>
      <div class="card-val">${kpis.totalCachedTokens.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-label">Retry Rate</div>
      <div class="card-val">${kpis.retryRatePercent.toFixed(1)}%</div>
    </div>
  </div>

  <h2>Usage Events Breakdown (${events.length} records)</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Project</th>
        <th>Task</th>
        <th>Model</th>
        <th class="num">In Tokens</th>
        <th class="num">Out Tokens</th>
        <th class="num">Cost ($)</th>
        <th>Basis</th>
      </tr>
    </thead>
    <tbody>
      ${events.slice(0, 50).map((e) => {
        const d = new Date(e.timestamp);
        const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : 'N/A';
        let costStr = 'Unknown';
        if (e.costBasis === 'reported' && e.reportedCost !== null && e.reportedCost !== undefined) {
          const curr = (e.reportedCurrency || 'USD').trim().toUpperCase();
          costStr = `${curr !== 'USD' ? curr + ' ' : '$'}${e.reportedCost.toFixed(4)}`;
        } else if (e.costBasis === 'estimated' && e.estimatedCost !== null && e.estimatedCost !== undefined) {
          costStr = `$${e.estimatedCost.toFixed(4)} (est)`;
        }
        return `
        <tr>
          <td>${dateStr}</td>
          <td>${escapeHtml(e.project)}</td>
          <td>${escapeHtml(e.task)}</td>
          <td>${escapeHtml(e.model)}</td>
          <td class="num">${Math.max(0, e.inputTokens || 0).toLocaleString()}</td>
          <td class="num">${Math.max(0, e.outputTokens || 0).toLocaleString()}</td>
          <td class="num">${costStr}</td>
          <td>${escapeHtml(e.costBasis)}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    TokenBudgeter Open-Source Analytics Platform · Confidential Developer Workload Audit
  </div>
</body>
</html>`;
}
