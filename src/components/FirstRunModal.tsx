import React from 'react';
import { Layers, PlayCircle, FolderPlus, ShieldCheck, ArrowRight } from 'lucide-react';

interface FirstRunModalProps {
  onExploreDemo: () => void;
  onStartFresh: () => void;
  isLoading?: boolean;
}

export const FirstRunModal: React.FC<FirstRunModalProps> = ({
  onExploreDemo,
  onStartFresh,
  isLoading = false,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
    >
      <div className="bg-[#151518] border border-[#29292F] rounded-xl max-w-xl w-full p-6 sm:p-7 space-y-6 shadow-2xl text-xs animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-[#7C6FF7]/10 text-[#7C6FF7] border border-[#7C6FF7]/20">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#7C6FF7] bg-[#7C6FF7]/10 px-2 py-0.5 rounded border border-[#7C6FF7]/20 font-semibold">
              First-Run Setup
            </span>
          </div>

          <h2 id="first-run-title" className="text-base sm:text-lg font-semibold text-[#EDEDEF]">
            Welcome to TokenBudgeter
          </h2>
          <p className="text-xs text-[#8B8B94] leading-relaxed">
            Choose how you would like to initialize your local browser workspace. TokenBudgeter never
            silently injects fictional records into production workspaces.
          </p>
        </div>

        {/* Option Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Option A: Explore Demo */}
          <div className="p-4 bg-[#101012] border border-[#29292F] hover:border-[#7C6FF7]/60 rounded-lg flex flex-col justify-between space-y-3.5 transition-colors group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#7C6FF7]">
                  <PlayCircle className="w-4 h-4" />
                  <span className="font-semibold text-[#EDEDEF]">Explore Demo</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#7C6FF7]/10 text-[#7C6FF7] border border-[#7C6FF7]/20">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-[#8B8B94] leading-relaxed">
                Populate with a realistic fictional AI workload (68 events across Claude 3.5 Sonnet, GPT-4o, and Gemini)
                simulating PR reviews, flaky retries, duplicates, and prompt caching.
              </p>
            </div>

            <button
              onClick={onExploreDemo}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-[#7C6FF7] hover:bg-[#6D5FE6] text-white rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50"
            >
              <span>Explore Demo Data</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Option B: Start Fresh */}
          <div className="p-4 bg-[#101012] border border-[#29292F] hover:border-[#EDEDEF]/40 rounded-lg flex flex-col justify-between space-y-3.5 transition-colors group">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400">
                  <FolderPlus className="w-4 h-4" />
                  <span className="font-semibold text-[#EDEDEF]">Start Fresh</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#151518] text-[#8B8B94] border border-[#29292F]">
                  Clean Workspace
                </span>
              </div>
              <p className="text-[11px] text-[#8B8B94] leading-relaxed">
                Open a pristine, completely empty workspace with standard rate card catalogs. Zero sample records
                will be stored. Ready for CSV/JSON imports or provider sync.
              </p>
            </div>

            <button
              onClick={onStartFresh}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-[#1C1C20] hover:bg-[#25252A] text-[#EDEDEF] border border-[#29292F] hover:border-[#383842] rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50"
            >
              <span>Start Fresh Workspace</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#8B8B94]" />
            </button>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="pt-2 border-t border-[#29292F] flex items-center gap-2 text-[11px] text-[#5E5E68] font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Local-first architecture: All data stays in your browser. Zero telemetry sent to remote servers.</span>
        </div>
      </div>
    </div>
  );
};
