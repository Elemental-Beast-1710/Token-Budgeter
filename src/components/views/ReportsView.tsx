import React from 'react';
import {
  FileText,
  Printer,
  Download,
  CheckCircle2,
  Calendar,
  FilterX,
} from 'lucide-react';
import { Experiment, KPIStats, UsageEvent } from '../../types';
import {
  groupEventsBy,
  detectInefficiencies,
} from '../../services/analytics';
import {
  downloadFile,
  generatePrintableReportHtml,
} from '../../services/export';
import { formatCurrency } from '../../services/currency';

interface ReportsViewProps {
  events: UsageEvent[];
  kpis: KPIStats;
  currency: string;
  experiments: Experiment[];
  dateRangeDescription: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  events,
  kpis,
  currency,
  experiments,
  dateRangeDescription,
}) => {
  const topProjects = groupEventsBy(events, 'project').slice(0, 5);
  const topModels = groupEventsBy(events, 'model').slice(0, 5);
  const findings = detectInefficiencies(events);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    const html = generatePrintableReportHtml(
      events,
      kpis,
      'TokenBudgeter Executive AI Usage Audit',
      dateRangeDescription
    );
    downloadFile(html, `tokenbudgeter-report-${Date.now()}.html`, 'text/html');
  };

  return (
    <div className="space-y-6">
      {/* View Header with Print and Export Actions */}
      <div className="bg-[#151518] border border-[#29292F] p-4 sm:p-5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print shadow-xs">
        <div>
          <h2 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#7C6FF7]" />
            <span>Executive Audit & Optimization Report</span>
          </h2>
          <p className="text-xs text-[#8B8B94] mt-0.5">
            Structured review of spend trends, waste detection, experiments, and next engineering actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6D5FE6] rounded-md transition-colors shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FF7]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#8B8B94] hover:text-[#EDEDEF] bg-[#101012] hover:bg-[#1C1C20] rounded-md border border-[#29292F] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FF7]"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download HTML</span>
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-12 text-center space-y-3">
          <FilterX className="w-10 h-10 text-[#5E5E68] mx-auto stroke-[1.5]" />
          <h3 className="text-sm font-semibold text-[#EDEDEF]">No Usage Events in Report Scope</h3>
          <p className="text-xs text-[#8B8B94] max-w-sm mx-auto">
            Broaden your date filter or reset active dimension filters to compile an executive usage audit.
          </p>
        </div>
      ) : (
        /* Printable Report Document Card */
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-6 sm:p-8 space-y-6 max-w-4xl mx-auto shadow-xs print:border-none print:shadow-none print:p-0 print:bg-transparent">
          {/* Report Meta Header */}
          <div className="border-b border-[#29292F] pb-5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase text-[#7C6FF7] tracking-wider">
                TokenBudgeter Audit Report
              </span>
              <span className="text-xs font-mono text-[#8B8B94]">
                Generated: {new Date().toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-lg font-bold text-[#EDEDEF] tracking-tight">AI Telemetry & Resource Summary</h1>
            <div className="text-xs text-[#8B8B94] flex items-center gap-2 font-mono pt-1">
              <Calendar className="w-3.5 h-3.5 text-[#5E5E68]" />
              <span>Scope: {dateRangeDescription}</span>
              <span>·</span>
              <span>{events.length} verified events analyzed</span>
            </div>
          </div>

          {/* Section 1: Executive KPI Summary */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
              01. Executive Resource Totals
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 bg-[#101012] rounded-md border border-[#29292F]">
                <span className="text-[10px] text-[#8B8B94] block uppercase">Total Spend</span>
                <span className="text-lg font-bold text-[#EDEDEF] tabular-nums">
                  {formatCurrency(kpis.totalEffectiveCostUsd, currency)}
                </span>
                <span className="text-[10px] text-[#5E5E68] block font-sans">
                  (${kpis.reportedCostUsd.toFixed(2)} reported)
                </span>
              </div>

              <div className="p-3 bg-[#101012] rounded-md border border-[#29292F]">
                <span className="text-[10px] text-[#8B8B94] block uppercase">Token Volume</span>
                <span className="text-lg font-bold text-[#EDEDEF] tabular-nums">
                  {(kpis.totalTokens / 1_000_000).toFixed(2)}M
                </span>
                <span className="text-[10px] text-[#5E5E68] block font-sans">
                  {kpis.totalInputTokens >= 1_000_000 ? (kpis.totalInputTokens / 1_000_000).toFixed(1) + 'M in' : kpis.totalInputTokens.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-[#101012] rounded-md border border-[#29292F]">
                <span className="text-[10px] text-[#8B8B94] block uppercase">Cache Share</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">
                  {kpis.totalInputTokens > 0
                    ? Math.round((kpis.totalCachedTokens / kpis.totalInputTokens) * 100)
                    : 0}%
                </span>
                <span className="text-[10px] text-[#5E5E68] block font-sans">
                  {kpis.totalCachedTokens.toLocaleString()} tokens
                </span>
              </div>

              <div className="p-3 bg-[#101012] rounded-md border border-[#29292F]">
                <span className="text-[10px] text-[#8B8B94] block uppercase">Retry Rate</span>
                <span
                  className={`text-lg font-bold tabular-nums ${
                    kpis.retryRatePercent > 20 ? 'text-amber-400' : 'text-[#EDEDEF]'
                  }`}
                >
                  {kpis.retryRatePercent.toFixed(1)}%
                </span>
                <span className="text-[10px] text-[#5E5E68] block font-sans">
                  {kpis.retryCount} retries total
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Primary Spending Workflows */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
              02. Spending Concentration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#101012] rounded-md border border-[#29292F] space-y-2">
                <span className="text-[#EDEDEF] font-medium block">Top Projects by Spend</span>
                <div className="space-y-1.5 font-mono">
                  {topProjects.map((p) => (
                    <div key={p.key} className="flex justify-between py-1 border-b border-[#29292F]/50 text-[#EDEDEF]">
                      <span className="font-sans text-[#8B8B94] truncate max-w-[65%]">{p.key}</span>
                      <span className="font-semibold tabular-nums text-[#EDEDEF]">${p.totalCostUsd.toFixed(2)} ({p.costPercentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-[#101012] rounded-md border border-[#29292F] space-y-2">
                <span className="text-[#EDEDEF] font-medium block">Top Models by Spend</span>
                <div className="space-y-1.5 font-mono">
                  {topModels.map((m) => (
                    <div key={m.key} className="flex justify-between py-1 border-b border-[#29292F]/50 text-[#EDEDEF]">
                      <span className="text-[#7C6FF7] truncate max-w-[65%]">{m.key}</span>
                      <span className="font-semibold tabular-nums text-[#EDEDEF]">${m.totalCostUsd.toFixed(2)} ({m.costPercentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Verified Anomaly Findings */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
              03. Identified Inefficiencies ({findings.length})
            </h3>
            {findings.length === 0 ? (
              <div className="p-3 bg-[#101012] border border-[#29292F] rounded-md text-xs text-[#8B8B94] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Zero systematic retry loops or excessive context ratios detected.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {findings.map((f) => (
                  <div key={f.id} className="p-3.5 bg-[#101012] rounded-md border border-[#29292F] text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#EDEDEF]">{f.title}</span>
                      <span className="text-rose-400 font-mono font-bold tabular-nums">
                        Est. Waste: ${f.metrics.estimatedExcessCostUsd.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[#8B8B94] text-[11px] font-sans leading-relaxed">{f.pattern}</p>
                    <div className="text-[#7C6FF7] font-medium text-[11px]">
                      Recommended Action: {f.proposedAction}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: A/B Experiments Summary */}
          {experiments.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
                04. Optimization Experiments Validated
              </h3>
              <div className="space-y-2 font-mono text-xs">
                {experiments.map((exp) => (
                  <div key={exp.id} className="p-3 bg-[#101012] rounded-md border border-[#29292F] flex items-center justify-between">
                    <div>
                      <span className="text-[#EDEDEF] font-sans font-medium block">{exp.name}</span>
                      <span className="text-[#8B8B94] text-[11px]">
                        {exp.baselineModel} → {exp.experimentalModel}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-semibold block">Validated</span>
                      <span className="text-[#5E5E68] text-[10px]">{exp.baselineRuns.length} runs evaluated</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Recommended Next Engineering Actions */}
          <div className="space-y-3 pt-3 border-t border-[#29292F]">
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
              05. Recommended Engineering Actions
            </h3>
            <ul className="space-y-1.5 text-xs text-[#8B8B94] list-decimal list-inside font-sans">
              <li>Configure prompt caching headers on endpoints exceeding 30k input tokens.</li>
              <li>Enforce exponential backoff with max retry ceiling of 2 attempts on flaky CI workers.</li>
              <li>Track quality evaluation scores before downshifting to smaller models.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
