import React, { useState, useEffect, useMemo } from 'react';
import {
  AppSettings,
  Experiment,
  FilterState,
  ImportBatchRecord,
  PricingRate,
  ProjectBudget,
  StorageHealth,
  UsageEvent,
} from './types';
import {
  clearAllEvents,
  deleteBatch,
  deleteExperiment,
  deleteProject,
  getAllBatches,
  getAllEvents,
  getAllExperiments,
  getAllPricingRates,
  getAllProjects,
  getSettings,
  getStorageHealth,
  initStorageBaseline,
  initStorageWithSampleIfEmpty,
  loadDemoData,
  removeSampleEvents,
  resetSampleData,
  startFreshWorkspace,
  saveEvents,
  saveExperiment,
  saveImportBatch,
  savePricingRate,
  saveProject,
  saveSettings,
  wipeAllData,
  DEFAULT_SETTINGS,
} from './services/storage';
import { computeKPIs, filterEvents } from './services/analytics';
import { NavTab } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DateFilterBar } from './components/DateFilterBar';
import { FirstRunModal } from './components/FirstRunModal';
import { OverviewView } from './components/views/OverviewView';
import { UsageExplorerView } from './components/views/UsageExplorerView';
import { ProjectsView } from './components/views/ProjectsView';
import { OptimizationLabView } from './components/views/OptimizationLabView';
import { AnalystView } from './components/views/AnalystView';
import { SimulatorView } from './components/views/SimulatorView';
import { ImportView } from './components/views/ImportView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Persistent Stores
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [pricingRates, setPricingRates] = useState<PricingRate[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [batches, setBatches] = useState<ImportBatchRecord[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [isFirstRunActionInProgress, setIsFirstRunActionInProgress] = useState<boolean>(false);

  // Global Filter State
  const [filter, setFilter] = useState<FilterState>({
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

  // Initial Data Load: strictly initializes baseline pricing rates without injecting sample data
  const loadInitialData = async () => {
    try {
      setLoading(true);
      await initStorageBaseline();
      const [evts, projs, rates, exps, sttngs, btchs, health] = await Promise.all([
        getAllEvents(),
        getAllProjects(),
        getAllPricingRates(),
        getAllExperiments(),
        getSettings(),
        getAllBatches(),
        getStorageHealth(),
      ]);

      setEvents(evts);
      setProjects(projs);
      setPricingRates(rates);
      setExperiments(exps);
      setSettings(sttngs);
      setBatches(btchs);
      setStorageHealth(health);
    } catch (err) {
      console.error('Failed to initialize local data store:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Workspace Mode & Scoped Events:
  // In 'real' mode: strictly exclude all sample records (isSample === true or recordOrigin === 'sample')
  // In 'demo' mode: include all records for full evaluation
  const currentWorkspaceMode = settings.workspaceMode || 'real';

  const scopedEvents = useMemo(() => {
    if (currentWorkspaceMode === 'real') {
      return events.filter((e) => !e.isSample && e.recordOrigin !== 'sample');
    }
    return events;
  }, [events, currentWorkspaceMode]);

  // Filtered Events & KPIs computed from scoped dataset
  const filteredEvents = useMemo(() => {
    return filterEvents(scopedEvents, filter);
  }, [scopedEvents, filter]);

  const kpis = useMemo(() => {
    return computeKPIs(filteredEvents);
  }, [filteredEvents]);

  // Distinct Filter Options derived from current scope
  const availableProviders = useMemo(() => {
    return Array.from(new Set(scopedEvents.map((e) => e.provider))).filter(Boolean);
  }, [scopedEvents]);

  const availableProjects = useMemo(() => {
    const fromEvents = scopedEvents.map((e) => e.project);
    const fromBudgets = projects.map((p) => p.name);
    return Array.from(new Set([...fromEvents, ...fromBudgets])).filter(Boolean);
  }, [scopedEvents, projects]);

  const availableModels = useMemo(() => {
    return Array.from(new Set(scopedEvents.map((e) => e.model))).filter(Boolean);
  }, [scopedEvents]);

  const hasSampleData = useMemo(() => {
    return events.some((e) => e.isSample || e.recordOrigin === 'sample');
  }, [events]);

  const dateRangeDescription = useMemo(() => {
    switch (filter.datePreset) {
      case 'today':
        return 'Today';
      case '7d':
        return 'Last 7 Days';
      case '30d':
        return 'Last 30 Days';
      case '90d':
        return 'Last 90 Days';
      case 'custom':
        return filter.customStartDate && filter.customEndDate
          ? `${filter.customStartDate} to ${filter.customEndDate}`
          : 'Custom Range';
      case 'all':
      default:
        return 'All Time';
    }
  }, [filter.datePreset, filter.customStartDate, filter.customEndDate]);

  // Handlers
  const handleCommitImport = async (validRows: UsageEvent[], batchRecord?: ImportBatchRecord) => {
    if (batchRecord) {
      await saveImportBatch(batchRecord, validRows);
    } else {
      await saveEvents(validRows);
    }
    const [refreshedEvents, refreshedBatches, health] = await Promise.all([
      getAllEvents(),
      getAllBatches(),
      getStorageHealth(),
    ]);
    setEvents(refreshedEvents);
    setBatches(refreshedBatches);
    setStorageHealth(health);
  };

  const handleDeleteBatch = async (batchId: string) => {
    await deleteBatch(batchId);
    const [refreshedEvents, refreshedBatches, health] = await Promise.all([
      getAllEvents(),
      getAllBatches(),
      getStorageHealth(),
    ]);
    setEvents(refreshedEvents);
    setBatches(refreshedBatches);
    setStorageHealth(health);
  };

  const handleSaveProject = async (project: ProjectBudget) => {
    await saveProject(project);
    const refreshed = await getAllProjects();
    setProjects(refreshed);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    const refreshed = await getAllProjects();
    setProjects(refreshed);
  };

  const handleSaveExperiment = async (exp: Experiment) => {
    await saveExperiment(exp);
    const refreshed = await getAllExperiments();
    setExperiments(refreshed);
  };

  const handleDeleteExperiment = async (id: string) => {
    await deleteExperiment(id);
    const refreshed = await getAllExperiments();
    setExperiments(refreshed);
  };

  const handleSavePricingRate = async (rate: PricingRate) => {
    await savePricingRate(rate);
    const refreshed = await getAllPricingRates();
    setPricingRates(refreshed);
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    await saveSettings(newSettings);
    setSettings(newSettings);
  };

  const handleExploreDemo = async () => {
    try {
      setIsFirstRunActionInProgress(true);
      await loadDemoData();
      const updatedSettings: AppSettings = {
        ...settings,
        hasSeenWelcome: true,
        workspaceMode: 'demo',
      };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      const [evts, projs, rates, exps, btchs, health] = await Promise.all([
        getAllEvents(),
        getAllProjects(),
        getAllPricingRates(),
        getAllExperiments(),
        getAllBatches(),
        getStorageHealth(),
      ]);
      setEvents(evts);
      setProjects(projs);
      setPricingRates(rates);
      setExperiments(exps);
      setBatches(btchs);
      setStorageHealth(health);
    } finally {
      setIsFirstRunActionInProgress(false);
    }
  };

  const handleStartFresh = async () => {
    try {
      setIsFirstRunActionInProgress(true);
      await startFreshWorkspace();
      const updatedSettings: AppSettings = {
        ...settings,
        hasSeenWelcome: true,
        workspaceMode: 'real',
      };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
      const [evts, projs, rates, exps, btchs, health] = await Promise.all([
        getAllEvents(),
        getAllProjects(),
        getAllPricingRates(),
        getAllExperiments(),
        getAllBatches(),
        getStorageHealth(),
      ]);
      setEvents(evts);
      setProjects(projs);
      setPricingRates(rates);
      setExperiments(exps);
      setBatches(btchs);
      setStorageHealth(health);
    } finally {
      setIsFirstRunActionInProgress(false);
    }
  };

  const handleResetSampleData = async () => {
    await loadDemoData();
    const updatedSettings: AppSettings = {
      ...settings,
      workspaceMode: 'demo',
    };
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
    await loadInitialData();
  };

  const handleRemoveSampleData = async () => {
    await removeSampleEvents();
    const updatedSettings: AppSettings = {
      ...settings,
      workspaceMode: 'real',
    };
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
    const [refreshedEvents, refreshedBatches, health] = await Promise.all([
      getAllEvents(),
      getAllBatches(),
      getStorageHealth(),
    ]);
    setEvents(refreshedEvents);
    setBatches(refreshedBatches);
    setStorageHealth(health);
  };

  const handleStartFreshWorkspace = async () => {
    await startFreshWorkspace();
    const updatedSettings: AppSettings = {
      ...settings,
      workspaceMode: 'real',
    };
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
    const [refreshedEvents, refreshedBatches, health] = await Promise.all([
      getAllEvents(),
      getAllBatches(),
      getStorageHealth(),
    ]);
    setEvents(refreshedEvents);
    setBatches(refreshedBatches);
    setStorageHealth(health);
  };

  const handleToggleWorkspaceMode = async (mode: 'real' | 'demo') => {
    const updatedSettings: AppSettings = {
      ...settings,
      workspaceMode: mode,
    };
    await saveSettings(updatedSettings);
    setSettings(updatedSettings);
  };

  const handleWipeAllData = async () => {
    await wipeAllData();
    setEvents([]);
    setProjects([]);
    setExperiments([]);
    setBatches([]);
    const health = await getStorageHealth();
    setStorageHealth(health);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center text-[#8B8B94] p-4 font-sans">
        <div className="flex flex-col items-center gap-3 max-w-xs text-center">
          <div className="w-9 h-9 rounded-md bg-[#151518] border border-[#29292F] flex items-center justify-center text-[#7C6FF7] font-semibold text-xs tracking-tighter shadow-xs">
            TB
          </div>
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#EDEDEF]">TokenBudgeter</div>
            <p className="text-[11px] text-[#8B8B94] font-mono">Initializing storage & analytics...</p>
          </div>
          <div className="w-32 h-1 bg-[#151518] rounded-full overflow-hidden border border-[#29292F]">
            <div className="h-full bg-[#7C6FF7] rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0D0D0F] text-[#EDEDEF] antialiased font-sans">
      {/* Linear-Style Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currency={settings.currency || 'USD'}
        hasSampleData={hasSampleData}
        onOpenImport={() => setActiveTab('imports')}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* First-Run Experience Modal */}
      {!loading && !settings.hasSeenWelcome && (
        <FirstRunModal
          onExploreDemo={handleExploreDemo}
          onStartFresh={handleStartFresh}
          isLoading={isFirstRunActionInProgress}
        />
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Bar */}
        <TopBar
          activeTab={activeTab}
          onOpenMobile={() => setIsMobileNavOpen(true)}
          currency={settings.currency || 'USD'}
          hasSampleData={hasSampleData}
          workspaceMode={currentWorkspaceMode}
          onToggleWorkspaceMode={handleToggleWorkspaceMode}
          onOpenImport={() => setActiveTab('imports')}
          filteredCount={filteredEvents.length}
          totalCount={scopedEvents.length}
        />

        {/* Date & Dimension Filter Bar (active for analytical views) */}
        {['overview', 'explorer', 'reports', 'optimization', 'analyst'].includes(activeTab) && (
          <DateFilterBar
            filter={filter}
            onChange={setFilter}
            availableProviders={availableProviders}
            availableProjects={availableProjects}
            availableModels={availableModels}
            filteredCount={filteredEvents.length}
            totalCount={scopedEvents.length}
          />
        )}

        {/* View Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
          {/* Ambient Banner for Demo Mode */}
          {currentWorkspaceMode === 'demo' && hasSampleData && (
            <div className="mb-4 bg-amber-950/20 border border-amber-900/40 rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="font-semibold">Demo Mode Active:</span>
                <span className="text-amber-200/80">
                  Displaying fictional sample AI workload (68 events). Demo records are never mixed into real totals in Real Mode.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                <button
                  onClick={() => handleToggleWorkspaceMode('real')}
                  className="px-2.5 py-1 bg-[#151518] hover:bg-[#1C1C20] text-[#EDEDEF] border border-[#29292F] rounded transition-colors"
                >
                  Switch to Real Data Only
                </button>
                <button
                  onClick={handleRemoveSampleData}
                  className="px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-800/50 rounded transition-colors"
                >
                  Remove Demo Records
                </button>
              </div>
            </div>
          )}

          <div key={activeTab} className="animate-fade-in">
            {activeTab === 'overview' && (
              <OverviewView
                events={filteredEvents}
                kpis={kpis}
                currency={settings.currency || 'USD'}
                dateRangeDescription={dateRangeDescription}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'explorer' && (
              <UsageExplorerView
                events={filteredEvents}
                currency={settings.currency || 'USD'}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsView
                projects={projects}
                events={events}
                currency={settings.currency || 'USD'}
                onSaveProject={handleSaveProject}
                onDeleteProject={handleDeleteProject}
              />
            )}

            {activeTab === 'optimization' && (
              <OptimizationLabView
                events={filteredEvents}
                currency={settings.currency || 'USD'}
              />
            )}

            {activeTab === 'analyst' && (
              <AnalystView
                events={filteredEvents}
                currency={settings.currency || 'USD'}
              />
            )}

            {activeTab === 'simulator' && (
              <SimulatorView
                events={filteredEvents}
                currency={settings.currency || 'USD'}
                experiments={experiments}
                onSaveExperiment={handleSaveExperiment}
                onDeleteExperiment={handleDeleteExperiment}
              />
            )}

            {activeTab === 'imports' && (
              <ImportView
                existingEvents={events}
                pricingRates={pricingRates}
                onCommitImport={handleCommitImport}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                events={filteredEvents}
                kpis={kpis}
                currency={settings.currency || 'USD'}
                experiments={experiments}
                dateRangeDescription={dateRangeDescription}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                settings={settings}
                pricingRates={pricingRates}
                batches={batches}
                storageHealth={storageHealth}
                totalEventsCount={events.length}
                sampleEventsCount={events.filter((e) => e.isSample || e.recordOrigin === 'sample').length}
                onUpdateSettings={handleUpdateSettings}
                onSavePricingRate={handleSavePricingRate}
                onDeleteBatch={handleDeleteBatch}
                onResetSampleData={handleResetSampleData}
                onRemoveSampleData={handleRemoveSampleData}
                onStartFreshWorkspace={handleStartFreshWorkspace}
                onWipeAllData={handleWipeAllData}
                onReloadAllData={loadInitialData}
              />
            )}
          </div>
        </main>

        {/* Minimal Quiet Footer */}
        <footer className="border-t border-[#29292F] bg-[#101012] py-3 px-4 sm:px-6 text-[#8B8B94] text-xs no-print">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px]">
            <div>
              TokenBudgeter · AI usage analytics and optimization platform
            </div>
            <div className="flex items-center gap-3 text-[#8B8B94]">
              <span>Measure first · Explain second · Recommend third</span>
              <span className="text-[#5E5E68]">·</span>
              <span className="text-emerald-400">IndexedDB Local</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
