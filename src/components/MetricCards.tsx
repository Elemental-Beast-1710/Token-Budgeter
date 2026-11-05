import React from 'react';
import { Layers, Cpu, Repeat, AlertTriangle } from 'lucide-react';
import { KPIStats } from '../types';
import { formatCurrency } from '../services/currency';

interface MetricCardsProps {
  kpis: KPIStats;
  currency: string;
  dateRangeDescription: string;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  kpis,
  currency,
  dateRangeDescription,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total Spend with Explicit Cost Provenance */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-2 hover:border-[#3B3B42] transition-colors">
        <div className="flex items-center justify-between text-xs text-[#8B8B94]">
          <span className="font-medium">Total Spend</span>
          <span className="text-[10px] font-mono text-[#5E5E68] bg-[#101012] px-1.5 py-0.5 rounded border border-[#29292F]">
            {dateRangeDescription}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-semibold font-mono tracking-tight text-[#EDEDEF] tabular-nums">
            {formatCurrency(kpis.totalEffectiveCostUsd, currency)}
          </span>
        </div>

        {/* Provenance: Reported vs Estimated */}
        <div className="pt-2 border-t border-[#222226] flex items-center justify-between text-[11px] font-mono">
          <div>
            <span className="text-[#5E5E68]">Reported: </span>
            <span className="text-emerald-400 font-medium tabular-nums">
              ${kpis.reportedCostUsd.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[#5E5E68]">Estimated: </span>
            <span className="text-[#7C6FF7] font-medium tabular-nums">
              ${kpis.estimatedCostUsd.toFixed(2)}
            </span>
          </div>
        </div>

        {kpis.unknownCostCount > 0 ? (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-mono pt-0.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{kpis.unknownCostCount} calls missing rate card</span>
          </div>
        ) : (
          <div className="text-[10px] font-mono text-[#5E5E68] pt-0.5">
            Fully reconciled
          </div>
        )}
      </div>

      {/* 2. Token Volume & Prompt Caching Ratio */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-2 hover:border-[#3B3B42] transition-colors">
        <div className="flex items-center justify-between text-xs text-[#8B8B94]">
          <span className="font-medium">Total Tokens</span>
          <Cpu className="w-3.5 h-3.5 text-[#5E5E68]" />
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-semibold font-mono tracking-tight text-[#EDEDEF] tabular-nums">
            {kpis.totalTokens >= 1_000_000
              ? `${(kpis.totalTokens / 1_000_000).toFixed(2)}M`
              : kpis.totalTokens.toLocaleString()}
          </span>
          <span className="text-[11px] text-[#5E5E68] font-mono">tokens</span>
        </div>

        <div className="pt-2 border-t border-[#222226] flex items-center justify-between text-[11px] font-mono text-[#8B8B94]">
          <div>
            <span className="text-[#5E5E68]">In: </span>
            <span className="text-[#EDEDEF] tabular-nums">
              {kpis.totalInputTokens >= 1_000_000
                ? `${(kpis.totalInputTokens / 1_000_000).toFixed(1)}M`
                : kpis.totalInputTokens.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[#5E5E68]">Out: </span>
            <span className="text-[#EDEDEF] tabular-nums">
              {kpis.totalOutputTokens >= 1_000_000
                ? `${(kpis.totalOutputTokens / 1_000_000).toFixed(1)}M`
                : kpis.totalOutputTokens.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="text-[10px] font-mono text-[#8B8B94] flex items-center justify-between pt-0.5">
          <span className="text-[#5E5E68]">Cached Context:</span>
          <span className="text-emerald-400 font-medium tabular-nums">
            {kpis.totalCachedTokens.toLocaleString()} (
            {kpis.totalInputTokens > 0
              ? Math.round((kpis.totalCachedTokens / kpis.totalInputTokens) * 100)
              : 0}
            %)
          </span>
        </div>
      </div>

      {/* 3. Requests and Average Unit Cost */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-2 hover:border-[#3B3B42] transition-colors">
        <div className="flex items-center justify-between text-xs text-[#8B8B94]">
          <span className="font-medium">Total Requests</span>
          <Layers className="w-3.5 h-3.5 text-[#5E5E68]" />
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl sm:text-3xl font-semibold font-mono tracking-tight text-[#EDEDEF] tabular-nums">
            {kpis.totalRequests.toLocaleString()}
          </span>
          <span className="text-[11px] text-[#5E5E68] font-mono">calls</span>
        </div>

        <div className="pt-2 border-t border-[#222226] flex items-center justify-between text-[11px] font-mono text-[#8B8B94]">
          <span className="text-[#5E5E68]">Cost / Request:</span>
          <span className="text-[#EDEDEF] font-medium tabular-nums">
            ${kpis.avgCostPerRequestUsd.toFixed(4)}
          </span>
        </div>

        <div className="text-[10px] font-mono text-[#8B8B94] flex items-center justify-between pt-0.5">
          <span className="text-[#5E5E68]">Avg Latency:</span>
          <span className="text-[#EDEDEF] tabular-nums">
            {kpis.avgDurationMs ? `${(kpis.avgDurationMs / 1000).toFixed(2)}s` : 'N/A'}
          </span>
        </div>
      </div>

      {/* 4. Retries & Reliability */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-2 hover:border-[#3B3B42] transition-colors">
        <div className="flex items-center justify-between text-xs text-[#8B8B94]">
          <span className="font-medium">Retry Rate & Failures</span>
          <Repeat className="w-3.5 h-3.5 text-[#5E5E68]" />
        </div>

        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-2xl sm:text-3xl font-semibold font-mono tracking-tight tabular-nums ${
              kpis.retryRatePercent > 20
                ? 'text-amber-400'
                : kpis.retryRatePercent > 10
                ? 'text-yellow-300'
                : 'text-[#EDEDEF]'
            }`}
          >
            {kpis.retryRatePercent.toFixed(1)}%
          </span>
          <span className="text-[11px] text-[#5E5E68] font-mono">
            ({kpis.retryCount} retries)
          </span>
        </div>

        <div className="pt-2 border-t border-[#222226] flex items-center justify-between text-[11px] font-mono text-[#8B8B94]">
          <span className="text-[#5E5E68]">Failed Calls:</span>
          <span
            className={`font-medium tabular-nums ${
              kpis.failedRequests > 0 ? 'text-rose-400' : 'text-[#EDEDEF]'
            }`}
          >
            {kpis.failedRequests}
          </span>
        </div>

        <div className="text-[10px] font-mono text-[#8B8B94] flex items-center justify-between pt-0.5">
          <span className="text-[#5E5E68]">Dataset:</span>
          <span className="text-[#EDEDEF]">
            {kpis.actualCount} live · {kpis.sampleCount} sample
          </span>
        </div>
      </div>
    </div>
  );
};
