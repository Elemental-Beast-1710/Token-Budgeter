import React from 'react';
import {
  LayoutDashboard,
  TableProperties,
  FolderGit2,
  Sparkles,
  Calculator,
  UploadCloud,
  FileText,
  Settings,
} from 'lucide-react';

import { NavTab } from '../types';
export type { NavTab };

interface HeaderProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currency: string;
  hasSampleData: boolean;
  onOpenImport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  currency,
  hasSampleData,
  onOpenImport,
}) => {
  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'explorer', label: 'Usage Explorer', icon: <TableProperties className="w-3.5 h-3.5" /> },
    { id: 'projects', label: 'Projects & Tasks', icon: <FolderGit2 className="w-3.5 h-3.5" /> },
    { id: 'optimization', label: 'Optimization Lab', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'analyst', label: 'AI Analyst', icon: <Sparkles className="w-3.5 h-3.5 text-[#7C6FF7]" /> },
    { id: 'simulator', label: 'Savings Simulator', icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'imports', label: 'Import & Pipeline', icon: <UploadCloud className="w-3.5 h-3.5" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="border-b border-[#29292F] bg-[#101012] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-12">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onTabChange('overview')}
            aria-label="TokenBudgeter Home"
            className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FF7] rounded"
          >
            <div className="w-6 h-6 rounded bg-[#7C6FF7] flex items-center justify-center text-white font-bold text-xs tracking-tighter select-none">
              TB
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#EDEDEF] whitespace-nowrap">
              TokenBudgeter
            </span>
          </button>

          {hasSampleData && (
            <span
              className="hidden sm:inline-flex items-center text-[10px] font-mono text-amber-400 bg-[#151518] border border-[#29292F] px-1.5 py-0.5 rounded"
              title="Currently showing sample demo dataset"
            >
              Sample Data
            </span>
          )}
        </div>

        {/* Zone 2: Navigation Links (single-line desktop tabs) */}
        <nav
          role="tablist"
          aria-label="Main Navigation"
          className="hidden xl:flex items-center gap-1 overflow-x-auto py-1"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FF7] ${
                  isActive
                    ? 'bg-[#1C1C20] text-[#EDEDEF] border border-[#29292F]'
                    : 'text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#151518]'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action & Context Info */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#8B8B94] font-mono">
            <span className="text-[#5E5E68]">Base:</span>
            <span className="text-[#EDEDEF] font-semibold px-1.5 py-0.5 rounded bg-[#151518] border border-[#29292F]">
              {currency}
            </span>
          </div>

          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6D5FE6] rounded transition-colors whitespace-nowrap shrink-0 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FF7]"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Import Logs</span>
          </button>
        </div>
      </div>

      {/* Responsive Horizontal Navigation Strip (visible on mobile and tablet < 1280px) */}
      <div className="xl:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-[#29292F] bg-[#101012] scrollbar-none">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FF7] ${
                isActive
                  ? 'bg-[#1C1C20] text-[#EDEDEF] border border-[#29292F] font-semibold'
                  : 'text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#151518]'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
