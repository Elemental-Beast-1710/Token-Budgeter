import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Sliders,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  Plus,
  Scale,
  Sparkles,
  Info,
  X,
  RotateCcw,
  Download,
  Edit2,
  Trash2,
  Archive,
  ArrowRight,
  ShieldAlert,
  Layers,
  Activity,
  Check,
} from 'lucide-react';
import {
  Experiment,
  ExperimentRun,
  ExperimentStatus,
  PricingRate,
  SimulationParams,
  UsageEvent,
} from '../../types';
import { computeExperimentEvaluation, runSimulation } from '../../services/analytics';
import { DEFAULT_PRICING_CATALOG } from '../../services/pricing';
import { formatCurrency } from '../../services/currency';
import { downloadFile } from '../../services/export';

interface SimulatorViewProps {
  events: UsageEvent[];
  currency: string;
  experiments: Experiment[];
  onSaveExperiment: (exp: Experiment) => void;
  onDeleteExperiment?: (id: string) => void;
}

const SCENARIO_PRESETS: Array<{
  id: string;
  name: string;
  description: string;
  params: SimulationParams;
}> = [
  {
    id: 'balanced',
    name: 'Balanced Optimization',
    description: 'Conservative 20% prompt compression, 50% retry elimination, and 60% prompt cache adoption.',
    params: {
      inputReductionPercent: 20,
      retryReductionPercent: 50,
      cachingAdoptionPercent: 60,
      modelShiftTarget: 'gpt-4o-mini',
      modelShiftPercent: 0,
      volumeScalingPercent: 0,
    },
  },
  {
    id: 'caching_focus',
    name: 'Aggressive Prompt Caching',
    description: 'Targets 90% prompt caching on static prefix contexts with minimal token changes.',
    params: {
      inputReductionPercent: 10,
      retryReductionPercent: 30,
      cachingAdoptionPercent: 90,
      modelShiftTarget: 'gpt-4o-mini',
      modelShiftPercent: 0,
      volumeScalingPercent: 0,
    },
  },
  {
    id: 'model_downshift',
    name: 'Model Downshifting Trial',
    description: 'Shifts 60% of routine non-complex requests to high-throughput mini models.',
    params: {
      inputReductionPercent: 0,
      retryReductionPercent: 20,
      cachingAdoptionPercent: 40,
      modelShiftTarget: 'gpt-4o-mini',
      modelShiftPercent: 60,
      volumeScalingPercent: 0,
    },
  },
  {
    id: 'reliability_clean',
    name: 'Reliability & Clean Retries',
    description: 'Eliminates 80% of runaway retry loops with exponential backoff and circuit breaking.',
    params: {
      inputReductionPercent: 0,
      retryReductionPercent: 80,
      cachingAdoptionPercent: 0,
      modelShiftTarget: 'gpt-4o-mini',
      modelShiftPercent: 0,
      volumeScalingPercent: 0,
    },
  },
  {
    id: 'growth_scaling',
    name: 'Workload Growth (+50% volume)',
    description: 'Models a 50% increase in request volume with balanced caching and retry reduction.',
    params: {
      inputReductionPercent: 20,
      retryReductionPercent: 50,
      cachingAdoptionPercent: 60,
      modelShiftTarget: 'gpt-4o-mini',
      modelShiftPercent: 25,
      volumeScalingPercent: 50,
    },
  },
];

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  events,
  currency,
  experiments,
  onSaveExperiment,
  onDeleteExperiment,
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'experiments'>('simulator');

  // Simulation Parameters state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('balanced');
  const [params, setParams] = useState<SimulationParams>(SCENARIO_PRESETS[0].params);

  const simulationResult = useMemo(
    () => runSimulation(events, params, DEFAULT_PRICING_CATALOG),
    [events, params]
  );

  // Experiment filters
  const [experimentStatusFilter, setExperimentStatusFilter] = useState<string>('all');

  // Experiment Modal state (create or edit)
  const [isEditingExp, setIsEditingExp] = useState(false);
  const [editingExp, setEditingExp] = useState<Partial<Experiment> | null>(null);

  // Experiment Deletion state
  const [expToDelete, setExpToDelete] = useState<Experiment | null>(null);

  // Close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingExp) setIsEditingExp(false);
        if (expToDelete) setExpToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingExp, expToDelete]);

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setParams({ ...preset.params });
    }
  };

  const handleCustomParamChange = (newParams: Partial<SimulationParams>) => {
    setSelectedPresetId('custom');
    setParams((prev) => ({ ...prev, ...newParams }));
  };

  const handleExportScenario = () => {
    const exportPayload = {
      app: 'TokenBudgeter',
      type: 'scenario_projection',
      generatedAt: new Date().toISOString(),
      measuredBaselineEventsCount: simulationResult.baselineEventsCount,
      unratedEventsCount: simulationResult.unratedEventsCount,
      parameters: params,
      results: {
        baselineCostUsd: simulationResult.baselineCostUsd,
        simulatedCostUsd: simulationResult.simulatedCostUsd,
        absoluteSavingsUsd: simulationResult.absoluteSavingsUsd,
        percentageSavings: simulationResult.percentageSavings,
        volumeScalingCostDeltaUsd: simulationResult.volumeScalingCostDeltaUsd,
      },
      assumptions: simulationResult.assumptions,
      limitations: simulationResult.limitations,
      potentialTradeOffs: simulationResult.tradeOffs,
      corePrinciple:
        'Simulated savings are not actual savings. A cheaper result is not automatically a better result.',
    };
    downloadFile(
      JSON.stringify(exportPayload, null, 2),
      `tokenbudgeter-scenario-${Date.now()}.json`,
      'application/json'
    );
  };

  const handleExportExperiment = (
    exp: Experiment,
    evaluation: ReturnType<typeof computeExperimentEvaluation>
  ) => {
    const payload = {
      app: 'TokenBudgeter',
      type: 'experiment_evaluation',
      experiment: exp,
      evaluation,
      exportedAt: new Date().toISOString(),
      principle:
        'A cheaper result is not automatically a better result. Token reduction alone does not imply quality improvement.',
    };
    downloadFile(
      JSON.stringify(payload, null, 2),
      `experiment-${exp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.json`,
      'application/json'
    );
  };

  const handleStatusChange = (exp: Experiment, newStatus: ExperimentStatus) => {
    onSaveExperiment({
      ...exp,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const openCreateExperiment = () => {
    setEditingExp({
      id: `exp_${Date.now()}`,
      name: '',
      objective: 'Evaluate if model downshifting preserves reasoning accuracy on code tasks.',
      project: 'Engineering',
      task: 'code_generation',
      taskCategory: 'code_generation',
      status: 'collecting_data',
      baselineModel: 'gpt-4o',
      experimentalModel: 'gpt-4o-mini',
      baselineConfig: 'Zero-shot prompt with system instructions',
      experimentalConfig: 'Structured prompt with few-shot reasoning examples',
      sampleSizeTarget: 20,
      inclusionCriteria: 'Python and TypeScript refactoring requests under 2,000 input tokens.',
      evaluationMethod: 'human_eval',
      baselineRuns: [
        { tokensIn: 1200, tokensOut: 350, costUsd: 0.05, latencyMs: 1400, success: true, qualityScore: 92 },
        { tokensIn: 1250, tokensOut: 360, costUsd: 0.052, latencyMs: 1350, success: true, qualityScore: 88 },
        { tokensIn: 1180, tokensOut: 340, costUsd: 0.049, latencyMs: 1420, success: true, qualityScore: 90 },
      ],
      experimentalRuns: [
        { tokensIn: 900, tokensOut: 320, costUsd: 0.008, latencyMs: 700, success: true, qualityScore: 87 },
        { tokensIn: 880, tokensOut: 310, costUsd: 0.0075, latencyMs: 680, success: true, qualityScore: 89 },
        { tokensIn: 920, tokensOut: 330, costUsd: 0.0082, latencyMs: 710, success: true, qualityScore: 86 },
      ],
      notes: 'Initial test trial comparing gpt-4o against gpt-4o-mini with few-shot guidance.',
      createdAt: new Date().toISOString(),
    });
    setIsEditingExp(true);
  };

  const openEditExperiment = (exp: Experiment) => {
    setEditingExp({ ...exp });
    setIsEditingExp(true);
  };

  const filteredExperiments = useMemo(() => {
    return experiments.filter((exp) => {
      if (experimentStatusFilter === 'all') return true;
      const status = exp.status || 'completed';
      return status === experimentStatusFilter;
    });
  }, [experiments, experimentStatusFilter]);

  return (
    <div className="space-y-4">
      {/* Principle Banner */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#7C6FF7] shrink-0" />
          <span className="text-[#8B8B94]">
            Core Engineering Principle:{' '}
            <span className="text-[#EDEDEF] font-medium">
              Simulated savings are not actual savings. A cheaper result is not automatically a better result.
            </span>
          </span>
        </div>
        <div className="text-[11px] font-mono text-[#8B8B94] flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded bg-[#101012] border border-[#29292F]">
            Measured baseline vs. Calculated projection
          </span>
        </div>
      </div>

      {/* Top Switcher: Simulator vs Experiments */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#151518] border border-[#29292F] p-1.5 rounded-lg gap-2">
        <div role="tablist" aria-label="Simulation and Experiment Views" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'simulator'}
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7] ${
              activeTab === 'simulator'
                ? 'bg-[#1C1C20] text-[#EDEDEF] shadow-2xs border border-[#29292F]'
                : 'text-[#8B8B94] hover:text-[#EDEDEF]'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Savings Simulator</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'experiments'}
            onClick={() => setActiveTab('experiments')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7] ${
              activeTab === 'experiments'
                ? 'bg-[#1C1C20] text-[#EDEDEF] shadow-2xs border border-[#29292F]'
                : 'text-[#8B8B94] hover:text-[#EDEDEF]'
            }`}
          >
            <Beaker className="w-3.5 h-3.5" />
            <span>Cost & Quality Experiments ({experiments.length})</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-[#5E5E68] pr-2 hidden sm:block">
          Deterministic Mathematical Modeling
        </div>
      </div>

      {activeTab === 'simulator' ? (
        /* SAVINGS SIMULATOR TAB */
        events.length === 0 ? (
          <div className="bg-[#151518] border border-[#29292F] rounded-lg p-10 text-center space-y-2">
            <Calculator className="w-8 h-8 text-[#5E5E68] mx-auto stroke-[1.5]" />
            <h3 className="text-xs font-semibold text-[#EDEDEF]">No Baseline Events Found to Simulate</h3>
            <p className="text-xs text-[#8B8B94] max-w-sm mx-auto">
              The savings simulator calculates projections against your recorded usage events. Select a date range with events or import logs to simulate optimization scenarios.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Scenario Presets Selector */}
            <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-[#8B8B94] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#7C6FF7]" />
                  <span>Optimization Scenario Presets</span>
                </span>
                <span className="text-[11px] font-mono text-[#5E5E68]">
                  {selectedPresetId === 'custom' ? 'Custom Scenario (Modified)' : 'Pre-configured Profile'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {SCENARIO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`p-2.5 rounded-md border text-left transition-all ${
                      selectedPresetId === preset.id
                        ? 'bg-[#1C1C20] border-[#7C6FF7]/60 text-[#EDEDEF] shadow-2xs'
                        : 'bg-[#101012] border-[#29292F] text-[#8B8B94] hover:border-[#383842] hover:text-[#EDEDEF]'
                    }`}
                  >
                    <div className="font-medium text-xs text-[#EDEDEF]">{preset.name}</div>
                    <div className="text-[10px] text-[#8B8B94] line-clamp-2 mt-0.5 font-sans">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Controls Panel */}
              <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-[#EDEDEF] flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#7C6FF7]" />
                      <span>Hypothetical Levers</span>
                    </h3>
                    <p className="text-[11px] text-[#8B8B94] mt-0.5">
                      Adjust assumptions to project cost delta.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono bg-[#101012] text-[#8B8B94] border border-[#29292F] px-1.5 py-0.5 rounded">
                    Assumption
                  </span>
                </div>

                <div className="space-y-3.5 text-xs font-mono">
                  {/* Lever 1: Input Token Reduction */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[#8B8B94]">
                      <span>Input Token Compression:</span>
                      <span className="font-bold text-[#7C6FF7] tabular-nums">{params.inputReductionPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="70"
                      step="5"
                      value={params.inputReductionPercent}
                      onChange={(e) =>
                        handleCustomParamChange({ inputReductionPercent: Number(e.target.value) })
                      }
                      className="w-full accent-[#7C6FF7] cursor-pointer"
                    />
                    <span className="text-[10px] text-[#5E5E68] block font-sans">
                      AST trimming, schema minimization, or prompt compression.
                    </span>
                  </div>

                  {/* Lever 2: Retry Reduction */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[#8B8B94]">
                      <span>Unnecessary Retry Cut:</span>
                      <span className="font-bold text-[#7C6FF7] tabular-nums">{params.retryReductionPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="10"
                      value={params.retryReductionPercent}
                      onChange={(e) =>
                        handleCustomParamChange({ retryReductionPercent: Number(e.target.value) })
                      }
                      className="w-full accent-[#7C6FF7] cursor-pointer"
                    />
                    <span className="text-[10px] text-[#5E5E68] block font-sans">
                      Rate limit backoff, circuit breakers, and idempotency keys.
                    </span>
                  </div>

                  {/* Lever 3: Prompt Caching Adoption */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[#8B8B94]">
                      <span>Prompt Caching Adoption:</span>
                      <span className="font-bold text-[#7C6FF7] tabular-nums">{params.cachingAdoptionPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={params.cachingAdoptionPercent}
                      onChange={(e) =>
                        handleCustomParamChange({ cachingAdoptionPercent: Number(e.target.value) })
                      }
                      className="w-full accent-[#7C6FF7] cursor-pointer"
                    />
                    <span className="text-[10px] text-[#5E5E68] block font-sans">
                      Applied to static prefixes and repository indexes &gt; 2,000 tokens.
                    </span>
                  </div>

                  {/* Lever 4: Model Down-shifting */}
                  <div className="space-y-1 pt-2 border-t border-[#29292F]">
                    <div className="flex justify-between text-[#8B8B94] items-center">
                      <span>Model Shift Target:</span>
                      <select
                        value={params.modelShiftTarget}
                        onChange={(e) =>
                          handleCustomParamChange({ modelShiftTarget: e.target.value })
                        }
                        className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded px-2 py-0.5 text-xs font-mono"
                      >
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="claude-3-5-haiku">claude-3-5-haiku</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="deepseek-coder">deepseek-coder</option>
                      </select>
                    </div>

                    <div className="flex justify-between text-[#8B8B94] pt-1">
                      <span>Task Volume Shifted:</span>
                      <span className="font-bold text-[#7C6FF7] tabular-nums">{params.modelShiftPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={params.modelShiftPercent}
                      onChange={(e) =>
                        handleCustomParamChange({ modelShiftPercent: Number(e.target.value) })
                      }
                      className="w-full accent-[#7C6FF7] cursor-pointer"
                    />
                    <span className="text-[10px] text-[#5E5E68] block font-sans">
                      Shift proportion of non-critical tasks to smaller, high-throughput models.
                    </span>
                  </div>

                  {/* Lever 5: Volume Scaling */}
                  <div className="space-y-1 pt-2 border-t border-[#29292F]">
                    <div className="flex justify-between text-[#8B8B94]">
                      <span>Workload Volume Scaling:</span>
                      <span className="font-bold text-[#7C6FF7] tabular-nums">
                        {params.volumeScalingPercent ? (params.volumeScalingPercent > 0 ? `+${params.volumeScalingPercent}` : params.volumeScalingPercent) : 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="100"
                      step="10"
                      value={params.volumeScalingPercent || 0}
                      onChange={(e) =>
                        handleCustomParamChange({ volumeScalingPercent: Number(e.target.value) })
                      }
                      className="w-full accent-[#7C6FF7] cursor-pointer"
                    />
                    <span className="text-[10px] text-[#5E5E68] block font-sans">
                      Simulate workload traffic contraction or growth against historical baseline.
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('balanced')}
                    className="flex-1 py-1.5 text-xs text-[#8B8B94] hover:text-[#EDEDEF] bg-[#101012] border border-[#29292F] rounded-md transition-colors"
                  >
                    Reset Preset
                  </button>
                  <button
                    type="button"
                    onClick={handleExportScenario}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-[#7C6FF7] hover:text-white bg-[#101012] hover:bg-[#1C1C20] border border-[#29292F] rounded-md transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              {/* Results & Projections Display */}
              <div className="lg:col-span-2 space-y-4">
                {/* KPI Delta Banner */}
                <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[#8B8B94] uppercase tracking-wider font-mono">
                      Projected Financial Impact
                    </span>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-900/50 px-1.5 py-0.5 rounded">
                      Calculated projection
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-[#101012] p-3 rounded-md border border-[#29292F] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#8B8B94] font-mono block">Baseline Spend</span>
                        <span className="text-[9px] font-mono bg-[#1C1C20] text-[#8B8B94] px-1 py-0.2 rounded">
                          Measured
                        </span>
                      </div>
                      <span className="text-xl font-bold font-mono text-[#EDEDEF] tabular-nums block">
                        {formatCurrency(simulationResult.baselineCostUsd, currency)}
                      </span>
                      <span className="text-[10px] text-[#5E5E68] block font-mono">
                        {simulationResult.baselineEventsCount.toLocaleString()} events evaluated
                      </span>
                    </div>

                    <div className="bg-[#101012] p-3 rounded-md border border-[#29292F] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#8B8B94] font-mono block">Projected Spend</span>
                        <span className="text-[9px] font-mono bg-amber-950/60 text-amber-300 border border-amber-900/60 px-1 py-0.2 rounded">
                          Projected
                        </span>
                      </div>
                      <span className="text-xl font-bold font-mono text-[#7C6FF7] tabular-nums block">
                        {formatCurrency(simulationResult.simulatedCostUsd, currency)}
                      </span>
                      <span className="text-[10px] text-[#5E5E68] block font-mono">
                        Hypothetical target
                      </span>
                    </div>

                    <div className="bg-[#101012] p-3 rounded-md border border-[#29292F] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-emerald-400 font-mono block">Simulated Delta</span>
                        <span className="text-[9px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-900/60 px-1 py-0.2 rounded">
                          Savings
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                          {formatCurrency(simulationResult.absoluteSavingsUsd, currency)}
                        </span>
                        <span className="text-xs text-emerald-300 font-mono tabular-nums">
                          (-{simulationResult.percentageSavings}%)
                        </span>
                      </div>
                      <span className="text-[10px] text-[#5E5E68] block font-mono">
                        Annual delta: ~{formatCurrency(simulationResult.absoluteSavingsUsd * 12, currency)}
                      </span>
                    </div>
                  </div>

                  {/* Unrated Events Disclosure */}
                  {simulationResult.unratedEventsCount > 0 && (
                    <div className="p-2.5 rounded bg-amber-950/30 border border-amber-900/50 flex items-center gap-2 text-xs text-amber-300 font-sans">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Notice: <strong>{simulationResult.unratedEventsCount} events</strong> lacked verified rate cards (costBasis: unknown) and were excluded from savings calculations.
                      </span>
                    </div>
                  )}

                  {/* Lever Breakdown Strip */}
                  <div className="pt-2 border-t border-[#29292F]">
                    <h4 className="text-[10px] font-medium text-[#8B8B94] mb-2 font-mono uppercase">
                      Savings Contribution by Lever
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-md bg-[#101012] border border-[#29292F]">
                        <span className="text-[10px] text-[#5E5E68] block">Input Compression</span>
                        <span className="text-[#EDEDEF] font-bold tabular-nums">
                          {simulationResult.inputTokenSavings.toLocaleString()} tkn
                        </span>
                      </div>
                      <div className="p-2.5 rounded-md bg-[#101012] border border-[#29292F]">
                        <span className="text-[10px] text-[#5E5E68] block">Retry Elimination</span>
                        <span className="text-[#EDEDEF] font-bold tabular-nums">
                          ${simulationResult.retryCostSavings.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-md bg-[#101012] border border-[#29292F]">
                        <span className="text-[10px] text-[#5E5E68] block">Prompt Caching</span>
                        <span className="text-[#EDEDEF] font-bold tabular-nums">
                          ${simulationResult.cachingCostSavings.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-md bg-[#101012] border border-[#29292F]">
                        <span className="text-[10px] text-[#5E5E68] block">Model Shift</span>
                        <span className="text-[#EDEDEF] font-bold tabular-nums">
                          ${simulationResult.modelShiftSavings.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transparent Assumptions, Important Limitations, and Potential Trade-Offs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-sans">
                  <div className="bg-[#151518] border border-[#29292F] rounded-lg p-3 space-y-1.5">
                    <h4 className="font-medium text-[#EDEDEF] flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Assumptions</span>
                    </h4>
                    <ul className="space-y-1 text-[#8B8B94] text-[11px] list-disc list-inside">
                      {simulationResult.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#151518] border border-[#29292F] rounded-lg p-3 space-y-1.5">
                    <h4 className="font-medium text-amber-300 flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Limitations</span>
                    </h4>
                    <ul className="space-y-1 text-[#8B8B94] text-[11px] list-disc list-inside">
                      {simulationResult.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#151518] border border-[#29292F] rounded-lg p-3 space-y-1.5">
                    <h4 className="font-medium text-[#7C6FF7] flex items-center gap-1.5 text-xs">
                      <Scale className="w-3.5 h-3.5 text-[#7C6FF7]" />
                      <span>Trade-Offs</span>
                    </h4>
                    <ul className="space-y-1 text-[#8B8B94] text-[11px] list-disc list-inside">
                      {simulationResult.tradeOffs.map((to, i) => (
                        <li key={i}>{to}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* EXPERIMENTS LAB TAB */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#151518] border border-[#29292F] p-4 rounded-lg">
            <div>
              <h3 className="text-xs font-semibold text-[#EDEDEF] flex items-center gap-2">
                <Beaker className="w-4 h-4 text-[#7C6FF7]" />
                <span>Empirical A/B Cost & Quality Experiments</span>
              </h3>
              <p className="text-xs text-[#8B8B94] mt-0.5">
                Evaluate whether workflow optimizations genuinely improve cost, latency, reliability, or quality.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <select
                value={experimentStatusFilter}
                onChange={(e) => setExperimentStatusFilter(e.target.value)}
                className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#7C6FF7] font-mono"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="collecting_data">Collecting Data</option>
                <option value="ready_for_review">Ready for Review</option>
                <option value="completed">Completed</option>
                <option value="inconclusive">Inconclusive</option>
                <option value="archived">Archived</option>
              </select>

              <button
                type="button"
                onClick={openCreateExperiment}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors whitespace-nowrap shrink-0 shadow-2xs focus:outline-none focus-visible:ring-1 focus-visible:ring-[#7C6FF7]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Experiment</span>
              </button>
            </div>
          </div>

          {filteredExperiments.length === 0 ? (
            <div className="bg-[#151518] border border-[#29292F] rounded-lg p-10 text-center space-y-2">
              <Beaker className="w-8 h-8 text-[#5E5E68] mx-auto stroke-[1.5]" />
              <h3 className="text-xs font-semibold text-[#EDEDEF]">No Experiments Found</h3>
              <p className="text-xs text-[#8B8B94] max-w-sm mx-auto">
                {experimentStatusFilter !== 'all'
                  ? `No experiments matched the status filter "${experimentStatusFilter}".`
                  : 'Record structured A/B comparisons between models and prompting strategies to validate cost savings alongside quality outcomes.'}
              </p>
              <button
                type="button"
                onClick={openCreateExperiment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6B5EE4] rounded-md transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record First Experiment</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExperiments.map((exp) => {
                const evalData = computeExperimentEvaluation(exp);
                const status = exp.status || 'completed';

                return (
                  <div
                    key={exp.id}
                    className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-3.5 shadow-xs"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#29292F] pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-semibold text-[#EDEDEF] tracking-tight">{exp.name}</h4>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase font-medium ${
                              status === 'completed'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-900/60'
                                : status === 'ready_for_review'
                                ? 'bg-[#1C1C20] text-[#7C6FF7] border-[#7C6FF7]/40'
                                : status === 'collecting_data'
                                ? 'bg-blue-950/60 text-blue-300 border-blue-900/60'
                                : status === 'inconclusive'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-900/60'
                                : status === 'archived'
                                ? 'bg-[#1C1C20] text-[#5E5E68] border-[#29292F]'
                                : 'bg-[#101012] text-[#8B8B94] border-[#29292F]'
                            }`}
                          >
                            {status.replace(/_/g, ' ')}
                          </span>
                          {exp.evaluationMethod && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101012] border border-[#29292F] text-[#8B8B94]">
                              {exp.evaluationMethod.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#8B8B94] font-mono">
                          {exp.project && <span>Project: <strong className="text-[#EDEDEF]">{exp.project}</strong> · </span>}
                          Baseline: <span className="text-[#7C6FF7]">{exp.baselineModel}</span> vs Experimental: <span className="text-emerald-400">{exp.experimentalModel}</span>
                          {exp.objective && (
                            <div className="text-[#8B8B94] text-xs font-sans mt-0.5">
                              Objective: {exp.objective}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={status}
                          onChange={(e) => handleStatusChange(exp, e.target.value as ExperimentStatus)}
                          className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] text-xs rounded px-2 py-1 font-mono focus:outline-none focus:border-[#7C6FF7]"
                        >
                          <option value="draft">Draft</option>
                          <option value="collecting_data">Collecting Data</option>
                          <option value="ready_for_review">Ready for Review</option>
                          <option value="completed">Completed</option>
                          <option value="inconclusive">Inconclusive</option>
                          <option value="archived">Archived</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleExportExperiment(exp, evalData)}
                          title="Export Experiment Evaluation JSON"
                          className="p-1.5 rounded bg-[#101012] border border-[#29292F] text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#1C1C20] transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditExperiment(exp)}
                          title="Edit Experiment Configuration"
                          className="p-1.5 rounded bg-[#101012] border border-[#29292F] text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#1C1C20] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {onDeleteExperiment && (
                          <button
                            type="button"
                            onClick={() => setExpToDelete(exp)}
                            title="Delete Experiment"
                            className="p-1.5 rounded bg-[#101012] border border-[#29292F] text-rose-400 hover:bg-rose-950/60 hover:border-rose-900/60 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scientific Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-mono">
                      {/* Metric 1: Avg Request Cost */}
                      <div className="bg-[#101012] p-2.5 rounded-md border border-[#29292F] space-y-0.5">
                        <span className="text-[10px] text-[#5E5E68] uppercase block">Avg Request Cost</span>
                        <div className="flex items-baseline justify-between text-[#EDEDEF]">
                          <span>Base: ${evalData.baselineAvgCostUsd.toFixed(4)}</span>
                          <span className="text-emerald-400 font-bold tabular-nums">Exp: ${evalData.experimentalAvgCostUsd.toFixed(4)}</span>
                        </div>
                        <div className={`text-[10px] font-semibold pt-0.5 ${evalData.costSavingsPercent >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          Delta: {evalData.costSavingsPercent >= 0 ? `-${evalData.costSavingsPercent}%` : `+${Math.abs(evalData.costSavingsPercent)}%`}
                        </div>
                      </div>

                      {/* Metric 2: Cost Per Successful Request */}
                      <div className="bg-[#101012] p-2.5 rounded-md border border-[#29292F] space-y-0.5">
                        <span className="text-[10px] text-[#5E5E68] uppercase block">Cost / Success</span>
                        <div className="flex items-baseline justify-between text-[#EDEDEF]">
                          <span>
                            {evalData.baselineCostPerSuccessUsd !== null
                              ? `$${evalData.baselineCostPerSuccessUsd.toFixed(4)}`
                              : 'No Successes'}
                          </span>
                          <span className="text-emerald-400 font-bold tabular-nums">
                            {evalData.experimentalCostPerSuccessUsd !== null
                              ? `$${evalData.experimentalCostPerSuccessUsd.toFixed(4)}`
                              : 'No Successes'}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8B8B94] pt-0.5">
                          {evalData.costPerSuccessDeltaPercent !== null
                            ? `Delta: ${evalData.costPerSuccessDeltaPercent >= 0 ? `-${evalData.costPerSuccessDeltaPercent}%` : `+${Math.abs(evalData.costPerSuccessDeltaPercent)}%`}`
                            : 'Requires successful runs'}
                        </div>
                      </div>

                      {/* Metric 3: Success Rate & Reliability */}
                      <div className="bg-[#101012] p-2.5 rounded-md border border-[#29292F] space-y-0.5">
                        <span className="text-[10px] text-[#5E5E68] uppercase block">Success Rate</span>
                        <div className="flex items-baseline justify-between text-[#EDEDEF]">
                          <span>Base: {evalData.baselineSuccessRatePercent}%</span>
                          <span className="text-[#EDEDEF] font-bold tabular-nums">Exp: {evalData.experimentalSuccessRatePercent}%</span>
                        </div>
                        <div className={`text-[10px] font-semibold pt-0.5 ${evalData.successRateDeltaPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Reliability: {evalData.successRateDeltaPercent >= 0 ? `+${evalData.successRateDeltaPercent}%` : `${evalData.successRateDeltaPercent}%`}
                        </div>
                      </div>

                      {/* Metric 4: Quality Score */}
                      <div className="bg-[#101012] p-2.5 rounded-md border border-[#29292F] space-y-0.5">
                        <span className="text-[10px] text-[#5E5E68] uppercase block">Quality Score</span>
                        <div className="flex items-baseline justify-between text-[#EDEDEF]">
                          <span>{evalData.baselineAvgQuality !== null ? `${evalData.baselineAvgQuality}/100` : 'Unrated'}</span>
                          <span className="text-[#EDEDEF] font-bold tabular-nums">
                            {evalData.experimentalAvgQuality !== null ? `${evalData.experimentalAvgQuality}/100` : 'Unrated'}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] font-semibold pt-0.5 ${
                            evalData.qualityDelta === null
                              ? 'text-[#5E5E68]'
                              : evalData.qualityDelta >= 0
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {evalData.qualityDelta !== null
                            ? `Impact: ${evalData.qualityDelta >= 0 ? `+${evalData.qualityDelta}` : evalData.qualityDelta} pts`
                            : 'No scores entered'}
                        </div>
                      </div>
                    </div>

                    {/* Secondary Metrics Strip: Tokens and Latency */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono text-[#8B8B94] bg-[#101012] px-3 py-1.5 rounded border border-[#29292F]">
                      <div>
                        <span>Sample Size: </span>
                        <strong className="text-[#EDEDEF]">
                          Base N={evalData.baselineCount} · Exp N={evalData.experimentalCount}
                        </strong>
                      </div>
                      <div>
                        <span>Avg Latency: </span>
                        <span className="text-[#EDEDEF]">
                          {evalData.baselineAvgLatencyMs !== null ? `${evalData.baselineAvgLatencyMs}ms` : 'N/A'} →{' '}
                          {evalData.experimentalAvgLatencyMs !== null ? `${evalData.experimentalAvgLatencyMs}ms` : 'N/A'}{' '}
                          ({evalData.latencyDeltaMs !== null ? `${evalData.latencyDeltaMs > 0 ? '+' : ''}${evalData.latencyDeltaMs}ms` : 'N/A'})
                        </span>
                      </div>
                      <div>
                        <span>Input/Output Tokens: </span>
                        <span className="text-[#EDEDEF]">
                          {evalData.baselineAvgInputTokens}/{evalData.baselineAvgOutputTokens} → {evalData.experimentalAvgInputTokens}/{evalData.experimentalAvgOutputTokens}
                        </span>
                      </div>
                    </div>

                    {/* Scientific Warnings and Statistical Limitations */}
                    {evalData.warnings.length > 0 && (
                      <div className="space-y-1 bg-amber-950/20 border border-amber-900/40 rounded p-2.5 text-xs">
                        <div className="font-medium text-amber-300 flex items-center gap-1.5 font-mono text-[10px]">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          <span>Scientific Evaluation Notices ({evalData.warnings.length})</span>
                        </div>
                        <ul className="space-y-0.5 text-[#8B8B94] text-[11px] list-disc list-inside">
                          {evalData.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes & Configurations */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-sans text-[#8B8B94] border-t border-[#29292F] pt-2">
                      <div>
                        <strong className="text-[#EDEDEF] block mb-0.5 text-[11px]">Baseline Configuration:</strong>
                        <p className="text-[11px] bg-[#101012] p-2 rounded border border-[#29292F] font-mono text-[#8B8B94]">
                          {exp.baselineConfig || 'Standard baseline setup'}
                        </p>
                      </div>
                      <div>
                        <strong className="text-[#EDEDEF] block mb-0.5 text-[11px]">Experimental Configuration:</strong>
                        <p className="text-[11px] bg-[#101012] p-2 rounded border border-[#29292F] font-mono text-[#8B8B94]">
                          {exp.experimentalConfig || 'Standard experimental setup'}
                        </p>
                      </div>
                    </div>

                    {exp.notes && (
                      <p className="text-xs text-[#8B8B94] font-sans border-t border-[#29292F] pt-2">
                        <strong className="text-[#EDEDEF]">Evaluation Notes:</strong> {exp.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit/Create Experiment Modal */}
          {isEditingExp && editingExp && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="exp-modal-title"
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs overflow-y-auto"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editingExp.name?.trim()) return;

                  onSaveExperiment({
                    id: editingExp.id || `exp_${Date.now()}`,
                    name: editingExp.name.trim(),
                    objective: editingExp.objective?.trim() || '',
                    project: editingExp.project || 'General',
                    task: editingExp.task || 'code_generation',
                    taskCategory: editingExp.taskCategory || 'code_generation',
                    status: (editingExp.status as ExperimentStatus) || 'collecting_data',
                    baselineModel: editingExp.baselineModel || 'gpt-4o',
                    experimentalModel: editingExp.experimentalModel || 'gpt-4o-mini',
                    baselineConfig: editingExp.baselineConfig || '',
                    experimentalConfig: editingExp.experimentalConfig || '',
                    sampleSizeTarget: editingExp.sampleSizeTarget || 20,
                    inclusionCriteria: editingExp.inclusionCriteria || '',
                    evaluationMethod: editingExp.evaluationMethod || 'human_eval',
                    baselineRuns: editingExp.baselineRuns || [],
                    experimentalRuns: editingExp.experimentalRuns || [],
                    notes: editingExp.notes || '',
                    createdAt: editingExp.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  setIsEditingExp(false);
                }}
                className="bg-[#151518] border border-[#29292F] rounded-lg max-w-2xl w-full p-5 space-y-4 shadow-xl text-xs animate-in fade-in zoom-in-95 duration-150 my-8"
              >
                <div className="flex items-center justify-between border-b border-[#29292F] pb-2.5">
                  <h4 id="exp-modal-title" className="text-xs font-semibold text-[#EDEDEF] flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-[#7C6FF7]" />
                    <span>{editingExp.createdAt ? 'Edit Optimization Experiment' : 'New Optimization Experiment'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsEditingExp(false)}
                    aria-label="Close modal"
                    className="p-1 rounded text-[#8B8B94] hover:text-[#EDEDEF]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  <div>
                    <label className="text-[#EDEDEF] block mb-1 font-medium">Experiment Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Code Review: Claude 3.5 Sonnet vs Haiku"
                      value={editingExp.name || ''}
                      onChange={(e) => setEditingExp({ ...editingExp, name: e.target.value })}
                      className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-sans"
                    />
                  </div>

                  <div>
                    <label className="text-[#EDEDEF] block mb-1 font-medium">Objective & Hypothesis</label>
                    <input
                      type="text"
                      placeholder="e.g. Verify if few-shot guidance on Haiku achieves >= 85/100 quality while reducing cost by 60%."
                      value={editingExp.objective || ''}
                      onChange={(e) => setEditingExp({ ...editingExp, objective: e.target.value })}
                      className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Project</label>
                      <input
                        type="text"
                        placeholder="e.g. Developer Tools"
                        value={editingExp.project || ''}
                        onChange={(e) => setEditingExp({ ...editingExp, project: e.target.value })}
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                      />
                    </div>
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Task Category</label>
                      <input
                        type="text"
                        placeholder="e.g. code_generation"
                        value={editingExp.taskCategory || ''}
                        onChange={(e) => setEditingExp({ ...editingExp, taskCategory: e.target.value })}
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                      />
                    </div>
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Status</label>
                      <select
                        value={editingExp.status || 'collecting_data'}
                        onChange={(e) =>
                          setEditingExp({ ...editingExp, status: e.target.value as ExperimentStatus })
                        }
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                      >
                        <option value="draft">Draft</option>
                        <option value="collecting_data">Collecting Data</option>
                        <option value="ready_for_review">Ready for Review</option>
                        <option value="completed">Completed</option>
                        <option value="inconclusive">Inconclusive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Baseline Model</label>
                      <input
                        type="text"
                        value={editingExp.baselineModel || ''}
                        onChange={(e) => setEditingExp({ ...editingExp, baselineModel: e.target.value })}
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] font-mono focus:outline-none focus:border-[#7C6FF7]"
                      />
                    </div>
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Experimental Model</label>
                      <input
                        type="text"
                        value={editingExp.experimentalModel || ''}
                        onChange={(e) =>
                          setEditingExp({ ...editingExp, experimentalModel: e.target.value })
                        }
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] font-mono focus:outline-none focus:border-[#7C6FF7]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Baseline Config Description</label>
                      <textarea
                        rows={2}
                        placeholder="Prompt structure, temperature, system messages..."
                        value={editingExp.baselineConfig || ''}
                        onChange={(e) => setEditingExp({ ...editingExp, baselineConfig: e.target.value })}
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-mono text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Experimental Config Description</label>
                      <textarea
                        rows={2}
                        placeholder="Modified prompt structure, caching headers, parameter adjustments..."
                        value={editingExp.experimentalConfig || ''}
                        onChange={(e) =>
                          setEditingExp({ ...editingExp, experimentalConfig: e.target.value })
                        }
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Evaluation Method</label>
                      <select
                        value={editingExp.evaluationMethod || 'human_eval'}
                        onChange={(e) =>
                          setEditingExp({
                            ...editingExp,
                            evaluationMethod: e.target.value as any,
                          })
                        }
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                      >
                        <option value="human_eval">Human Expert Evaluation (1-100)</option>
                        <option value="automated_benchmark">Automated Benchmark / Assertions</option>
                        <option value="unit_tests">Unit Test Pass / Fail Suite</option>
                        <option value="llm_judge">LLM-as-a-Judge Rubric</option>
                        <option value="production_ab">Production A/B Split</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[#EDEDEF] block mb-1 font-medium">Target Sample Size</label>
                      <input
                        type="number"
                        min="5"
                        max="1000"
                        value={editingExp.sampleSizeTarget || 20}
                        onChange={(e) =>
                          setEditingExp({ ...editingExp, sampleSizeTarget: Number(e.target.value) })
                        }
                        className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] font-mono focus:outline-none focus:border-[#7C6FF7]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[#EDEDEF] block mb-1 font-medium">Inclusion Criteria</label>
                    <input
                      type="text"
                      placeholder="e.g. Only queries in English with input tokens between 500 and 3,000."
                      value={editingExp.inclusionCriteria || ''}
                      onChange={(e) =>
                        setEditingExp({ ...editingExp, inclusionCriteria: e.target.value })
                      }
                      className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7]"
                    />
                  </div>

                  <div>
                    <label className="text-[#EDEDEF] block mb-1 font-medium">Evaluation & Trade-Off Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Document quality scoring criteria, edge case failures, and latency trade-offs..."
                      value={editingExp.notes || ''}
                      onChange={(e) => setEditingExp({ ...editingExp, notes: e.target.value })}
                      className="w-full bg-[#101012] border border-[#29292F] rounded-md px-3 py-1.5 text-[#EDEDEF] focus:outline-none focus:border-[#7C6FF7] font-sans"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#29292F]">
                  <button
                    type="button"
                    onClick={() => setIsEditingExp(false)}
                    className="px-3 py-1.5 text-[#8B8B94] hover:text-[#EDEDEF] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#7C6FF7] hover:bg-[#6B5EE4] text-white rounded-md font-medium shadow-2xs"
                  >
                    Save Experiment
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Delete Experiment Confirmation Modal */}
          {expToDelete && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-exp-modal"
              className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
            >
              <div className="bg-[#151518] border border-rose-900/60 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span id="delete-exp-modal">Confirm Experiment Deletion</span>
                </div>
                <p className="text-[#8B8B94] font-sans">
                  Are you sure you want to delete experiment{' '}
                  <strong className="text-[#EDEDEF]">"{expToDelete.name}"</strong>?
                </p>
                <div className="p-2.5 rounded bg-[#101012] border border-[#29292F] text-[11px] text-[#8B8B94]">
                  This action removes the experiment configuration and evaluation runs. Historical usage events will <strong>not</strong> be affected.
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setExpToDelete(null)}
                    className="px-3 py-1.5 text-[#8B8B94] hover:text-[#EDEDEF] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteExperiment) {
                        onDeleteExperiment(expToDelete.id);
                      }
                      setExpToDelete(null);
                    }}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md font-medium shadow-2xs"
                  >
                    Delete Experiment
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
