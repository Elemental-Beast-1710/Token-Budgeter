import React from 'react';
import { Menu, UploadCloud } from 'lucide-react';
import { NavTab } from './Header';

interface TopBarProps {
  activeTab: NavTab;
  onOpenMobile: () => void;
  currency: string;
  hasSampleData: boolean;
  workspaceMode?: 'real' | 'demo';
  onToggleWorkspaceMode?: (mode: 'real' | 'demo') => void;
  onOpenImport: () => void;
  filteredCount?: number;
  totalCount?: number;
}

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Overview',
  explorer: 'Usage Explorer',
  projects: 'Projects & Tasks',
  optimization: 'Optimization Lab',
  analyst: 'AI Analyst',
  simulator: 'Savings Simulator',
  imports: 'Import & Pipeline',
  reports: 'Reports',
  settings: 'Settings',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onOpenMobile,
  currency,
  hasSampleData,
  workspaceMode = 'real',
  onToggleWorkspaceMode,
  onOpenImport,
  filteredCount,
  totalCount,
}) => {
  return (
    <header className="h-12 border-b border-[#29292F] bg-[#101012] px-4 flex items-center justify-between gap-3 shrink-0 z-20">
      {/* Left: Mobile Toggle + Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-1.5 text-[#8B8B94] hover:text-[#EDEDEF] rounded hover:bg-[#1C1C20] transition-colors focus:outline-none"
          title="Open Navigation"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 text-xs font-mono text-[#8B8B94] truncate">
          <span className="hidden sm:inline text-[#5E5E68]">TokenBudgeter</span>
          <span className="hidden sm:inline text-[#5E5E68]">/</span>
          <span className="text-[#EDEDEF] font-sans font-medium text-xs">
            {TAB_TITLES[activeTab] || 'Dashboard'}
          </span>
        </div>

        {/* Mode Indicator & Switcher */}
        {hasSampleData && onToggleWorkspaceMode ? (
          <div className="flex items-center gap-1 bg-[#151518] border border-[#29292F] p-0.5 rounded text-[10px] font-mono shrink-0">
            <button
              onClick={() => onToggleWorkspaceMode('real')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                workspaceMode === 'real'
                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 font-semibold'
                  : 'text-[#8B8B94] hover:text-[#EDEDEF]'
              }`}
              title="Show real user records only. Excludes fictional demo records from totals."
            >
              Real Data
            </button>
            <button
              onClick={() => onToggleWorkspaceMode('demo')}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                workspaceMode === 'demo'
                  ? 'bg-amber-950/60 text-amber-300 border border-amber-900/60 font-semibold'
                  : 'text-[#8B8B94] hover:text-[#EDEDEF]'
              }`}
              title="Demo Mode: Includes fictional sample workload for evaluation."
            >
              Demo Mode
            </button>
          </div>
        ) : hasSampleData ? (
          <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.5 rounded shrink-0">
            Demo Mode Active
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center text-[10px] font-mono text-emerald-400/80 bg-emerald-950/30 border border-emerald-900/40 px-1.5 py-0.5 rounded shrink-0">
            Real Workspace
          </span>
        )}
      </div>

      {/* Right: Quick Context & Actions */}
      <div className="flex items-center gap-3 shrink-0 text-xs">
        {filteredCount !== undefined && totalCount !== undefined && (
          <div className="hidden md:flex items-center gap-1 font-mono text-[11px] text-[#8B8B94]">
            <span className="text-[#EDEDEF] font-semibold tabular-nums">{filteredCount}</span>
            <span className="text-[#5E5E68]">/</span>
            <span className="tabular-nums">{totalCount}</span>
            <span className="text-[#5E5E68]">events</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-[#5E5E68]">Base:</span>
          <span className="px-1.5 py-0.5 rounded bg-[#151518] border border-[#29292F] text-[#EDEDEF]">
            {currency}
          </span>
        </div>

        <button
          onClick={onOpenImport}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors shadow-2xs active:scale-[0.98]"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Ingest Data</span>
        </button>
      </div>
    </header>
  );
};
