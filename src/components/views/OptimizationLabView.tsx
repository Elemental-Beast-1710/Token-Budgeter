import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Repeat,
  Layers,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Loader2,
  X,
  FileCode,
  Filter,
  Activity,
  Beaker,
  AlertOctagon,
  Cpu,
  Info,
  Check,
  Copy,
  RotateCcw,
} from 'lucide-react';
import { OptimizationFinding, UsageEvent, InefficiencyType } from '../../types';
import { detectInefficiencies, getEffectiveEventCost } from '../../services/analytics';
import { formatCurrency } from '../../services/currency';

interface OptimizationLabViewProps {
  events: UsageEvent[];
  currency: string;
}

export const OptimizationLabView: React.FC<OptimizationLabViewProps> = ({ events, currency }) => {
  const allFindings = useMemo(() => detectInefficiencies(events), [events]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Supporting records inspector modal
  const [inspectingFinding, setInspectingFinding] = useState<OptimizationFinding | null>(null);

  // Gemini narrative assistant
  const [activeGeminiFindingId, setActiveGeminiFindingId] = useState<string | null>(null);
  const [loadingGeminiId, setLoadingGeminiId] = useState<string | null>(null);
  const [geminiExplanations, setGeminiExplanations] = useState<Record<string, string>>({});
  const [geminiErrors, setGeminiErrors] = useState<Record<string, string>>({});
  const [copiedGeminiId, setCopiedGeminiId] = useState<string | null>(null);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectingFinding) {
        setInspectingFinding(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingFinding]);

  // Filtered findings
  const filteredFindings = useMemo(() => {
    return allFindings.filter((f) => {
      if (selectedCategory !== 'all' && f.type !== selectedCategory) return false;
      if (selectedSeverity !== 'all' && f.severity !== selectedSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          f.title.toLowerCase().includes(q) ||
          f.pattern.toLowerCase().includes(q) ||
          f.calculationRule.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allFindings, selectedCategory, selectedSeverity, searchQuery]);

  // High-level aggregates
  const totalWastedCost = useMemo(() => {
    return allFindings.reduce((sum, f) => sum + (f.metrics.estimatedExcessCostUsd || 0), 0);
  }, [allFindings]);

  const totalBaselineSpend = useMemo(() => {
    return allFindings.reduce((sum, f) => sum + (f.metrics.baselineCostUsd || 0), 0);
  }, [allFindings]);

  // Resolve supporting event records for inspector modal
  const inspectedEvents = useMemo(() => {
    if (!inspectingFinding) return [];
    const idSet = new Set(inspectingFinding.supportingEventIds);
    return events.filter((e) => idSet.has(e.id));
  }, [inspectingFinding, events]);

  const handleAskGemini = async (finding: OptimizationFinding) => {
    if (geminiExplanations[finding.id]) {
      setActiveGeminiFindingId(activeGeminiFindingId === finding.id ? null : finding.id);
      return;
    }

    setLoadingGeminiId(finding.id);
    setGeminiErrors((prev) => ({ ...prev, [finding.id]: '' }));

    try {
      const res = await fetch('/api/gemini/explain-finding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingTitle: finding.title,
          pattern: finding.pattern,
          proposedAction: finding.proposedAction,
          tradeOffs: finding.expectedTradeOffs,
          metrics: finding.metrics,
          facts: finding.measuredFacts.facts,
          hypotheses: finding.hypotheses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request explanation from Gemini.');
      }

      setGeminiExplanations((prev) => ({
        ...prev,
        [finding.id]: data.explanation,
      }));
      setActiveGeminiFindingId(finding.id);
    } catch (err: any) {
      setGeminiErrors((prev) => ({
        ...prev,
        [finding.id]: err.message || 'Error communicating with Gemini service.',
      }));
    } finally {
      setLoadingGeminiId(null);
    }
  };

  const handleCopyGemini = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedGeminiId(id);
    setTimeout(() => setCopiedGeminiId(null), 2000);
  };

  const getCategoryIcon = (type: InefficiencyType) => {
    switch (type) {
      case 'duplicate_requests':
        return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
      case 'retry_loop':
        return <Repeat className="w-3.5 h-3.5 text-amber-400" />;
      case 'uncached_prompt':
      case 'high_context_ratio':
        return <Cpu className="w-3.5 h-3.5 text-indigo-400" />;
      case 'failure_waste':
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
      case 'cost_concentration':
        return <Activity className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getCategoryLabel = (type: InefficiencyType) => {
    switch (type) {
      case 'duplicate_requests':
        return 'Repeated Requests';
      case 'retry_loop':
        return 'Runaway Retry Loop';
      case 'uncached_prompt':
        return 'Uncached Large Context';
      case 'high_context_ratio':
        return 'High Context Ratio';
      case 'failure_waste':
        return 'Recorded Failure Waste';
      case 'cost_concentration':
        return 'Spend Concentration';
      default:
        return 'Efficiency Pattern';
    }
  };

  return (
    <div className="space-y-4">
      {/* View Header with Baseline Spend & Recoverable Projection */}
      <div className="bg-[#151518] border border-[#29292F] p-4 sm:p-5 rounded-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#1C1C20] border border-[#29292F] flex items-center justify-center text-[#7C6FF7] shrink-0">
              <Beaker className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2">
                <span>Optimization Lab</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1C1C20] text-[#8B8B94] border border-[#29292F]">
                  Deterministic Detection Engine
                </span>
              </h2>
              <p className="text-xs text-[#8B8B94]">
                Audits telemetry against deterministic rules for duplicate prompts, retry loops, uncached context, and failures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="bg-[#101012] border border-[#29292F] px-3 py-1.5 rounded-md text-right">
              <div className="text-[10px] text-[#5E5E68] uppercase font-mono">Analyzed Baseline</div>
              <div className="text-[#EDEDEF] font-bold tabular-nums">
                {formatCurrency(totalBaselineSpend, currency)}
              </div>
            </div>
            <div className="bg-[#101012] border border-[#29292F] px-3 py-1.5 rounded-md text-right">
              <div className="text-[10px] text-[#5E5E68] uppercase font-mono">Est. Recoverable</div>
              <div className="text-rose-400 font-bold tabular-nums">
                {formatCurrency(totalWastedCost, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Working Principle Banner */}
        <div className="bg-[#101012] p-2.5 rounded-md border border-[#29292F] text-xs text-[#8B8B94] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-medium text-[#EDEDEF]">Working Principle: </span>
            <span>
              Measure first, explain second, recommend third. Every finding separates{' '}
              <strong className="text-[#EDEDEF] font-medium">measured facts</strong> from{' '}
              <strong className="text-[#EDEDEF] font-medium">hypotheses</strong>, requires a documented mathematical rule, and links to verifiable source events.
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-[#151518] border border-[#29292F] p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Category Tabs */}
        <div role="tablist" aria-label="Pattern Categories" className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Patterns' },
            { id: 'duplicate_requests', label: 'Repeated Requests' },
            { id: 'retry_loop', label: 'Retry Loops' },
            { id: 'uncached_prompt', label: 'Large Contexts' },
            { id: 'failure_waste', label: 'Failure Waste' },
            { id: 'cost_concentration', label: 'Concentration' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7] ${
                selectedCategory === cat.id
                  ? 'bg-[#7C6FF7] text-white font-medium shadow-xs'
                  : 'bg-[#101012] text-[#8B8B94] hover:text-[#EDEDEF] border border-[#29292F] hover:bg-[#1C1C20]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Severity Filter and Search */}
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by Severity"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded-md px-2.5 py-1 focus:outline-none focus:border-[#7C6FF7] font-mono text-xs"
          >
            <option value="all">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </select>

          <input
            type="text"
            aria-label="Search findings"
            placeholder="Search rules, tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] placeholder-[#5E5E68] rounded-md px-2.5 py-1 focus:outline-none focus:border-[#7C6FF7] font-mono text-xs w-36 sm:w-48"
          />
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-10 text-center space-y-3">
          <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
          <h3 className="text-xs font-semibold text-[#EDEDEF]">No Inefficiencies Detected Under Active Filter</h3>
          <p className="text-xs text-[#8B8B94] max-w-md mx-auto">
            All active events conform to nominal operating parameters with healthy retry rates, reasonable context ratios, and no duplicate query spikes.
          </p>
          {(selectedCategory !== 'all' || selectedSeverity !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedSeverity('all');
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1C1C20] hover:bg-[#222226] text-xs font-medium text-[#EDEDEF] border border-[#29292F] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#8B8B94]" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFindings.map((finding) => {
            const hasGeminiExplanation = Boolean(geminiExplanations[finding.id]);
            const isGeminiExpanded = activeGeminiFindingId === finding.id;
            const isLoadingGemini = loadingGeminiId === finding.id;
            const geminiError = geminiErrors[finding.id];

            return (
              <div
                key={finding.id}
                className="bg-[#151518] border border-[#29292F] rounded-lg overflow-hidden transition-all duration-150 shadow-xs"
              >
                {/* 1. Header Banner */}
                <div className="p-4 border-b border-[#29292F] space-y-2 bg-[#151518]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border ${
                          finding.severity === 'high'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-900/60'
                            : 'bg-amber-950/60 text-amber-300 border-amber-900/60'
                        }`}
                      >
                        {finding.severity} Impact
                      </span>

                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#101012] border border-[#29292F] text-[11px] font-mono text-[#8B8B94]">
                        {getCategoryIcon(finding.type)}
                        <span>{getCategoryLabel(finding.type)}</span>
                      </div>

                      <h3 className="text-xs font-semibold text-[#EDEDEF] tracking-tight">{finding.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectingFinding(finding)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-[#101012] hover:bg-[#1C1C20] text-[#7C6FF7] rounded-md border border-[#29292F] transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Inspect Records ({finding.supportingEventIds.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Pattern Statement */}
                  <p className="text-xs text-[#8B8B94] leading-relaxed font-sans">
                    {finding.pattern}
                  </p>
                </div>

                {/* 2. Fact vs Hypothesis vs Comparison Multi-Zone Grid */}
                <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs bg-[#101012]">
                  {/* Left Column (5 cols): Measured Facts & Detection Rule */}
                  <div className="lg:col-span-5 space-y-3">
                    {/* Zone A: Measured Facts (Ground Truth) */}
                    <div className="bg-[#151518] p-3 rounded-md border border-[#29292F] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Measured Facts (Ground Truth)</span>
                        </span>
                        <span className="text-[10px] font-mono text-[#5E5E68]">
                          {finding.measuredFacts.recordsAnalyzed} records
                        </span>
                      </div>

                      <ul className="space-y-1.5 text-[11px] text-[#EDEDEF]">
                        {finding.measuredFacts.facts.map((fact, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-mono mt-0.5">•</span>
                            <span className="text-[#8B8B94]">{fact}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Zone B: Detection Rule & Confidence */}
                    <div className="bg-[#151518] p-3 rounded-md border border-[#29292F] space-y-2 font-mono">
                      <div className="text-[10px] uppercase font-medium text-[#8B8B94]">
                        Deterministic Detection Rule
                      </div>
                      <div className="text-[11px] text-[#EDEDEF] bg-[#101012] p-2 rounded border border-[#29292F] overflow-x-auto">
                        {finding.calculationRule}
                      </div>
                      <div className="text-[11px] text-[#8B8B94] font-sans pt-0.5">
                        <span className="font-medium text-emerald-400 font-mono uppercase mr-1">
                          [{finding.confidenceLevel} Confidence]:
                        </span>
                        {finding.confidenceJustification}
                      </div>
                    </div>
                  </div>

                  {/* Middle Column (4 cols): Hypotheses & Experiments */}
                  <div className="lg:col-span-4 space-y-3">
                    {/* Zone C: Hypotheses (Potential Causes) */}
                    <div className="bg-[#151518] p-3 rounded-md border border-[#29292F] space-y-2">
                      <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Hypotheses (Potential Causes)</span>
                      </div>

                      <ul className="space-y-1.5 text-[11px] text-[#8B8B94]">
                        {finding.hypotheses.map((hypo, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-mono mt-0.5">?</span>
                            <span>{hypo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Zone D: Recommended Experiments */}
                    <div className="bg-[#151518] p-3 rounded-md border border-[#29292F] space-y-2">
                      <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#7C6FF7] flex items-center gap-1.5">
                        <Beaker className="w-3.5 h-3.5" />
                        <span>Recommended Experiments</span>
                      </div>

                      <div className="space-y-2">
                        {finding.recommendedExperiments.map((exp, idx) => (
                          <div key={idx} className="p-2.5 bg-[#101012] rounded-md border border-[#29292F] space-y-1">
                            <div className="font-medium text-[#EDEDEF] text-[11px]">{exp.name}</div>
                            <p className="text-[11px] text-[#8B8B94] leading-snug">{exp.description}</p>
                            <div className="flex items-center justify-between text-[10px] font-mono text-[#7C6FF7] pt-1">
                              <span>Target: {exp.targetMetric}</span>
                              <span className="text-[#5E5E68]">{exp.sampleSize}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column (3 cols): Baseline vs Comparison & Limitations */}
                  <div className="lg:col-span-3 space-y-3 flex flex-col justify-between">
                    {/* Zone E: Baseline vs Comparison */}
                    <div className="bg-[#151518] p-3 rounded-md border border-[#29292F] space-y-2.5 font-mono">
                      <div className="text-[10px] uppercase font-medium text-[#8B8B94]">
                        Baseline vs. Comparison
                      </div>

                      <div className="space-y-2 text-[11px]">
                        <div className="p-2 bg-[#101012] rounded-md border border-[#29292F]">
                          <div className="text-[10px] text-[#5E5E68]">{finding.baselineVsComparison.baselineLabel}</div>
                          <div className="text-[#EDEDEF] font-bold mt-0.5 tabular-nums">
                            {finding.baselineVsComparison.baselineValue}
                          </div>
                        </div>

                        <div className="p-2 bg-[#1C1C20] rounded-md border border-[#29292F]">
                          <div className="text-[10px] text-[#7C6FF7]">{finding.baselineVsComparison.projectedLabel}</div>
                          <div className="text-emerald-400 font-bold mt-0.5 tabular-nums">
                            {finding.baselineVsComparison.projectedValue}
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-[#8B8B94] font-sans border-t border-[#29292F] pt-2">
                        <span className="font-medium text-[#EDEDEF] font-mono">Certainty: </span>
                        {finding.baselineVsComparison.certainty}
                      </div>
                    </div>

                    {/* Zone F: Known Limitations */}
                    <div className="bg-[#151518] p-3 rounded-md border border-[#29292F] space-y-1.5 font-sans">
                      <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#8B8B94] flex items-center gap-1">
                        <Info className="w-3 h-3 text-[#5E5E68]" />
                        <span>Known Limitations</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-[#8B8B94] leading-snug">
                        {finding.knownLimitations.map((lim, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-[#5E5E68] font-mono">•</span>
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 3. Proposed Engineering Action Strip */}
                <div className="p-3 bg-[#151518] border-t border-[#29292F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold font-mono text-[#7C6FF7] uppercase text-[10px] shrink-0">
                      Action:
                    </span>
                    <span className="text-[#EDEDEF]">{finding.proposedAction}</span>
                  </div>

                  <div className="text-[11px] text-[#8B8B94] font-mono shrink-0">
                    Trade-off: <span className="text-[#EDEDEF] font-sans">{finding.expectedTradeOffs}</span>
                  </div>
                </div>

                {/* 4. On-Demand Gemini AI Plain-Language Assistant Footer */}
                <div className="p-3 bg-[#101012] border-t border-[#29292F] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-[#8B8B94]">
                      <Sparkles className="w-3.5 h-3.5 text-[#7C6FF7] shrink-0" />
                      <span>Plain-Language Synthesis:</span>
                      <span className="text-[11px] font-mono text-[#5E5E68] hidden sm:inline">
                        Optional Gemini summary of verified findings
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAskGemini(finding)}
                      disabled={isLoadingGemini}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-[#1C1C20] hover:bg-[#222226] text-[#EDEDEF] rounded-md border border-[#29292F] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
                    >
                      {isLoadingGemini ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-[#7C6FF7]" />
                          <span>Consulting Gemini...</span>
                        </>
                      ) : hasGeminiExplanation ? (
                        <span>{isGeminiExpanded ? 'Hide AI Summary' : 'View AI Summary'}</span>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-[#7C6FF7]" />
                          <span>Explain with Gemini</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Gemini Error Display */}
                  {geminiError && (
                    <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2.5 rounded-md">
                      {geminiError}
                    </div>
                  )}

                  {/* Expanded AI Explanation Panel */}
                  {isGeminiExpanded && geminiExplanations[finding.id] && (
                    <div className="p-3.5 bg-[#151518] border border-[#29292F] rounded-md text-xs text-[#EDEDEF] space-y-2 mt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#7C6FF7] border-b border-[#29292F] pb-1.5">
                        <span>AI-Generated Narrative Synthesis (gemini-3.8-flash)</span>
                        <button
                          type="button"
                          onClick={() => handleCopyGemini(finding.id, geminiExplanations[finding.id])}
                          className="flex items-center gap-1 text-[10px] text-[#8B8B94] hover:text-[#EDEDEF]"
                        >
                          {copiedGeminiId === finding.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Summary</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="prose prose-invert prose-xs text-[#EDEDEF] whitespace-pre-line leading-relaxed font-sans">
                        {geminiExplanations[finding.id]}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supporting Records Inspector Modal */}
      {inspectingFinding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-title"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <div className="bg-[#151518] border border-[#29292F] rounded-lg max-w-4xl w-full p-4 sm:p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#29292F] pb-3">
              <div>
                <h3 id="inspector-title" className="text-xs font-semibold text-[#EDEDEF] flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#7C6FF7]" />
                  <span>Supporting Records: {inspectingFinding.title}</span>
                </h3>
                <p className="text-[11px] text-[#8B8B94] mt-0.5 font-mono">
                  Showing {inspectedEvents.length} verifiable source records linked to this anomaly
                </p>
              </div>

              <button
                type="button"
                onClick={() => setInspectingFinding(null)}
                aria-label="Close modal"
                className="p-1 text-[#8B8B94] hover:text-[#EDEDEF] rounded hover:bg-[#1C1C20] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto flex-1 text-xs font-mono">
              <table className="w-full text-left" aria-label="Supporting Records Table">
                <thead className="bg-[#101012] text-[#8B8B94] border-b border-[#29292F] sticky top-0">
                  <tr>
                    <th scope="col" className="py-2 px-3 font-medium">Event ID</th>
                    <th scope="col" className="py-2 px-3 font-medium">Timestamp</th>
                    <th scope="col" className="py-2 px-3 font-medium">Model</th>
                    <th scope="col" className="py-2 px-3 font-medium">Task</th>
                    <th scope="col" className="py-2 px-3 text-right font-medium">In Tkn</th>
                    <th scope="col" className="py-2 px-3 text-right font-medium">Out Tkn</th>
                    <th scope="col" className="py-2 px-3 text-right font-medium">Cached</th>
                    <th scope="col" className="py-2 px-3 text-center font-medium">Status</th>
                    <th scope="col" className="py-2 px-3 text-right font-medium">Cost ($)</th>
                    <th scope="col" className="py-2 px-3 text-center font-medium">Retries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222226] text-[11px]">
                  {inspectedEvents.map((ev) => {
                    const cost = getEffectiveEventCost(ev);
                    return (
                      <tr key={ev.id} className="hover:bg-[#1C1C20] transition-colors">
                        <td className="py-2 px-3 font-medium text-[#EDEDEF]">{ev.id}</td>
                        <td className="py-2 px-3 text-[#8B8B94] whitespace-nowrap">
                          {new Date(ev.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3 text-[#EDEDEF]">{ev.model}</td>
                        <td className="py-2 px-3 text-[#8B8B94]">{ev.task}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#EDEDEF]">
                          {ev.inputTokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#EDEDEF]">
                          {ev.outputTokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-emerald-400">
                          {ev.cachedInputTokens ? ev.cachedInputTokens.toLocaleString() : '0'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              ev.status === 'success'
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-900/40'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#EDEDEF]">
                          ${cost.toFixed(4)}
                        </td>
                        <td className="py-2 px-3 text-center tabular-nums text-amber-400">
                          {ev.retryCount || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#29292F]">
              <button
                type="button"
                onClick={() => setInspectingFinding(null)}
                className="px-3.5 py-1.5 bg-[#1C1C20] hover:bg-[#222226] text-[#EDEDEF] rounded-md font-medium text-xs border border-[#29292F] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
