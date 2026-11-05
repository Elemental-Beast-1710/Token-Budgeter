import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileCode,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  X,
  Copy,
  Check,
  FilterX,
} from 'lucide-react';
import { UsageEvent } from '../../types';
import { exportEventsToCsv, exportEventsToJson, downloadFile } from '../../services/export';
import { groupEventsBy, getEffectiveEventCost } from '../../services/analytics';
import { formatCurrency } from '../../services/currency';

interface UsageExplorerViewProps {
  events: UsageEvent[];
  currency: string;
}

type GroupByMode = 'none' | 'project' | 'task' | 'model' | 'provider';
type SortField = 'timestamp' | 'cost' | 'inputTokens' | 'outputTokens' | 'retries' | 'duration';
type SortDirection = 'asc' | 'desc';
type TableDensity = 'compact' | 'comfortable';

export const UsageExplorerView: React.FC<UsageExplorerViewProps> = ({ events, currency }) => {
  const [groupBy, setGroupBy] = useState<GroupByMode>('none');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [density, setDensity] = useState<TableDensity>('compact');
  const [selectedEvent, setSelectedEvent] = useState<UsageEvent | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEvent) {
        setSelectedEvent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEvent]);

  // Handle Sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedEvents = [...events].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'timestamp') {
      comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    } else if (sortField === 'cost') {
      const costA = getEffectiveEventCost(a);
      const costB = getEffectiveEventCost(b);
      comparison = costA - costB;
    } else if (sortField === 'inputTokens') {
      comparison = a.inputTokens - b.inputTokens;
    } else if (sortField === 'outputTokens') {
      comparison = a.outputTokens - b.outputTokens;
    } else if (sortField === 'retries') {
      comparison = a.retryCount - b.retryCount;
    } else if (sortField === 'duration') {
      comparison = (a.durationMs || 0) - (b.durationMs || 0);
    }
    return sortDir === 'asc' ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const pageIndex = Math.min(currentPage, totalPages);
  const displayedEvents = sortedEvents.slice((pageIndex - 1) * pageSize, pageIndex * pageSize);

  // Group by summaries
  const groupSummaries =
    groupBy !== 'none' ? groupEventsBy(events, groupBy as any) : [];

  const handleExportCsv = () => {
    const csvContent = exportEventsToCsv(events);
    downloadFile(csvContent, `tokenbudgeter-export-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    const jsonContent = exportEventsToJson(events);
    downloadFile(jsonContent, `tokenbudgeter-export-${Date.now()}.json`, 'application/json');
  };

  const handleCopyPayload = () => {
    if (!selectedEvent) return;
    navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#5E5E68] group-hover:text-[#8B8B94]" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#7C6FF7]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#7C6FF7]" />
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Top Controls: Grouping, Density, Page size, and Export buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-[#151518] border border-[#29292F] p-2.5 sm:p-3 rounded-lg text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-[#8B8B94] font-medium text-[11px]">Group by:</span>
            <div className="flex items-center bg-[#101012] p-0.5 rounded-md border border-[#29292F]">
              {(['none', 'project', 'task', 'model', 'provider'] as GroupByMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setGroupBy(mode);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-xs capitalize transition-colors focus:outline-none ${
                    groupBy === mode
                      ? 'bg-[#1C1C20] text-[#EDEDEF] font-medium border border-[#29292F]'
                      : 'text-[#8B8B94] hover:text-[#EDEDEF]'
                  }`}
                >
                  {mode === 'none' ? 'Raw Events' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Table Density */}
          {groupBy === 'none' && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[#8B8B94] text-[11px]">Density:</span>
              <div className="flex items-center bg-[#101012] p-0.5 rounded-md border border-[#29292F]">
                <button
                  type="button"
                  onClick={() => setDensity('compact')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    density === 'compact'
                      ? 'bg-[#1C1C20] text-[#EDEDEF] font-medium border border-[#29292F]'
                      : 'text-[#8B8B94] hover:text-[#EDEDEF]'
                  }`}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setDensity('comfortable')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                    density === 'comfortable'
                      ? 'bg-[#1C1C20] text-[#EDEDEF] font-medium border border-[#29292F]'
                      : 'text-[#8B8B94] hover:text-[#EDEDEF]'
                  }`}
                >
                  Standard
                </button>
              </div>
            </div>
          )}

          {/* Rows per page */}
          {groupBy === 'none' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[#8B8B94] text-[11px]">Rows:</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#7C6FF7] font-mono text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#EDEDEF] bg-[#101012] hover:bg-[#1C1C20] rounded-md border border-[#29292F] transition-colors focus:outline-none shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#EDEDEF] bg-[#101012] hover:bg-[#1C1C20] rounded-md border border-[#29292F] transition-colors focus:outline-none shadow-2xs"
          >
            <FileCode className="w-3.5 h-3.5 text-[#7C6FF7]" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg overflow-hidden">
        {events.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center space-y-3">
            <FilterX className="w-8 h-8 text-[#5E5E68] mx-auto stroke-[1.5]" />
            <h3 className="text-xs font-semibold text-[#EDEDEF]">No Usage Events Match Active Filters</h3>
            <p className="text-[11px] text-[#8B8B94] max-w-sm mx-auto">
              There are no recorded usage telemetry events matching the current date range or dimension filters.
            </p>
          </div>
        ) : groupBy !== 'none' ? (
          /* Grouped Aggregation Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Grouped Usage Summary Table">
              <thead className="bg-[#101012] border-b border-[#29292F] text-[#8B8B94] font-medium font-mono text-[11px]">
                <tr>
                  <th scope="col" className="py-2.5 px-4 capitalize font-semibold">{groupBy}</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Event Count</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Total Tokens</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Retry Rate</th>
                  <th scope="col" className="py-2.5 px-3 text-right font-semibold">Total Spend ({currency})</th>
                  <th scope="col" className="py-2.5 px-4 text-right font-semibold">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226] font-mono text-[11px]">
                {groupSummaries.map((item) => (
                  <tr key={item.key} className="hover:bg-[#1C1C20]/50 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-[#EDEDEF] flex items-center gap-2">
                      <span className="truncate max-w-[240px]">{item.key}</span>
                      {item.hasUnknownCost && (
                        <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900/50 px-1 py-0.2 rounded font-mono">
                          incomplete rate card
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#EDEDEF] tabular-nums">
                      {item.count.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#EDEDEF] tabular-nums">
                      {item.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#EDEDEF] tabular-nums">
                      {item.retryRatePercent.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#EDEDEF] font-semibold tabular-nums">
                      ${item.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#8B8B94] tabular-nums">
                      {item.costPercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Raw Events Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Usage Events Telemetry Table">
              <thead className="bg-[#101012] border-b border-[#29292F] text-[#8B8B94] font-medium font-mono text-[11px] select-none sticky top-0 z-10">
                <tr>
                  <th
                    scope="col"
                    className="py-2 px-3 cursor-pointer hover:text-[#EDEDEF] group font-semibold"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Timestamp</span>
                      {renderSortIndicator('timestamp')}
                    </div>
                  </th>
                  <th scope="col" className="py-2 px-3 font-semibold">Project · Task</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Model</th>
                  <th
                    scope="col"
                    className="py-2 px-3 text-right cursor-pointer hover:text-[#EDEDEF] group font-semibold"
                    onClick={() => handleSort('inputTokens')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>In Tokens</span>
                      {renderSortIndicator('inputTokens')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-3 text-right cursor-pointer hover:text-[#EDEDEF] group font-semibold"
                    onClick={() => handleSort('outputTokens')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Out Tokens</span>
                      {renderSortIndicator('outputTokens')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-3 text-right cursor-pointer hover:text-[#EDEDEF] group font-semibold"
                    onClick={() => handleSort('retries')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Retries</span>
                      {renderSortIndicator('retries')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="py-2 px-3 text-right cursor-pointer hover:text-[#EDEDEF] group font-semibold"
                    onClick={() => handleSort('cost')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Cost ({currency})</span>
                      {renderSortIndicator('cost')}
                    </div>
                  </th>
                  <th scope="col" className="py-2 px-3 text-center font-semibold">Status</th>
                  <th scope="col" className="py-2 px-3 text-right font-semibold">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226] font-mono text-[11px]">
                {displayedEvents.map((ev) => {
                  const isEstimated = ev.costBasis === 'estimated';
                  const isUnknown = ev.costBasis === 'unknown';
                  const origin = ev.recordOrigin || (ev.isSample ? 'sample' : ev.source === 'manual' ? 'manual' : 'imported');
                  const rowPadding = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-3.5';

                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-[#1C1C20]/60 transition-colors"
                    >
                      <td className={`${rowPadding} text-[#8B8B94] whitespace-nowrap`}>
                        {new Date(ev.timestamp).toLocaleDateString()}{' '}
                        <span className="text-[#5E5E68]">
                          {new Date(ev.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className={`${rowPadding} font-sans`}>
                        <div className="flex items-center gap-1.5 max-w-[210px]">
                          <span className="font-medium text-[#EDEDEF] truncate">{ev.project}</span>
                          {origin === 'sample' && (
                            <span className="text-[9px] font-mono bg-amber-950/40 text-amber-400 border border-amber-900/50 px-1 py-0.2 rounded shrink-0">
                              sample
                            </span>
                          )}
                          {origin === 'manual' && (
                            <span className="text-[9px] font-mono bg-[#1C1C20] text-purple-300 border border-purple-900/40 px-1 py-0.2 rounded shrink-0">
                              manual
                            </span>
                          )}
                          {origin === 'imported' && (
                            <span className="text-[9px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 px-1 py-0.2 rounded shrink-0">
                              imported
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#5E5E68] font-mono truncate max-w-[210px]">
                          {ev.task} · <span className="text-[#5E5E68]">{ev.source}</span>
                        </div>
                      </td>

                      <td className={rowPadding}>
                        <span className="text-[#7C6FF7] font-medium">{ev.model}</span>
                        <div className="text-[10px] text-[#5E5E68] uppercase">{ev.provider}</div>
                      </td>

                      <td className={`${rowPadding} text-right tabular-nums text-[#EDEDEF]`}>
                        {ev.inputTokens.toLocaleString()}
                        {ev.cachedInputTokens ? (
                          <div className="text-[10px] text-emerald-400">
                            {ev.cachedInputTokens.toLocaleString()} cached
                          </div>
                        ) : null}
                      </td>

                      <td className={`${rowPadding} text-right tabular-nums text-[#EDEDEF]`}>
                        {ev.outputTokens.toLocaleString()}
                      </td>

                      <td className={`${rowPadding} text-right tabular-nums`}>
                        <span
                          className={ev.retryCount > 0 ? 'text-amber-400 font-medium' : 'text-[#5E5E68]'}
                        >
                          {ev.retryCount}
                        </span>
                      </td>

                      <td className={`${rowPadding} text-right tabular-nums`}>
                        {isUnknown ? (
                          <div>
                            <span className="text-amber-400 font-medium text-[10px] bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.5 rounded inline-block">
                              Unknown
                            </span>
                            <div className="text-[9px] text-[#5E5E68] mt-0.5">no rate card</div>
                          </div>
                        ) : isEstimated ? (
                          <div>
                            <span className="text-[#EDEDEF] font-semibold">
                              ${(ev.estimatedCost ?? 0).toFixed(4)}
                            </span>
                            <div className="text-[9px] text-[#7C6FF7]">
                              estimated
                            </div>
                          </div>
                        ) : (
                          <div>
                            {ev.reportedCost === 0 ? (
                              <div>
                                <span className="text-emerald-400 font-semibold">
                                  {formatCurrency(0, ev.reportedCurrency || 'USD')}
                                </span>
                                <div className="text-[9px] text-emerald-400/80">
                                  reported (free)
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[#EDEDEF] font-semibold">
                                  {formatCurrency(ev.reportedCost, ev.reportedCurrency || 'USD')}
                                </span>
                                {ev.reportedCurrency && ev.reportedCurrency !== 'USD' ? (
                                  <div className="text-[9px] text-[#8B8B94]">
                                    ~${getEffectiveEventCost(ev).toFixed(4)} USD
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-[#5E5E68]">
                                    reported
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className={`${rowPadding} text-center`}>
                        {ev.status === 'success' ? (
                          <span className="inline-flex items-center text-emerald-400" title="Success">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        ) : ev.status === 'rate_limited' ? (
                          <span className="inline-flex items-center text-amber-400" title="Rate Limited (429)">
                            <Clock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-rose-400" title="Failed / Error">
                            <XCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>

                      <td className={`${rowPadding} text-right font-sans`}>
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(ev)}
                          aria-label={`Inspect event ${ev.id}`}
                          className="p-1 hover:bg-[#1C1C20] rounded text-[#8B8B94] hover:text-[#EDEDEF] transition-colors focus:outline-none"
                          title="Inspect raw event metadata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {groupBy === 'none' && events.length > 0 && (
          <div className="p-2.5 border-t border-[#29292F] bg-[#101012] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8B8B94]">
            <div>
              Showing {(pageIndex - 1) * pageSize + 1} to{' '}
              {Math.min(pageIndex * pageSize, sortedEvents.length)} of {sortedEvents.length} events
            </div>

            <div className="flex items-center gap-1 font-mono">
              <button
                type="button"
                disabled={pageIndex <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous Page"
                className="px-2.5 py-1 rounded-md bg-[#151518] hover:bg-[#1C1C20] disabled:opacity-30 disabled:pointer-events-none text-[#EDEDEF] border border-[#29292F] transition-colors focus:outline-none"
              >
                Prev
              </button>
              <span className="px-2 text-[11px] text-[#8B8B94]">
                {pageIndex} of {totalPages}
              </span>
              <button
                type="button"
                disabled={pageIndex >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next Page"
                className="px-2.5 py-1 rounded-md bg-[#151518] hover:bg-[#1C1C20] disabled:opacity-30 disabled:pointer-events-none text-[#EDEDEF] border border-[#29292F] transition-colors focus:outline-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Raw Event Inspection Modal */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-event-title"
          className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <div className="bg-[#151518] border border-[#29292F] rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#29292F] bg-[#101012]">
              <div>
                <h3 id="modal-event-title" className="text-xs font-semibold text-[#EDEDEF]">
                  Event Telemetry & Provenance
                </h3>
                <span className="text-[11px] font-mono text-[#8B8B94]">{selectedEvent.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close modal"
                className="p-1 rounded text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#1C1C20] focus:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-[#101012] p-3 rounded-md border border-[#29292F]">
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Timestamp</span>
                  <span className="text-[#EDEDEF]">{selectedEvent.timestamp}</span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Provider / Model</span>
                  <span className="text-[#7C6FF7] font-medium">{selectedEvent.provider} / {selectedEvent.model}</span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Cost Basis</span>
                  <span className={selectedEvent.costBasis === 'reported' ? 'text-emerald-400 font-medium' : 'text-[#7C6FF7] font-medium'}>
                    {selectedEvent.costBasis} (${(selectedEvent.reportedCost ?? selectedEvent.estimatedCost)?.toFixed(6) ?? 'N/A'})
                  </span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Tokens (In / Out / Cache)</span>
                  <span className="text-[#EDEDEF]">
                    {selectedEvent.inputTokens} / {selectedEvent.outputTokens} / {selectedEvent.cachedInputTokens ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Duration</span>
                  <span className="text-[#EDEDEF]">{selectedEvent.durationMs ? `${selectedEvent.durationMs}ms` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Record Provenance</span>
                  <span className="text-[#EDEDEF] capitalize font-medium flex items-center gap-1.5">
                    {(selectedEvent.recordOrigin || (selectedEvent.isSample ? 'sample' : selectedEvent.source === 'manual' ? 'manual' : 'imported')) === 'sample' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    {(selectedEvent.recordOrigin || (selectedEvent.isSample ? 'sample' : selectedEvent.source === 'manual' ? 'manual' : 'imported')) === 'manual' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    )}
                    {(selectedEvent.recordOrigin || (selectedEvent.isSample ? 'sample' : selectedEvent.source === 'manual' ? 'manual' : 'imported')) === 'imported' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                    {(selectedEvent.recordOrigin || (selectedEvent.isSample ? 'sample' : selectedEvent.source === 'manual' ? 'manual' : 'imported')) === 'sample'
                      ? 'Fictional Sample'
                      : (selectedEvent.recordOrigin || (selectedEvent.isSample ? 'sample' : selectedEvent.source === 'manual' ? 'manual' : 'imported')) === 'manual'
                      ? 'Manual Entry'
                      : 'User Imported'}
                  </span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Import Batch ID</span>
                  <span className="text-[#8B8B94] truncate block text-[10px]" title={selectedEvent.importBatchId}>
                    {selectedEvent.importBatchId || 'None (Direct Ingestion)'}
                  </span>
                </div>
                <div>
                  <span className="text-[#5E5E68] block text-[10px]">Fingerprint</span>
                  <span className="text-[#8B8B94] truncate block text-[10px]" title={selectedEvent.fingerprint}>
                    {selectedEvent.fingerprint || 'None'}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-[#8B8B94] font-medium text-[11px]">Extended Metadata Payload</h4>
                  <button
                    type="button"
                    onClick={handleCopyPayload}
                    className="flex items-center gap-1 text-[11px] text-[#8B8B94] hover:text-[#EDEDEF]"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#101012] p-3 rounded-md border border-[#29292F] text-[#EDEDEF] overflow-x-auto text-[11px] max-h-60">
                  {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-3 border-t border-[#29292F] bg-[#101012] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-3.5 py-1.5 bg-[#1C1C20] hover:bg-[#25252A] text-[#EDEDEF] border border-[#29292F] rounded-md text-xs font-medium focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
