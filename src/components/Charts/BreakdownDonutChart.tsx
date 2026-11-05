import React from 'react';
import { GroupSummary } from '../../services/analytics';
import { PieChart } from 'lucide-react';

interface BreakdownDonutChartProps {
  title: string;
  items: GroupSummary[];
  currency: string;
}

const PALETTE = [
  '#7C6FF7', // restrained violet
  '#22C55E', // muted emerald
  '#EAB308', // amber
  '#38BDF8', // sky
  '#A855F7', // purple
  '#14B8A6', // teal
  '#F43F5E', // rose
  '#64748B', // slate
];

export const BreakdownDonutChart: React.FC<BreakdownDonutChartProps> = ({
  title,
  items,
  currency,
}) => {
  const topItems = items.slice(0, 6);
  const totalCost = items.reduce((s, i) => s + i.totalCostUsd, 0);

  return (
    <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#EDEDEF] tracking-tight">{title}</h3>
        <span className="text-[11px] font-mono text-[#8B8B94] tabular-nums">
          Total: ${totalCost.toFixed(2)} {currency}
        </span>
      </div>

      {topItems.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-center text-xs text-[#8B8B94] space-y-1.5">
          <PieChart className="w-5 h-5 text-[#5E5E68] stroke-[1.5]" />
          <span>No breakdown data available</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {topItems.map((item, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            return (
              <div key={item.key} className="space-y-1 group">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-[62%]">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[#EDEDEF] truncate font-medium group-hover:text-white transition-colors">
                      {item.key}
                    </span>
                    {item.hasUnknownCost && (
                      <span className="text-[10px] text-amber-400 font-mono bg-amber-950/40 px-1 rounded">
                        unknown
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-[#8B8B94] tabular-nums shrink-0">
                    <span className="font-semibold text-[#EDEDEF]">${item.totalCostUsd.toFixed(2)}</span>
                    <span className="text-[#5E5E68] w-10 text-right">({item.costPercentage}%)</span>
                  </div>
                </div>

                {/* Meter Bar */}
                <div className="w-full bg-[#101012] h-1.5 rounded-full overflow-hidden border border-[#222226]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, item.costPercentage))}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
