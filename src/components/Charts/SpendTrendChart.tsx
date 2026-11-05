import React, { useState } from 'react';
import { TimelineDataPoint } from '../../services/analytics';
import { BarChart3 } from 'lucide-react';

interface SpendTrendChartProps {
  data: TimelineDataPoint[];
  currency: string;
}

export const SpendTrendChart: React.FC<SpendTrendChartProps> = ({ data, currency }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-8 flex flex-col items-center justify-center min-h-[220px] text-[#8B8B94] text-xs text-center space-y-2">
        <BarChart3 className="w-7 h-7 text-[#5E5E68] stroke-[1.5]" />
        <span className="font-medium text-[#EDEDEF]">No chronological usage events found</span>
        <span className="text-[11px] text-[#5E5E68] max-w-xs">
          Adjust the active date preset or clear filters in the toolbar to reveal spend timeline data.
        </span>
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.totalCost), 0.05);
  const chartHeight = 180;
  const chartWidth = 720;
  const paddingX = 42;
  const paddingY = 24;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  const barWidth = Math.max(8, Math.min(28, (usableWidth / data.length) * 0.72));

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHoveredIndex(Math.min(data.length - 1, index + 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHoveredIndex(Math.max(0, index - 1));
    } else if (e.key === 'Escape') {
      setHoveredIndex(null);
    }
  };

  return (
    <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 sm:p-5 space-y-3">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h3 className="text-xs font-semibold text-[#EDEDEF] tracking-tight flex items-center gap-2">
            <span>Daily Spend & Ingestion Trend</span>
            <span className="text-[10px] font-mono text-[#8B8B94] font-normal px-1.5 py-0.5 rounded bg-[#101012] border border-[#29292F]">
              {data.length} {data.length === 1 ? 'day' : 'days'}
            </span>
          </h3>
          <p className="text-[11px] text-[#8B8B94]">
            Delineating reported provider invoices vs. verified rate card estimates
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5 text-[11px] font-mono text-[#8B8B94] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-[#22C55E]" />
            <span>Reported</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-[#7C6FF7]" />
            <span>Estimated</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-x-auto focus-within:ring-1 focus-within:ring-[#7C6FF7] rounded">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[500px] h-44 select-none"
          preserveAspectRatio="none"
          role="region"
          aria-label="Daily Spend and Ingestion Trend Bar Chart"
        >
          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = paddingY + usableHeight * (1 - pct);
            const val = maxCost * pct;
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#222226"
                  strokeDasharray={idx === 0 ? 'none' : '3 3'}
                  strokeWidth={idx === 0 ? '1' : '0.5'}
                />
                <text
                  x={paddingX - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#5E5E68"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  ${val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Stacked Bars */}
          {data.map((d, index) => {
            const x =
              paddingX +
              (index / Math.max(1, data.length - 1)) * (usableWidth - barWidth);
            const reportedH = (d.reportedCost / maxCost) * usableHeight;
            const estimatedH = (d.estimatedCost / maxCost) * usableHeight;

            const reportedY = paddingY + usableHeight - reportedH;
            const estimatedY = reportedY - estimatedH;

            const isHovered = hoveredIndex === index;

            return (
              <g
                key={d.date}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${d.date}: Total $${d.totalCost.toFixed(4)} (${d.requestCount} requests)`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onFocus={() => setHoveredIndex(index)}
                onBlur={() => setHoveredIndex(null)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                {/* Background hit area */}
                <rect
                  x={x - 2}
                  y={paddingY}
                  width={barWidth + 4}
                  height={usableHeight}
                  fill="transparent"
                />

                {/* Highlight guide line when hovered or focused */}
                {isHovered && (
                  <line
                    x1={x + barWidth / 2}
                    y1={paddingY}
                    x2={x + barWidth / 2}
                    y2={paddingY + usableHeight}
                    stroke="#7C6FF7"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Reported Cost Segment */}
                {reportedH > 0 && (
                  <rect
                    x={x}
                    y={reportedY}
                    width={barWidth}
                    height={Math.max(1, reportedH)}
                    fill="#22C55E"
                    rx={estimatedH > 0 ? 0 : 2}
                    opacity={isHovered ? 1 : 0.85}
                  />
                )}

                {/* Estimated Cost Segment */}
                {estimatedH > 0 && (
                  <rect
                    x={x}
                    y={estimatedY}
                    width={barWidth}
                    height={Math.max(1, estimatedH)}
                    fill="#7C6FF7"
                    rx={2}
                    opacity={isHovered ? 1 : 0.85}
                  />
                )}

                {/* Date Label on Axis */}
                {(index === 0 ||
                  index === Math.floor(data.length / 2) ||
                  index === data.length - 1 ||
                  (data.length <= 10 && index % 2 === 0)) && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - 6}
                    textAnchor="middle"
                    fill="#8B8B94"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {d.date.slice(5)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover / Focus Tooltip Overlay */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="absolute top-2 right-2 sm:right-4 bg-[#151518] border border-[#29292F] rounded-md p-3 shadow-xl text-xs font-mono text-[#EDEDEF] pointer-events-none z-10 max-w-[260px]">
            <div className="text-white font-medium border-b border-[#29292F] pb-1 mb-1.5 flex items-center justify-between gap-4">
              <span>{data[hoveredIndex].date}</span>
              <span className="text-emerald-400 tabular-nums">
                ${data[hoveredIndex].totalCost.toFixed(4)} {currency}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[#8B8B94]">
              <div>
                <span className="text-[#5E5E68] block text-[9px] uppercase">Reported</span>
                <span className="text-emerald-400 font-medium tabular-nums">
                  ${data[hoveredIndex].reportedCost.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-[#5E5E68] block text-[9px] uppercase">Estimated</span>
                <span className="text-[#7C6FF7] font-medium tabular-nums">
                  ${data[hoveredIndex].estimatedCost.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-[#5E5E68] block text-[9px] uppercase">Requests</span>
                <span className="tabular-nums text-[#EDEDEF]">{data[hoveredIndex].requestCount}</span>
              </div>
              <div>
                <span className="text-[#5E5E68] block text-[9px] uppercase">Retries</span>
                <span className="tabular-nums text-amber-400">{data[hoveredIndex].retryCount}</span>
              </div>
              <div className="col-span-2 pt-1 border-t border-[#222226] text-[10px] text-[#5E5E68] flex justify-between">
                <span>In: {data[hoveredIndex].inputTokens.toLocaleString()}</span>
                <span>Out: {data[hoveredIndex].outputTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
