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
  Bot,
  ChevronLeft,
  ChevronRight,
  Database,
  X,
} from 'lucide-react';
import { NavTab } from './Header';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currency: string;
  hasSampleData: boolean;
  onOpenImport: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavGroup {
  label: string;
  items: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  currency,
  hasSampleData,
  onOpenImport,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navGroups: NavGroup[] = [
    {
      label: 'Analytics',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'explorer', label: 'Usage Explorer', icon: TableProperties },
        { id: 'projects', label: 'Projects & Tasks', icon: FolderGit2 },
      ],
    },
    {
      label: 'Optimization',
      items: [
        { id: 'optimization', label: 'Optimization Lab', icon: Sparkles },
        { id: 'simulator', label: 'Savings Simulator', icon: Calculator },
        { id: 'analyst', label: 'AI Analyst', icon: Bot },
      ],
    },
    {
      label: 'Management',
      items: [
        { id: 'imports', label: 'Import & Pipeline', icon: UploadCloud },
        { id: 'reports', label: 'Reports', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-[#101012] select-none text-[#EDEDEF]">
      {/* Top Header & Brand */}
      <div>
        <div className="h-13 px-3.5 flex items-center justify-between border-b border-[#29292F]">
          <button
            onClick={() => {
              onTabChange('overview');
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 text-left focus:outline-none group"
            title="TokenBudgeter Home"
          >
            <div className="w-6.5 h-6.5 rounded-md bg-[#151518] border border-[#29292F] flex items-center justify-center text-[#7C6FF7] font-semibold text-xs tracking-tighter shadow-xs group-hover:border-[#7C6FF7]/50 transition-colors">
              TB
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-tight text-[#EDEDEF] group-hover:text-white transition-colors">
                  TokenBudgeter
                </span>
                <span className="text-[10px] font-mono text-[#8B8B94]">
                  AI Cost Engineering
                </span>
              </div>
            )}
          </button>

          {/* Close button for mobile or collapse toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 text-[#8B8B94] hover:text-[#EDEDEF] rounded hover:bg-[#1C1C20]"
              title="Close Navigation"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1 text-[#8B8B94] hover:text-[#EDEDEF] rounded hover:bg-[#1C1C20] transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Import Action */}
        <div className="p-2.5">
          <button
            onClick={() => {
              onOpenImport();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md bg-[#7C6FF7] hover:bg-[#6B5EE4] text-white transition-all shadow-xs active:scale-[0.98] ${
              isCollapsed ? 'px-0' : 'px-3'
            }`}
            title="Import Logs"
          >
            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span className="truncate">Import Logs</span>}
          </button>
        </div>

        {/* Sample dataset banner if active */}
        {hasSampleData && !isCollapsed && (
          <div className="mx-2.5 mb-2 px-2.5 py-1.5 rounded-md bg-[#151518] border border-amber-900/40 flex items-center justify-between text-[10px] font-mono text-amber-400">
            <span>Sample Demo Data</span>
            <span className="text-[#8B8B94]">Active</span>
          </div>
        )}

        {/* Grouped Nav Items */}
        <nav className="px-2 space-y-4 py-1" aria-label="Sidebar Navigation">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-2 py-1 text-[10px] font-medium tracking-wider text-[#8B8B94] uppercase font-mono">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left relative ${
                        isActive
                          ? 'bg-[#1C1C20] text-[#EDEDEF] border border-[#29292F] font-medium shadow-2xs'
                          : 'text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#151518]'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                      title={item.label}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#7C6FF7]' : 'text-[#8B8B94]'}`} />
                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}
                      {isActive && (
                        <span className="w-1 h-3.5 rounded-full bg-[#7C6FF7] absolute right-1.5 hidden lg:block" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Metadata & System State */}
      <div className="p-3 border-t border-[#29292F] space-y-2 text-[11px] font-mono text-[#8B8B94]">
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[#5E5E68]">Currency</span>
              <span className="text-[#EDEDEF] px-1.5 py-0.5 rounded bg-[#151518] border border-[#29292F]">
                {currency}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5 text-[#8B8B94]">
                <Database className="w-3 h-3 text-[#7C6FF7]" />
                <span>IndexedDB v2</span>
              </div>
              <span className="text-emerald-400">Local</span>
            </div>
          </>
        ) : (
          <div className="flex justify-center text-[10px] text-[#8B8B94]" title={`${currency} · Local Storage`}>
            <span>{currency}</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-[#29292F] sticky top-0 h-screen transition-all duration-200 z-30 ${
          isCollapsed ? 'w-14' : 'w-56 xl:w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-[#101012] border-r border-[#29292F] shadow-2xl flex flex-col z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
