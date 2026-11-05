import React, { useState, useEffect, useMemo } from 'react';
import {
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Beaker,
  FileCode,
  Copy,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Info,
  Layers,
  Repeat,
  Cpu,
  Lock,
  ChevronRight,
  X,
} from 'lucide-react';
import { UsageEvent, OptimizationFinding } from '../../types';
import { AnalystTopic, AnalystResponse, CandidateEvidenceItem } from '../../services/analyst/types';
import { analystService } from '../../services/analyst/service';
import { formatCurrency } from '../../services/currency';
import { getEffectiveEventCost } from '../../services/analytics';

interface AnalystViewProps {
  events: UsageEvent[];
  currency: string;
  initialTopic?: AnalystTopic;
}

export const AnalystView: React.FC<AnalystViewProps> = ({
  events,
  currency,
  initialTopic = 'spending_change',
}) => {
  const [topic, setTopic] = useState<AnalystTopic>(initialTopic);
  const [focusQuestion, setFocusQuestion] = useState<string>('');
  const [preferOffline, setPreferOffline] = useState<boolean>(false);
  const [allowExternal, setAllowExternal] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<AnalystResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Evidence inspector modal
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);

  // Available providers state
  const [providers, setProviders] = useState<Array<{ id: string; name: string; available: boolean; reason?: string }>>([]);

  useEffect(() => {
    analystService.getAvailableProviders().then(setProviders);
  }, []);

  const handleRunAnalysis = async (overrideTopic?: AnalystTopic) => {
    const targetTopic = overrideTopic || topic;
    setLoading(true);
    setError(null);

    try {
      const res = await analystService.runAnalysis({
        events,
        topic: targetTopic,
        focusQuestion: focusQuestion.trim() || undefined,
        preferOffline,
        allowExternalProcessing: allowExternal,
      });
      setResponse(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to complete analysis.');
    } finally {
      setLoading(false);
    }
  };

  // Run on first mount or topic change if no response yet
  useEffect(() => {
    if (events.length > 0 && !response) {
      handleRunAnalysis();
    }
  }, [events]);

  const handleTopicChange = (newTopic: AnalystTopic) => {
    setTopic(newTopic);
    handleRunAnalysis(newTopic);
  };

  // Find inspected event details
  const inspectedEvent = useMemo(() => {
    if (!selectedEvidenceId) return null;
    return events.find((e) => e.id === selectedEvidenceId) || null;
  }, [selectedEvidenceId, events]);

  const handleCopyMarkdown = () => {
    if (!response) return;

    const md = `# TokenBudgeter AI Analyst Report: ${response.topic.replace('_', ' ').toUpperCase()}
Generated: ${new Date(response.generatedAt).toLocaleString()}
Provider: ${response.provider}
Confidence: ${response.confidence.toUpperCase()} (${response.confidenceReason})

## Executive Summary
${response.summary}

## Observed Facts (Verified Ground Truth)
${response.observedFacts.map((f) => `- ${f}`).join('\n')}

## Cited Telemetry Evidence IDs
${response.citedEvidenceIds.length > 0 ? response.citedEvidenceIds.map((id) => `- \`${id}\``).join('\n') : 'No specific evidence records cited.'}

## AI Hypotheses (Potential Architectural Causes)
${response.hypotheses.map((h) => `- ${h}`).join('\n')}

## Recommended Experiments
${response.recommendedExperiments
  .map(
    (exp) => `### ${exp.title} [Risk: ${exp.riskLevel.toUpperCase()}]
Hypothesis: ${exp.hypothesis}
Target Metric: ${exp.metricToWatch}
Checklist:
${exp.actionableChecklist.map((c) => `  - [ ] ${c}`).join('\n')}`
  )
  .join('\n\n')}

## Known Limitations & Missing Telemetry
${response.limitations.map((l) => `- ${l}`).join('\n')}
${response.missingData.map((m) => `- Missing Telemetry: ${m}`).join('\n')}

---
*TokenBudgeter Safe Decision Support: No automated operations, autonomous mutations, or key changes were executed.*
`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 1. View Header with Working Principle and Safe Non-Autonomous Guarantee */}
      <div className="bg-[#151518] border border-[#29292F] p-4 sm:p-5 rounded-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#1C1C20] border border-[#29292F] flex items-center justify-center text-[#7C6FF7] shrink-0">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2">
                <span>AI Telemetry Analyst</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1C1C20] text-[#7C6FF7] border border-[#29292F]">
                  Deterministic Decision Support
                </span>
              </h2>
              <p className="text-xs text-[#8B8B94]">
                Explains pre-calculated deterministic analytics without hallucinations or delegated arithmetic.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRunAnalysis()}
              disabled={loading || events.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors disabled:opacity-50 shadow-2xs focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Rerun Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* External Processing & Privacy Disclosure Banner */}
        <div className="p-3 bg-[#101012] rounded-md border border-[#29292F] text-xs text-[#8B8B94] space-y-1.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-medium text-[#EDEDEF] flex items-center gap-2">
                <span>Privacy & Anti-Hallucination Shield Active</span>
                <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-900/60">
                  Zero Prompt Leaks
                </span>
              </div>
              <p className="text-[#8B8B94] text-[11px]">
                TokenBudgeter transmits <strong className="text-[#EDEDEF] font-medium">only aggregated statistical totals</strong> and masked telemetry IDs.
                Raw prompt texts, source code, headers, and credentials are <strong className="text-[#EDEDEF] font-medium">never sent to AI models</strong>.
                All financial arithmetic is calculated deterministically before prompt construction, and every cited evidence ID is cross-checked against your local database.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Topic Selector Bar */}
      <div className="bg-[#151518] border border-[#29292F] p-4 rounded-lg space-y-3">
        <div className="text-[10px] font-mono font-medium text-[#8B8B94] uppercase tracking-wider">
          Select Analytical Focus Area
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              id: 'spending_change' as AnalystTopic,
              title: 'Spending Changes',
              desc: 'Explains period-over-period drift and primary model drivers.',
              icon: <Layers className="w-3.5 h-3.5 text-cyan-400" />,
            },
            {
              id: 'retry_rates' as AnalystTopic,
              title: 'Retry Loops & Errors',
              desc: 'Diagnoses failure cascades, wasted tokens, and idempotency.',
              icon: <Repeat className="w-3.5 h-3.5 text-amber-400" />,
            },
            {
              id: 'optimization_experiments' as AnalystTopic,
              title: 'Optimization Experiments',
              desc: 'Ranks verified findings by ROI and specifies safe A/B tests.',
              icon: <Beaker className="w-3.5 h-3.5 text-[#7C6FF7]" />,
            },
            {
              id: 'telemetry_audit' as AnalystTopic,
              title: 'Telemetry & Evidence Audit',
              desc: 'Identifies missing instrumentation gaps and sample limits.',
              icon: <FileCode className="w-3.5 h-3.5 text-emerald-400" />,
            },
          ].map((item) => {
            const isSelected = topic === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTopicChange(item.id)}
                className={`p-3 rounded-md text-left transition-all border flex flex-col justify-between gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7] ${
                  isSelected
                    ? 'bg-[#1C1C20] border-[#7C6FF7]/60 text-[#EDEDEF] shadow-2xs'
                    : 'bg-[#101012] hover:bg-[#1C1C20] border-[#29292F] text-[#8B8B94]'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-xs text-[#EDEDEF]">
                  {item.icon}
                  <span>{item.title}</span>
                </div>
                <div className="text-[11px] text-[#8B8B94] leading-snug">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Optional Custom Focus Query & Controls */}
        <div className="pt-2 border-t border-[#29292F] flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Optional focus question (e.g. 'Why did gpt-4o cost spike in task extraction?')"
              value={focusQuestion}
              onChange={(e) => setFocusQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunAnalysis();
              }}
              className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-xs text-[#EDEDEF] placeholder-[#5E5E68] focus:outline-none focus:border-[#7C6FF7] font-mono"
            />
          </div>

          {/* Engine Mode Toggle */}
          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#8B8B94] hover:text-[#EDEDEF] select-none">
              <input
                type="checkbox"
                checked={preferOffline}
                onChange={(e) => setPreferOffline(e.target.checked)}
                className="rounded bg-[#101012] border-[#29292F] text-[#7C6FF7] focus:ring-0"
              />
              <span>Force Offline Deterministic Mode</span>
            </label>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-rose-200">Analysis Request Notice</div>
            <div>{error}</div>
            <div className="text-rose-400/80 text-[11px]">
              Tip: You can switch to Offline Deterministic Mode to generate rule-based reports without external API access.
            </div>
          </div>
        </div>
      )}

      {/* 3. Structured Analysis Result Display */}
      {response && (
        <div className="bg-[#151518] border border-[#29292F] rounded-lg overflow-hidden shadow-xs space-y-0">
          {/* Top Metadata Banner */}
          <div className="p-4 border-b border-[#29292F] bg-[#151518] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border ${
                  response.confidence === 'high'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60'
                    : response.confidence === 'medium'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-900/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-900/60'
                }`}
              >
                {response.confidence} Confidence
              </span>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101012] border border-[#29292F] text-[#8B8B94]">
                Engine: {response.provider}
              </span>

              <span className="text-[10px] font-mono text-[#5E5E68]">
                Generated {new Date(response.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-[#101012] hover:bg-[#1C1C20] text-[#EDEDEF] rounded-md border border-[#29292F] transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#8B8B94]" />
                    <span>Copy Report</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Warnings / Anti-Hallucination Shield Badge */}
          {response.validation.rejectedFabricatedIds.length > 0 && (
            <div className="p-3 bg-amber-950/40 border-b border-amber-900/60 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Anti-Hallucination Guard Blocked Citations: </span>
                <span>
                  The model attempted to cite {response.validation.rejectedFabricatedIds.length} non-existent evidence ID(s) ({response.validation.rejectedFabricatedIds.join(', ')}).
                  These were stripped from verified citations.
                </span>
              </div>
            </div>
          )}

          {/* Executive Summary */}
          <div className="p-4 border-b border-[#29292F] bg-[#101012] space-y-1">
            <div className="text-[10px] font-mono uppercase font-medium text-[#8B8B94]">
              Executive Analytical Summary
            </div>
            <p className="text-xs sm:text-sm text-[#EDEDEF] font-sans leading-relaxed">
              {response.summary}
            </p>
          </div>

          {/* Multi-Zone Deep Dive */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs bg-[#101012]">
            {/* Zone A: Observed Facts (Ground Truth) (6 cols) */}
            <div className="lg:col-span-6 space-y-3">
              <div className="bg-[#151518] p-3.5 rounded-md border border-[#29292F] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Measured Facts (Ground Truth)</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#5E5E68]">
                    Deterministic
                  </span>
                </div>

                <ul className="space-y-1.5 text-[11px] text-[#EDEDEF]">
                  {response.observedFacts.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-mono mt-0.5">•</span>
                      <span className="leading-relaxed text-[#8B8B94]">{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Zone B: Cited Evidence Records */}
              <div className="bg-[#151518] p-3.5 rounded-md border border-[#29292F] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#7C6FF7] flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Verified Telemetry Citations ({response.citedEvidenceIds.length})</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    All IDs Verified
                  </span>
                </div>

                {response.citedEvidenceIds.length === 0 ? (
                  <div className="text-[11px] text-[#5E5E68] font-mono py-1">
                    No specific individual evidence records were cited for this high-level aggregate.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {response.citedEvidenceIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedEvidenceId(id)}
                        className="px-2 py-1 rounded bg-[#101012] hover:bg-[#1C1C20] text-[#7C6FF7] font-mono text-[10px] border border-[#29292F] transition-colors flex items-center gap-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
                      >
                        <span>{id}</span>
                        <ChevronRight className="w-2.5 h-2.5 text-[#5E5E68]" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-[#5E5E68] font-sans">
                  Click any evidence ID above to inspect its exact token count, cost, and timestamp in the telemetry drawer.
                </div>
              </div>

              {/* Zone C: Missing Telemetry & Limitations */}
              <div className="bg-[#151518] p-3.5 rounded-md border border-[#29292F] space-y-2">
                <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#8B8B94] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#5E5E68]" />
                  <span>Telemetry Limitations & Missing Data</span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  {response.missingData.map((m, idx) => (
                    <div key={idx} className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-300 leading-snug">
                      <span className="font-mono font-semibold text-amber-400 mr-1.5">[Data Gap]:</span>
                      <span>{m}</span>
                    </div>
                  ))}
                  {response.limitations.map((lim, idx) => (
                    <div key={idx} className="text-[#8B8B94] flex items-start gap-1.5">
                      <span className="text-[#5E5E68] font-mono">•</span>
                      <span>{lim}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Zone D: Hypotheses & Recommended Experiments (6 cols) */}
            <div className="lg:col-span-6 space-y-3">
              {/* AI Hypotheses */}
              <div className="bg-[#151518] p-3.5 rounded-md border border-[#29292F] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>AI Inferred Hypotheses (Potential Causes)</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-1.5 py-0.2 rounded border border-purple-900/60">
                    Inference
                  </span>
                </div>

                <ul className="space-y-1.5 text-[11px] text-[#EDEDEF]">
                  {response.hypotheses.map((hypo, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-purple-400 font-mono mt-0.5">?</span>
                      <span className="leading-relaxed text-[#8B8B94]">{hypo}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Experiments */}
              <div className="bg-[#151518] p-3.5 rounded-md border border-[#29292F] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#7C6FF7] flex items-center gap-1.5">
                    <Beaker className="w-3.5 h-3.5" />
                    <span>Recommended Experiments (Untested A/B Trials)</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#5E5E68]">
                    Actionable
                  </span>
                </div>

                <div className="space-y-2.5">
                  {response.recommendedExperiments.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[#101012] rounded-md border border-[#29292F] space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#EDEDEF] text-xs">{exp.title}</span>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border ${
                            exp.riskLevel === 'high'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-900/60'
                              : exp.riskLevel === 'medium'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-900/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60'
                          }`}
                        >
                          {exp.riskLevel} Risk
                        </span>
                      </div>

                      <p className="text-[11px] text-[#8B8B94] leading-snug font-sans">
                        {exp.hypothesis}
                      </p>

                      <div className="text-[10px] font-mono text-[#7C6FF7]">
                        <span className="text-[#5E5E68]">Target Metric: </span>
                        <span>{exp.metricToWatch}</span>
                      </div>

                      <div className="space-y-1 pt-1 border-t border-[#222226]">
                        <div className="text-[10px] font-mono text-[#5E5E68] uppercase">Verification Checklist:</div>
                        <ul className="space-y-0.5 text-[11px] text-[#8B8B94]">
                          {exp.actionableChecklist.map((item, cIdx) => (
                            <li key={cIdx} className="flex items-start gap-1.5">
                              <span className="text-[#7C6FF7] font-mono">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Safety Notice Strip */}
          <div className="p-3 bg-[#151518] border-t border-[#29292F] flex items-center justify-between text-[11px] font-mono text-[#8B8B94]">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#5E5E68]" />
              <span>Strict Non-Autonomous Guarantee: No automated configuration changes or scripts executed.</span>
            </div>
            <div className="text-[#5E5E68] hidden sm:inline">
              Confidence Basis: {response.confidenceReason}
            </div>
          </div>
        </div>
      )}

      {/* 4. Evidence Inspector Modal */}
      {selectedEvidenceId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <div className="bg-[#151518] border border-[#29292F] rounded-lg max-w-xl w-full p-4 sm:p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#29292F] pb-3">
              <div>
                <h3 className="text-xs font-semibold text-[#EDEDEF] flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#7C6FF7]" />
                  <span>Inspecting Telemetry Citation</span>
                </h3>
                <p className="text-[11px] text-[#8B8B94] font-mono mt-0.5">
                  ID: {selectedEvidenceId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvidenceId(null)}
                className="p-1 text-[#8B8B94] hover:text-[#EDEDEF] rounded hover:bg-[#1C1C20] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {inspectedEvent ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#101012] p-2.5 rounded border border-[#29292F]">
                    <span className="text-[#5E5E68]">Model:</span>
                    <div className="text-[#EDEDEF] font-medium">{inspectedEvent.model}</div>
                  </div>
                  <div className="bg-[#101012] p-2.5 rounded border border-[#29292F]">
                    <span className="text-[#5E5E68]">Task:</span>
                    <div className="text-[#EDEDEF] font-medium">{inspectedEvent.task}</div>
                  </div>
                  <div className="bg-[#101012] p-2.5 rounded border border-[#29292F]">
                    <span className="text-[#5E5E68]">Timestamp:</span>
                    <div className="text-[#EDEDEF]">{new Date(inspectedEvent.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="bg-[#101012] p-2.5 rounded border border-[#29292F]">
                    <span className="text-[#5E5E68]">Calculated Cost:</span>
                    <div className="text-emerald-400 font-bold tabular-nums">
                      {formatCurrency(getEffectiveEventCost(inspectedEvent), currency)}
                    </div>
                  </div>
                  <div className="bg-[#101012] p-2.5 rounded border border-[#29292F]">
                    <span className="text-[#5E5E68]">Input / Output Tokens:</span>
                    <div className="text-[#EDEDEF] tabular-nums">
                      {inspectedEvent.inputTokens.toLocaleString()} in / {inspectedEvent.outputTokens.toLocaleString()} out
                    </div>
                  </div>
                  <div className="bg-[#101012] p-2.5 rounded border border-[#29292F]">
                    <span className="text-[#5E5E68]">Status & Retries:</span>
                    <div className="text-[#EDEDEF]">
                      {inspectedEvent.status} (Retries: {inspectedEvent.retryCount || 0})
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#101012] rounded border border-[#29292F] text-[11px] text-[#8B8B94] space-y-1">
                  <div className="font-medium text-[#EDEDEF]">Sanitization Verification:</div>
                  <p>
                    Verified that zero prompt bodies, user contents, or private keys were exposed to the model during citation generation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-[#101012] rounded border border-[#29292F] text-xs text-amber-300">
                This event record ID is not present in the currently loaded in-memory event filter.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[#29292F]">
              <button
                type="button"
                onClick={() => setSelectedEvidenceId(null)}
                className="px-3.5 py-1.5 bg-[#1C1C20] hover:bg-[#222226] text-[#EDEDEF] rounded text-xs font-medium border border-[#29292F]"
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
