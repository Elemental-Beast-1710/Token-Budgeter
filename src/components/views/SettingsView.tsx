import React, { useState, useRef } from 'react';
import {
  Settings,
  Database,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Layers,
  FileCode,
  FileSpreadsheet,
  X,
  ShieldAlert,
} from 'lucide-react';
import { AppSettings, ImportBatchRecord, PricingRate, StorageHealth } from '../../types';
import { exportAllToJson, importBackupJson } from '../../services/storage';
import { downloadFile } from '../../services/export';
import { formatCurrency } from '../../services/currency';

interface SettingsViewProps {
  settings: AppSettings;
  pricingRates: PricingRate[];
  batches: ImportBatchRecord[];
  storageHealth: StorageHealth | null;
  totalEventsCount: number;
  sampleEventsCount: number;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onSavePricingRate: (rate: PricingRate) => void;
  onDeleteBatch: (batchId: string) => void;
  onResetSampleData: () => void;
  onRemoveSampleData: () => void;
  onStartFreshWorkspace?: () => void;
  onWipeAllData: () => void;
  onReloadAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  pricingRates,
  batches,
  storageHealth,
  totalEventsCount,
  sampleEventsCount,
  onUpdateSettings,
  onSavePricingRate,
  onDeleteBatch,
  onResetSampleData,
  onRemoveSampleData,
  onStartFreshWorkspace,
  onWipeAllData,
  onReloadAllData,
}) => {
  const [currency, setCurrency] = useState(settings.currency || 'USD');
  const [timezone, setTimezone] = useState(settings.timezone || 'UTC');
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // New rate card modal
  const [isAddingRate, setIsAddingRate] = useState(false);
  const [newRate, setNewRate] = useState<Partial<PricingRate>>({
    provider: 'openai',
    model: '',
    inputPerMillionUsd: 1.0,
    outputPerMillionUsd: 2.0,
    cachedInputPerMillionUsd: 0.5,
    effectiveDate: new Date().toISOString().split('T')[0],
    source: 'Custom Manual Entry',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddingRate) setIsAddingRate(false);
        if (deletingBatchId) setDeletingBatchId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingRate, deletingBatchId]);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      currency,
      timezone,
    });
  };

  const handleExportBackup = async () => {
    const json = await exportAllToJson();
    downloadFile(json, `tokenbudgeter-full-backup-v2-${Date.now()}.json`, 'application/json');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreStatus(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = String(evt.target?.result || '');
        const res = await importBackupJson(content);
        setRestoreStatus({
          success: `Restored ${res.importedEvents} events, ${res.importedProjects} projects, and ${res.importedBatches} batches successfully.`,
        });
        onReloadAllData();
      } catch (err: any) {
        setRestoreStatus({
          error: `Restore failed: ${err?.message || 'Invalid backup structure.'}`,
        });
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setRestoreStatus({ error: 'Failed to read backup file.' });
      setIsRestoring(false);
    };
    reader.readAsText(file);
  };

  const handleAddRateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate.model?.trim()) return;

    onSavePricingRate({
      id: `rate_${newRate.provider}_${newRate.model.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      provider: newRate.provider as any,
      model: newRate.model.trim(),
      inputPerMillionUsd: Number(newRate.inputPerMillionUsd) || 0,
      outputPerMillionUsd: Number(newRate.outputPerMillionUsd) || 0,
      cachedInputPerMillionUsd: Number(newRate.cachedInputPerMillionUsd) || undefined,
      effectiveDate: newRate.effectiveDate || new Date().toISOString().split('T')[0],
      source: newRate.source || 'Manual User Configuration',
    });

    setIsAddingRate(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-[#151518] border border-[#29292F] p-5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#7C6FF7]" />
            <span>Platform Settings & Storage Governance</span>
          </h2>
          <p className="text-xs text-[#8B8B94] mt-0.5">
            Manage browser-local persistence, schema versioning, import batch lifecycle, and pricing catalogs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#101012] hover:bg-[#1C1C20] text-[#EDEDEF] rounded border border-[#29292F] transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Full Backup (JSON)</span>
          </button>
          <button
            disabled={isRestoring}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#101012] hover:bg-[#1C1C20] text-[#EDEDEF] rounded border border-[#29292F] transition-colors shadow-xs disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5 text-[#7C6FF7]" />
            <span>{isRestoring ? 'Restoring...' : 'Restore Backup'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportBackup}
          />
        </div>
      </div>

      {/* Restore Status Alert */}
      {restoreStatus?.success && (
        <div className="bg-[#101915] border border-emerald-900/60 rounded-lg p-3.5 flex items-center gap-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{restoreStatus.success}</span>
        </div>
      )}
      {restoreStatus?.error && (
        <div className="bg-[#1E1214] border border-rose-900/60 rounded-lg p-3.5 flex items-center gap-2.5 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{restoreStatus.error}</span>
        </div>
      )}

      {/* Grid: Preferences & Local Storage Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Preferences */}
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
            Display & Formatting Preferences
          </h3>

          <form onSubmit={handleSavePreferences} className="space-y-3 text-xs">
            <div>
              <label className="text-[#8B8B94] block mb-1">Display Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded px-3 py-1.5 focus:outline-none focus:border-[#7C6FF7] font-mono"
              >
                <option value="USD">USD ($) — United States Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
                <option value="JPY">JPY (¥) — Japanese Yen</option>
                <option value="CAD">CAD ($) — Canadian Dollar</option>
              </select>
            </div>

            <div>
              <label className="text-[#8B8B94] block mb-1">Timezone Display</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded px-3 py-1.5 focus:outline-none focus:border-[#7C6FF7] font-mono"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London / GMT</option>
                <option value="Asia/Tokyo">Tokyo / JST</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6D5FE6] rounded transition-colors"
            >
              Save Preferences
            </button>
          </form>
        </div>

        {/* Storage Engine & Health Card */}
        <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono flex items-center justify-between">
              <span>Storage Architecture & Health</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </h3>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-2.5 bg-[#101012] rounded border border-[#29292F]">
                <span className="text-[#8B8B94] text-[10px] block">Engine / Schema</span>
                <span className="text-emerald-400 font-bold uppercase">
                  {storageHealth?.storageType || 'IndexedDB'} (v{storageHealth?.schemaVersion || 2})
                </span>
              </div>
              <div className="p-2.5 bg-[#101012] rounded border border-[#29292F]">
                <span className="text-[#8B8B94] text-[10px] block">Disk Usage Estimate</span>
                <span className="text-[#EDEDEF] font-bold">
                  {storageHealth?.quotaEstimate?.usageBytes
                    ? `${(storageHealth.quotaEstimate.usageBytes / (1024 * 1024)).toFixed(1)} MB`
                    : '< 1 MB'}
                </span>
              </div>
              <div className="p-2.5 bg-[#101012] rounded border border-[#29292F]">
                <span className="text-[#8B8B94] text-[10px] block">Total Ingested Events</span>
                <span className="text-[#EDEDEF] font-bold">{totalEventsCount}</span>
              </div>
              <div className="p-2.5 bg-[#101012] rounded border border-[#29292F]">
                <span className="text-[#8B8B94] text-[10px] block">Active Batches</span>
                <span className="text-[#7C6FF7] font-bold">{batches.length}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#8B8B94] leading-relaxed font-sans">
              Storage Abstraction active: Large event records and batch manifests reside in browser IndexedDB. Small display preferences synchronously persist to localStorage for cold boot resilience. Zero telemetry is sent to remote cloud servers.
            </p>
          </div>

          <div className="text-[11px] font-mono text-[#5E5E68] pt-2 border-t border-[#29292F] flex items-center justify-between">
            <span>Status: {storageHealth?.statusMessage || 'Storage operational'}</span>
            <span className="text-emerald-400">Zero Cloud Leak</span>
          </div>
        </div>
      </div>

      {/* Import Batches & Ingestion Governance */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#7C6FF7]" />
              <span>Import Batches & History Governance ({batches.length} batches)</span>
            </h3>
            <p className="text-xs text-[#8B8B94] mt-0.5">
              Inspect provenance and selectively delete entire import batches without affecting other datasets.
            </p>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="p-6 bg-[#101012] rounded border border-[#29292F] text-center text-xs text-[#8B8B94]">
            No tracked import batches found. Import a CSV or JSON file from the Ingestion pipeline to register a batch manifest.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#101012] text-[#8B8B94] border-b border-[#29292F]">
                <tr>
                  <th className="py-2.5 px-3">Batch File / Manifest</th>
                  <th className="py-2.5 px-3">Origin</th>
                  <th className="py-2.5 px-3">Imported At</th>
                  <th className="py-2.5 px-3 text-right">Valid Rows</th>
                  <th className="py-2.5 px-3 text-right">Volume (Tokens)</th>
                  <th className="py-2.5 px-3 text-right">Total Spend</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222226] text-[11px]">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-[#1C1C20]/40">
                    <td className="py-2.5 px-3 font-semibold text-[#EDEDEF] flex items-center gap-2">
                      {batch.fileType === 'csv' ? (
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <FileCode className="w-3.5 h-3.5 text-[#7C6FF7] shrink-0" />
                      )}
                      <span className="truncate max-w-[180px]" title={batch.fileName}>
                        {batch.fileName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {batch.isSample ? (
                        <span className="text-[10px] bg-[#101012] text-amber-400 border border-[#29292F] px-1.5 py-0.5 rounded">
                          Fictional Sample
                        </span>
                      ) : (
                        <span className="text-[10px] bg-[#101012] text-emerald-400 border border-[#29292F] px-1.5 py-0.5 rounded">
                          User Imported
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#8B8B94] whitespace-nowrap">
                      {new Date(batch.importedAt).toLocaleDateString()}{' '}
                      <span className="text-[#5E5E68]">
                        {new Date(batch.importedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#EDEDEF]">
                      {batch.validCount}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#8B8B94]">
                      {(batch.totalTokens / 1000).toFixed(1)}k
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#EDEDEF]">
                      ${batch.totalCostUsd.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setDeletingBatchId(batch.id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-[#1E1214] px-2 py-1 rounded transition-colors text-[11px]"
                      >
                        Delete Batch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pricing Rate Card Catalog Management */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono">
              Verified Pricing Rate Cards ({pricingRates.length} models)
            </h3>
            <p className="text-xs text-[#8B8B94] mt-0.5">
              Deterministic rates in USD per 1 Million Tokens (1,000,000 tkn). Used when source logs do not explicitly state reported cost.
            </p>
          </div>

          <button
            onClick={() => setIsAddingRate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6D5FE6] rounded transition-colors shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rate Card</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#101012] text-[#8B8B94] border-b border-[#29292F]">
              <tr>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3 text-right">In / 1M ($)</th>
                <th className="py-2.5 px-3 text-right">Out / 1M ($)</th>
                <th className="py-2.5 px-3 text-right">Cache Read / 1M ($)</th>
                <th className="py-2.5 px-3">Effective Date</th>
                <th className="py-2.5 px-3">Source Provenance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222226] text-[11px]">
              {pricingRates.map((rate) => (
                <tr key={rate.id} className="hover:bg-[#1C1C20]/40">
                  <td className="py-2.5 px-3 font-semibold text-[#EDEDEF]">{rate.model}</td>
                  <td className="py-2.5 px-3 uppercase text-[#8B8B94]">{rate.provider}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#EDEDEF]">
                    ${rate.inputPerMillionUsd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#EDEDEF]">
                    ${rate.outputPerMillionUsd.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-emerald-400">
                    {rate.cachedInputPerMillionUsd !== undefined
                      ? `$${rate.cachedInputPerMillionUsd.toFixed(3)}`
                      : 'Standard'}
                  </td>
                  <td className="py-2.5 px-3 text-[#8B8B94]">{rate.effectiveDate}</td>
                  <td className="py-2.5 px-3 text-[#5E5E68] truncate max-w-xs">{rate.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demo Data & Workspace Governance */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#8B8B94] uppercase tracking-wider font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-[#7C6FF7]" />
              <span>Demo Data & Workspace Governance</span>
            </h3>
            <p className="text-xs text-[#8B8B94] mt-0.5">
              Safely isolate fictional sample workloads from real telemetry. Demo records are never included in real usage totals unless Demo Mode is explicitly enabled.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#8B8B94]">Active Mode:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                settings.workspaceMode === 'demo'
                  ? 'bg-amber-950/50 text-amber-300 border-amber-900/60'
                  : 'bg-emerald-950/50 text-emerald-400 border-emerald-900/60'
              }`}
            >
              {settings.workspaceMode === 'demo' ? 'Demo Mode (Sample Data Included)' : 'Real Data Only (Sample Excluded)'}
            </span>
          </div>
        </div>

        {/* Provenance Statistics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-[#101012] rounded border border-[#29292F]">
            <span className="text-[10px] text-[#8B8B94] block">Fictional Demo Records</span>
            <span className="text-amber-400 font-bold text-sm tabular-nums">{sampleEventsCount}</span>
            <span className="text-[10px] text-[#5E5E68] block mt-0.5">Origin: sample</span>
          </div>

          <div className="p-3 bg-[#101012] rounded border border-[#29292F]">
            <span className="text-[10px] text-[#8B8B94] block">Real User Records</span>
            <span className="text-emerald-400 font-bold text-sm tabular-nums">
              {Math.max(0, totalEventsCount - sampleEventsCount)}
            </span>
            <span className="text-[10px] text-[#5E5E68] block mt-0.5">Origin: imported | manual</span>
          </div>

          <div className="p-3 bg-[#101012] rounded border border-[#29292F]">
            <span className="text-[10px] text-[#8B8B94] block">Workspace Scope Setting</span>
            <button
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  workspaceMode: settings.workspaceMode === 'demo' ? 'real' : 'demo',
                })
              }
              className="mt-1 px-2.5 py-1 text-[11px] font-sans font-medium rounded bg-[#1C1C20] hover:bg-[#25252A] text-[#EDEDEF] border border-[#29292F] transition-colors"
            >
              Switch to {settings.workspaceMode === 'demo' ? 'Real Data Only' : 'Demo Mode'}
            </button>
          </div>
        </div>

        {/* Three Explicit Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-sans">
          {/* Action 1: Load / Reload Demo Data */}
          <div className="p-3.5 bg-[#101012] rounded border border-[#29292F] space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-semibold text-[#EDEDEF] block flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-[#7C6FF7]" />
                <span>{sampleEventsCount > 0 ? 'Reload Demo Dataset' : 'Load Demo Data'}</span>
              </span>
              <p className="text-[11px] text-[#8B8B94] leading-relaxed">
                Loads verified fictional workloads (PR review, test generation, duplicates, and prompt caching). Replaces previous demo records without duplicates. Real data remains intact.
              </p>
            </div>
            <button
              onClick={onResetSampleData}
              className="w-full py-1.5 px-3 bg-[#151518] hover:bg-[#1C1C20] text-[#EDEDEF] border border-[#29292F] rounded text-xs font-medium transition-colors"
            >
              {sampleEventsCount > 0 ? 'Reload Demo Records' : 'Load Demo Records'}
            </button>
          </div>

          {/* Action 2: Remove All Demo Data */}
          <div className="p-3.5 bg-[#101012] rounded border border-[#29292F] space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-semibold text-amber-300 block flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Remove All Demo Data</span>
              </span>
              <p className="text-[11px] text-[#8B8B94] leading-relaxed">
                Permanently purges all sample events and batches from IndexedDB. Imported, manual, and synchronized records are never deleted. Persists after reload.
              </p>
            </div>
            <button
              disabled={sampleEventsCount === 0}
              onClick={onRemoveSampleData}
              className="w-full py-1.5 px-3 bg-[#151518] hover:bg-[#1C1C20] text-amber-400 border border-[#29292F] rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sampleEventsCount === 0 ? 'No Demo Data to Remove' : 'Remove All Demo Data'}
            </button>
          </div>

          {/* Action 3: Start with an Empty Workspace */}
          <div className="p-3.5 bg-[#101012] rounded border border-[#29292F] space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-semibold text-emerald-400 block flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Start Fresh Workspace</span>
              </span>
              <p className="text-[11px] text-[#8B8B94] leading-relaxed">
                Clears demo records and sets workspace to pristine empty state with baseline pricing rates ready for real log ingestion.
              </p>
            </div>
            <button
              onClick={() => {
                if (onStartFreshWorkspace) {
                  onStartFreshWorkspace();
                } else {
                  onRemoveSampleData();
                }
              }}
              className="w-full py-1.5 px-3 bg-[#151518] hover:bg-[#1C1C20] text-emerald-400 border border-[#29292F] rounded text-xs font-medium transition-colors"
            >
              Start Empty Workspace
            </button>
          </div>
        </div>
      </div>

      {/* Dangerous Operations Strip: Permanent Database Wipe */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-3">
        <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Permanent Database Wipe</span>
        </h3>

        <div className="p-3.5 bg-[#1E1214] border border-rose-900/40 rounded space-y-2">
          <p className="text-[11px] text-rose-200/80 leading-relaxed font-sans">
            Irreversibly delete all events (both real user imports and demo data), imported batches, project budgets, and rate card overrides from your browser IndexedDB and localStorage cache.
          </p>

          {!confirmWipe ? (
            <button
              onClick={() => setConfirmWipe(true)}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-700 hover:bg-rose-600 rounded transition-colors"
            >
              Delete All Workspace Data
            </button>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  onWipeAllData();
                  setConfirmWipe(false);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded transition-colors"
              >
                Yes, Permanently Purge Everything
              </button>
              <button
                onClick={() => setConfirmWipe(false)}
                className="px-3 py-1.5 text-xs text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Batch Confirmation Modal */}
      {deletingBatchId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <div className="bg-[#151518] border border-[#29292F] rounded-lg max-w-sm w-full p-5 space-y-4 shadow-xl text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-rose-400 font-semibold">
              <Trash2 className="w-4 h-4" />
              <span>Delete Import Batch?</span>
            </div>
            <p className="text-[#8B8B94] leading-relaxed">
              This will remove all usage events associated with batch <span className="font-mono text-[#EDEDEF]">{deletingBatchId}</span>. Other batches and rate cards will be preserved.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#29292F]">
              <button
                onClick={() => setDeletingBatchId(null)}
                className="px-3 py-1.5 text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteBatch(deletingBatchId);
                  setDeletingBatchId(null);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded transition-colors"
              >
                Delete Batch Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Rate Card Modal */}
      {isAddingRate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-rate-title"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <form
            onSubmit={handleAddRateSubmit}
            className="bg-[#151518] border border-[#29292F] rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl text-xs animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 id="modal-rate-title" className="text-sm font-semibold text-[#EDEDEF]">Add Custom Pricing Rate Card</h3>

            <div className="space-y-3">
              <div>
                <label className="text-[#8B8B94] block mb-1">Provider</label>
                <select
                  value={newRate.provider}
                  onChange={(e) => setNewRate({ ...newRate, provider: e.target.value as any })}
                  className="w-full bg-[#101012] border border-[#29292F] rounded px-3 py-1.5 text-[#EDEDEF] uppercase font-mono focus:border-[#7C6FF7]"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="meta">Meta</option>
                  <option value="mistral">Mistral</option>
                  <option value="other">Other / Custom</option>
                </select>
              </div>

              <div>
                <label className="text-[#8B8B94] block mb-1">Model Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. gpt-4.5-preview"
                  value={newRate.model || ''}
                  onChange={(e) => setNewRate({ ...newRate, model: e.target.value })}
                  className="w-full bg-[#101012] border border-[#29292F] rounded px-3 py-1.5 text-[#EDEDEF] font-mono focus:border-[#7C6FF7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-[#8B8B94] block mb-1">Input / 1M ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newRate.inputPerMillionUsd ?? 1.0}
                    onChange={(e) =>
                      setNewRate({ ...newRate, inputPerMillionUsd: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#101012] border border-[#29292F] rounded px-3 py-1.5 text-[#EDEDEF] focus:border-[#7C6FF7]"
                  />
                </div>
                <div>
                  <label className="text-[#8B8B94] block mb-1">Output / 1M ($)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newRate.outputPerMillionUsd ?? 2.0}
                    onChange={(e) =>
                      setNewRate({ ...newRate, outputPerMillionUsd: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-[#101012] border border-[#29292F] rounded px-3 py-1.5 text-[#EDEDEF] focus:border-[#7C6FF7]"
                  />
                </div>
              </div>

              <div className="font-mono">
                <label className="text-[#8B8B94] block mb-1">Cached Input Read / 1M ($)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={newRate.cachedInputPerMillionUsd ?? 0.5}
                  onChange={(e) =>
                    setNewRate({
                      ...newRate,
                      cachedInputPerMillionUsd: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full bg-[#101012] border border-[#29292F] rounded px-3 py-1.5 text-[#EDEDEF] focus:border-[#7C6FF7]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#29292F]">
              <button
                type="button"
                onClick={() => setIsAddingRate(false)}
                className="px-3 py-1.5 text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#7C6FF7] hover:bg-[#6D5FE6] text-white rounded font-medium transition-colors"
              >
                Save Rate Card
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
