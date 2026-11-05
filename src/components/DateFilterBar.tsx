import React from 'react';
import { Calendar, Filter, RotateCcw, Search, X } from 'lucide-react';
import { DateRangePreset, FilterState } from '../types';

interface DateFilterBarProps {
  filter: FilterState;
  onChange: (newFilter: FilterState) => void;
  availableProviders: string[];
  availableProjects: string[];
  availableModels: string[];
  filteredCount: number;
  totalCount: number;
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  filter,
  onChange,
  availableProviders,
  availableProjects,
  availableModels,
  filteredCount,
  totalCount,
}) => {
  const datePresets: Array<{ id: DateRangePreset; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];

  const handlePresetClick = (preset: DateRangePreset) => {
    onChange({
      ...filter,
      datePreset: preset,
    });
  };

  const handleReset = () => {
    onChange({
      datePreset: '30d',
      provider: 'all',
      model: 'all',
      project: 'all',
      task: 'all',
      status: 'all',
      costBasis: 'all',
      source: 'all',
      searchQuery: '',
    });
  };

  const hasActiveCustomFilters =
    filter.datePreset !== '30d' ||
    filter.provider !== 'all' ||
    filter.model !== 'all' ||
    filter.project !== 'all' ||
    filter.costBasis !== 'all' ||
    Boolean(filter.searchQuery);

  return (
    <div className="bg-[#101012] border-b border-[#29292F] px-4 sm:px-6 py-2.5 space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Date Presets Segmented Control */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Date presets"
            className="flex items-center gap-0.5 bg-[#151518] p-0.5 rounded-md border border-[#29292F]"
          >
            <Calendar className="w-3.5 h-3.5 text-[#8B8B94] ml-1.5 mr-1 shrink-0" />
            {datePresets.map((preset) => {
              const isSelected = filter.datePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`px-2 py-0.5 text-xs font-medium rounded transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7] ${
                    isSelected
                      ? 'bg-[#1C1C20] text-[#EDEDEF] border border-[#29292F] font-medium'
                      : 'text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#1C1C20]/50'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Inputs if Custom is selected */}
          {filter.datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs bg-[#151518] p-1 rounded-md border border-[#29292F]">
              <span className="text-[#8B8B94] pl-1 text-[11px]">From</span>
              <input
                type="date"
                aria-label="Start Date"
                value={filter.customStartDate || ''}
                onChange={(e) => onChange({ ...filter, customStartDate: e.target.value })}
                className="bg-[#101012] border border-[#29292F] rounded px-1.5 py-0.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-mono text-xs"
              />
              <span className="text-[#8B8B94] text-[11px]">To</span>
              <input
                type="date"
                aria-label="End Date"
                value={filter.customEndDate || ''}
                onChange={(e) => onChange({ ...filter, customEndDate: e.target.value })}
                className="bg-[#101012] border border-[#29292F] rounded px-1.5 py-0.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-mono text-xs"
              />
            </div>
          )}
        </div>

        {/* Search Bar & Reset Action */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-60">
            <Search className="w-3.5 h-3.5 text-[#5E5E68] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search filter"
              placeholder="Search tasks, models..."
              value={filter.searchQuery}
              onChange={(e) => onChange({ ...filter, searchQuery: e.target.value })}
              className="w-full bg-[#151518] border border-[#29292F] rounded-md pl-8 pr-7 py-1 text-xs text-[#EDEDEF] placeholder-[#5E5E68] focus:outline-none focus:border-[#7C6FF7] focus-visible:ring-1 focus-visible:ring-[#7C6FF7] font-mono"
            />
            {filter.searchQuery && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => onChange({ ...filter, searchQuery: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8B8B94] hover:text-[#EDEDEF] focus:outline-none"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {hasActiveCustomFilters && (
            <button
              type="button"
              onClick={handleReset}
              title="Reset all filters to 30-day default"
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#8B8B94] hover:text-[#EDEDEF] bg-[#151518] hover:bg-[#1C1C20] rounded-md border border-[#29292F] transition-colors whitespace-nowrap focus:outline-none"
            >
              <RotateCcw className="w-3 h-3 text-[#8B8B94]" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <div className="text-[11px] font-mono text-[#8B8B94] whitespace-nowrap bg-[#151518] px-2 py-0.5 rounded border border-[#29292F]">
            <span className="text-[#EDEDEF] font-semibold tabular-nums">{filteredCount}</span>
            <span className="text-[#5E5E68]"> / {totalCount}</span>
          </div>
        </div>
      </div>

      {/* Secondary Dimension Filters */}
      <div className="flex flex-wrap items-center gap-2 pt-1.5 text-xs border-t border-[#222226]">
        <div className="flex items-center gap-1 text-[#8B8B94] font-mono text-[10px] uppercase tracking-wider">
          <Filter className="w-3 h-3 text-[#5E5E68]" />
          <span>Filters:</span>
        </div>

        {/* Provider select */}
        <div className="flex items-center gap-1">
          <label htmlFor="filter-provider" className="text-[#8B8B94] text-[11px]">Provider:</label>
          <select
            id="filter-provider"
            value={filter.provider}
            onChange={(e) => onChange({ ...filter, provider: e.target.value })}
            className="bg-[#151518] border border-[#29292F] text-[#EDEDEF] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#7C6FF7]"
          >
            <option value="all">All Providers</option>
            {availableProviders.map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Project select */}
        <div className="flex items-center gap-1">
          <label htmlFor="filter-project" className="text-[#8B8B94] text-[11px]">Project:</label>
          <select
            id="filter-project"
            value={filter.project}
            onChange={(e) => onChange({ ...filter, project: e.target.value })}
            className="bg-[#151518] border border-[#29292F] text-[#EDEDEF] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#7C6FF7]"
          >
            <option value="all">All Projects</option>
            {availableProjects.map((proj) => (
              <option key={proj} value={proj}>
                {proj}
              </option>
            ))}
          </select>
        </div>

        {/* Model select */}
        <div className="flex items-center gap-1">
          <label htmlFor="filter-model" className="text-[#8B8B94] text-[11px]">Model:</label>
          <select
            id="filter-model"
            value={filter.model}
            onChange={(e) => onChange({ ...filter, model: e.target.value })}
            className="bg-[#151518] border border-[#29292F] text-[#EDEDEF] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#7C6FF7]"
          >
            <option value="all">All Models</option>
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Cost Basis select */}
        <div className="flex items-center gap-1">
          <label htmlFor="filter-costbasis" className="text-[#8B8B94] text-[11px]">Cost Basis:</label>
          <select
            id="filter-costbasis"
            value={filter.costBasis}
            onChange={(e) => onChange({ ...filter, costBasis: e.target.value })}
            className="bg-[#151518] border border-[#29292F] text-[#EDEDEF] rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#7C6FF7]"
          >
            <option value="all">All Bases</option>
            <option value="reported">Reported Only</option>
            <option value="estimated">Estimated Only</option>
            <option value="unknown">Unknown Only</option>
          </select>
        </div>
      </div>
    </div>
  );
};
