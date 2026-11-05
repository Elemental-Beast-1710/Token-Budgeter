import React from 'react';
import { KPIStats, UsageEvent } from '../../types';
import {
  groupEventsBy,
  groupEventsByTimeline,
} from '../../services/analytics';
import { MetricCards } from '../MetricCards';
import { SpendTrendChart } from '../Charts/SpendTrendChart';
import { BreakdownDonutChart } from '../Charts/BreakdownDonutChart';
import { AlertCircle, ArrowUpRight, CheckCircle2, FilterX, Sparkles, UploadCloud } from 'lucide-react';
import { NavTab } from '../Header';

interface OverviewViewProps {
  events: UsageEvent[];
  kpis: KPIStats;
  currency: string;
  dateRangeDescription: string;
  onNavigateTab: (tab: NavTab) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  events,
  kpis,
  currency,
  dateRangeDescription,
  onNavigateTab,
}) => {
  const timelineData = groupEventsByTimeline(events);
  const providerBreakdown = groupEventsBy(events, 'provider');
  const modelBreakdown = groupEventsBy(events, 'model');
  const projectBreakdown = groupEventsBy(events, 'project');
  const taskBreakdown = groupEventsBy(events, 'task');

  // Find data-quality warnings or anomalies in current view
  const warningEvents = events.filter(
    (e) =>
      e.metadata?.data_quality_warning ||
      e.costBasis === 'unknown' ||
      (e.inputTokens > 50000 && (e.cachedInputTokens || 0) === 0)
  );

  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <MetricCards
          kpis={kpis}
          currency={currency}
          dateRangeDescription={dateRangeDescription}
        />
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-12 text-center space-y-3">
          <FilterX className="w-8 h-8 text-[#5E5E68] mx-auto stroke-[1.5]" />
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-[#EDEDEF]">No Usage Events in Selected Scope</h3>
            <p className="text-[11px] text-[#8B8B94] max-w-sm mx-auto">
              No telemetry events match your active date preset and dimension filters. Broaden your date range or import more records.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => onNavigateTab('imports')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors shadow-2xs"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Import Telemetry</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Stats Ribbon */}
      <MetricCards
        kpis={kpis}
        currency={currency}
        dateRangeDescription={dateRangeDescription}
      />

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SpendTrendChart data={timelineData} currency={currency} />
        </div>
        <div className="space-y-4">
          <BreakdownDonutChart
            title="Spend by Model"
            items={modelBreakdown}
            currency={currency}
          />
          <BreakdownDonutChart
            title="Spend by Provider"
            items={providerBreakdown}
            currency={currency}
          />
        </div>
      </div>

      {/* Two Column Grid: Top Spenders & Actionable Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Most Expensive Projects & Tasks */}
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#EDEDEF] tracking-tight">Top Spending Workflows</h3>
            <button
              type="button"
              onClick={() => onNavigateTab('projects')}
              className="text-xs text-[#7C6FF7] hover:text-[#9A90F8] flex items-center gap-1 font-medium transition-colors"
            >
              <span>Manage Projects</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#222226]">
            {projectBreakdown.slice(0, 4).map((proj) => (
              <div
                key={proj.key}
                className="py-2 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-medium text-[#EDEDEF]">{proj.key}</div>
                  <div className="text-[11px] text-[#8B8B94] font-mono">
                    {proj.count} calls · {proj.retryRatePercent.toFixed(0)}% retries
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-semibold text-[#EDEDEF] tabular-nums">
                    ${proj.totalCostUsd.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#5E5E68]">
                    {proj.costPercentage}% of spend
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#222226]">
            <h4 className="text-[10px] font-medium text-[#8B8B94] mb-1.5 font-mono uppercase tracking-wider">Most Expensive Tasks</h4>
            <div className="space-y-1 font-mono text-xs">
              {taskBreakdown.slice(0, 3).map((task) => (
                <div key={task.key} className="flex items-center justify-between text-[#8B8B94] py-0.5">
                  <span className="truncate max-w-[70%] text-[#EDEDEF]">{task.key}</span>
                  <span className="tabular-nums font-medium text-[#EDEDEF]">${task.totalCostUsd.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Quality & Optimization Shortcuts */}
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#EDEDEF] tracking-tight">Audit & Quality Health</h3>
              <span className="text-[11px] font-mono text-[#8B8B94]">
                {warningEvents.length === 0 ? 'All nominal' : `${warningEvents.length} items flagged`}
              </span>
            </div>

            {warningEvents.length > 0 ? (
              <div className="space-y-2">
                {warningEvents.slice(0, 3).map((w, idx) => (
                  <div
                    key={w.id || idx}
                    className="p-2.5 rounded-md bg-[#1C1C20] border border-amber-900/40 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-medium">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {w.metadata?.data_quality_warning
                            ? 'Telemetry Integrity Warning'
                            : w.costBasis === 'unknown'
                            ? 'Missing Rate Card'
                            : 'Uncached Context Bloat'}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono text-amber-400/80">{w.id}</span>
                    </div>
                    <p className="text-[11px] text-[#8B8B94]">
                      {w.metadata?.data_quality_warning ||
                        `Model "${w.model}" has no rate card; financial cost cannot be calculated.`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-md bg-[#101012] border border-[#29292F] text-xs text-[#8B8B94] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero telemetry inconsistencies or rate card discrepancies detected.</span>
              </div>
            )}
          </div>

          {/* Quick jump callout to Optimization Lab */}
          <div className="pt-3 border-t border-[#29292F] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#1C1C20]/60 -mx-4 -mb-4 p-3 rounded-b-lg">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-[#EDEDEF] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#7C6FF7] shrink-0" />
                <span>Optimization Lab Active</span>
              </div>
              <div className="text-[11px] text-[#8B8B94]">
                Inspect detected retry loops, duplicate prompts, and context opportunities.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('analyst')}
                className="px-2.5 py-1 text-xs font-medium bg-[#151518] hover:bg-[#1C1C20] border border-[#29292F] text-[#EDEDEF] rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-[#7C6FF7]" />
                <span>AI Analyst</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('optimization')}
                className="px-2.5 py-1 text-xs font-medium bg-[#7C6FF7] hover:bg-[#6B5EE4] text-white rounded-md transition-colors whitespace-nowrap shadow-2xs"
              >
                Inspect Lab
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
