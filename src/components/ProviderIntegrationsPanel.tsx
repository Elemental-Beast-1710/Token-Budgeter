import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Key,
  ShieldCheck,
  Server,
  Layers,
  ArrowRight,
  ExternalLink,
  Sliders,
  X,
  FileSpreadsheet,
  Cpu,
  Radio,
  FileCode,
} from 'lucide-react';
import { ImportBatchRecord, PricingRate, UsageEvent } from '../types';
import {
  fetchIntegrationList,
  testProviderConnection,
  executeProviderSync,
} from '../services/integrationClient';
import {
  ConnectionTestResult,
  IntegrationMetadata,
  SyncResult,
} from '../services/integrations/types';

interface ProviderIntegrationsPanelProps {
  existingEvents: UsageEvent[];
  pricingRates?: PricingRate[];
  onCommitImport: (
    validEvents: UsageEvent[],
    batchRecord?: ImportBatchRecord
  ) => Promise<void> | void;
  onNavigateTab: (tab: any) => void;
  onSwitchToFileImport: () => void;
}

export const ProviderIntegrationsPanel: React.FC<ProviderIntegrationsPanelProps> = ({
  existingEvents,
  pricingRates,
  onCommitImport,
  onNavigateTab,
  onSwitchToFileImport,
}) => {
  const [integrations, setIntegrations] = useState<IntegrationMetadata[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Active configuration modal
  const [activeConfigMeta, setActiveConfigMeta] = useState<IntegrationMetadata | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; res: ConnectionTestResult } | null>(
    null
  );

  // Sync state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; res: SyncResult } | null>(null);

  // Sync time window
  const [syncWindowDays, setSyncWindowDays] = useState<number>(7);

  // Load integrations list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchIntegrationList();
        if (mounted) setIntegrations(list);
      } finally {
        if (mounted) setLoadingList(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenConfig = (meta: IntegrationMetadata) => {
    setActiveConfigMeta(meta);
    setCredentials({});
    setTestResult(null);
  };

  const handleTestConnection = async (meta: IntegrationMetadata) => {
    setTestingConnectionId(meta.id);
    setTestResult(null);
    try {
      const res = await testProviderConnection(meta.id, credentials);
      setTestResult({ id: meta.id, res });
    } finally {
      setTestingConnectionId(null);
    }
  };

  const handleRunSync = async (meta: IntegrationMetadata) => {
    setSyncingId(meta.id);
    setSyncResult(null);

    const now = new Date();
    const startDate = new Date(now.getTime() - syncWindowDays * 86400000).toISOString();

    try {
      const result = await executeProviderSync(meta.id, {
        credentials,
        startDate,
        endDate: now.toISOString(),
        pricingRates,
        existingEvents,
      });

      setSyncResult({ id: meta.id, res: result });

      if (result.success && result.events.length > 0) {
        const batchRecord: ImportBatchRecord = {
          id: result.events[0]?.importBatchId || `sync_${meta.name}_${Date.now()}`,
          fileName: `${meta.displayName} Live Sync`,
          fileType: 'json',
          fileSize: result.events.length * 128,
          importedAt: new Date().toISOString(),
          validCount: result.events.length,
          duplicateCount: result.duplicatesCount,
          rejectedCount: 0,
          totalTokens: result.events.reduce((s, e) => s + (e.inputTokens + e.outputTokens), 0),
          totalCostUsd: result.events.reduce(
            (s, e) => s + (e.reportedCost || e.estimatedCost || 0),
            0
          ),
          isSample: meta.id === 'mock_sandbox',
        };

        await onCommitImport(result.events, batchRecord);
      }
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview & Governance Notice */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2 font-mono">
              <Server className="w-4 h-4 text-[#7C6FF7]" />
              <span>Direct Provider Integrations & API Sync Hub</span>
            </h3>
            <p className="text-xs text-[#8B8B94] mt-1">
              Authorized live synchronization via official usage APIs, OTel collectors, and structured sandbox adapters.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-[#8B8B94]">Sync Window:</span>
            <select
              value={syncWindowDays}
              onChange={(e) => setSyncWindowDays(Number(e.target.value))}
              className="bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[#7C6FF7]"
            >
              <option value={1}>Last 24 Hours</option>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>

        <div className="p-3 bg-[#101012] rounded border border-[#29292F] text-[11px] text-[#8B8B94] space-y-1">
          <div className="flex items-center gap-1.5 text-[#EDEDEF] font-semibold font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Credential Exfiltration & Narrow Scopes Principle</span>
          </div>
          <p>
            API keys and tokens are submitted over secure server proxy routes and never persisted in public bundles or emitted to telemetry logs. All sync operations are strictly idempotent with deterministic fingerprint deduplication.
          </p>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncResult && (
        <div
          className={`p-4 rounded-lg border text-xs space-y-2 ${
            syncResult.res.success
              ? 'bg-[#101915] border-emerald-900/60 text-emerald-200'
              : 'bg-[#1E1214] border-rose-900/60 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5 font-mono">
              {syncResult.res.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>
                {syncResult.res.success ? 'Synchronization Successful' : 'Synchronization Failed'}
              </span>
            </span>
            <button
              onClick={() => setSyncResult(null)}
              className="text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="font-mono text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[#EDEDEF]">
            <div>
              <span className="text-[#8B8B94] block text-[10px]">New Records Ingested</span>
              <span className="text-[#EDEDEF] font-bold tabular-nums">{syncResult.res.newEventsCount}</span>
            </div>
            <div>
              <span className="text-[#8B8B94] block text-[10px]">Duplicates Quarantined</span>
              <span className="text-[#8B8B94] font-bold tabular-nums">{syncResult.res.duplicatesCount}</span>
            </div>
            <div>
              <span className="text-[#8B8B94] block text-[10px]">Batch Sync State</span>
              <span className="uppercase font-bold text-[#7C6FF7]">{syncResult.res.state}</span>
            </div>
            <div>
              <span className="text-[#8B8B94] block text-[10px]">Next Page Cursor</span>
              <span className="text-[#8B8B94] truncate block">
                {syncResult.res.nextCursor || 'None (Fully Synced)'}
              </span>
            </div>
          </div>

          {syncResult.res.error && (
            <p className="text-rose-300 font-mono text-[11px] pt-1 border-t border-rose-900/40">
              Error details: {syncResult.res.error}
            </p>
          )}

          {syncResult.res.warnings && syncResult.res.warnings.length > 0 && (
            <div className="text-amber-300 font-mono text-[11px] pt-1 space-y-0.5 border-t border-amber-900/40">
              {syncResult.res.warnings.map((w, idx) => (
                <p key={idx}>Notice: {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((meta) => {
          const isSyncing = syncingId === meta.id;
          const isTesting = testingConnectionId === meta.id;
          const currentTest = testResult?.id === meta.id ? testResult.res : null;

          return (
            <div
              key={meta.id}
              className="bg-[#151518] border border-[#29292F] rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-[#3E3E48] transition-colors"
            >
              <div className="space-y-3">
                {/* Header Strip */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#EDEDEF] font-mono">
                        {meta.displayName}
                      </span>
                      {meta.status === 'connected' && (
                        <span className="text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Connected
                        </span>
                      )}
                      {meta.status === 'mock_sandbox' && (
                        <span className="text-[10px] font-mono bg-[#7C6FF7]/15 text-[#7C6FF7] border border-[#7C6FF7]/30 px-2 py-0.5 rounded">
                          Sandbox Mode
                        </span>
                      )}
                      {meta.status === 'credentials_required' && (
                        <span className="text-[10px] font-mono bg-amber-950/50 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded">
                          Credentials Required
                        </span>
                      )}
                      {meta.status === 'file_export_only' && (
                        <span className="text-[10px] font-mono bg-[#101012] text-[#8B8B94] border border-[#29292F] px-2 py-0.5 rounded">
                          Console Export Only
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8B8B94] line-clamp-2">{meta.description}</p>
                  </div>
                </div>

                {/* Capability Badges */}
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                  {meta.capabilities.supportsDirectSync && (
                    <span className="px-1.5 py-0.5 bg-[#101012] text-[#7C6FF7] rounded border border-[#29292F]">
                      Live Sync
                    </span>
                  )}
                  {meta.capabilities.supportsIncrementalSync && (
                    <span className="px-1.5 py-0.5 bg-[#101012] text-emerald-400 rounded border border-[#29292F]">
                      Incremental Cursor
                    </span>
                  )}
                  {meta.capabilities.supportsCachedTokens && (
                    <span className="px-1.5 py-0.5 bg-[#101012] text-[#8B8B94] rounded border border-[#29292F]">
                      Prompt Cache Tracking
                    </span>
                  )}
                  {meta.capabilities.supportsProjectGrouping && (
                    <span className="px-1.5 py-0.5 bg-[#101012] text-[#8B8B94] rounded border border-[#29292F]">
                      Project Attribution
                    </span>
                  )}
                  {meta.capabilities.supportsGranularRequests ? (
                    <span className="px-1.5 py-0.5 bg-[#101012] text-cyan-400 rounded border border-[#29292F]">
                      Per-Request Traces
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-[#101012] text-amber-400 rounded border border-[#29292F]">
                      Hourly Aggregates
                    </span>
                  )}
                </div>

                {/* Data Granularity & Scope Summary */}
                <div className="bg-[#101012] p-2.5 rounded border border-[#29292F] text-[11px] font-mono space-y-1 text-[#8B8B94]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5E5E68]">Data Basis:</span>
                    <span className="text-[#EDEDEF]">{meta.documentation.dataGranularity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5E5E68]">History Limit:</span>
                    <span className="text-[#EDEDEF]">{meta.documentation.historicalWindowLimit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5E5E68]">Latency / Lag:</span>
                    <span className="text-[#EDEDEF]">{meta.documentation.syncDelayLatency}</span>
                  </div>
                </div>

                {/* Test Result Feedback */}
                {currentTest && (
                  <div
                    className={`p-2.5 rounded text-[11px] font-mono border ${
                      currentTest.ok
                        ? 'bg-[#101915] border-emerald-900/60 text-emerald-300'
                        : 'bg-[#1E1214] border-rose-900/60 text-rose-300'
                    }`}
                  >
                    <div className="font-semibold">{currentTest.message}</div>
                    {currentTest.details?.organizationId && (
                      <div className="text-[10px] text-[#8B8B94] mt-1">
                        Org: {currentTest.details.organizationId} · Models Verified: {currentTest.details.availableModelsCount ?? 'N/A'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#29292F] flex items-center justify-between gap-2">
                <a
                  href={meta.officialDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#8B8B94] hover:text-[#7C6FF7] font-mono flex items-center gap-1 transition-colors"
                >
                  <span>API Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  {meta.status === 'file_export_only' ? (
                    <button
                      onClick={onSwitchToFileImport}
                      className="px-3 py-1.5 text-xs bg-[#101012] hover:bg-[#1C1C20] text-[#EDEDEF] rounded border border-[#29292F] font-mono flex items-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload Console CSV</span>
                    </button>
                  ) : (
                    <>
                      {meta.credentialFields.length > 0 && (
                        <button
                          onClick={() => handleOpenConfig(meta)}
                          className="px-2.5 py-1.5 text-xs bg-[#101012] hover:bg-[#1C1C20] text-[#8B8B94] hover:text-[#EDEDEF] rounded border border-[#29292F] font-mono flex items-center gap-1 transition-colors"
                        >
                          <Key className="w-3 h-3 text-amber-400" />
                          <span>Credentials</span>
                        </button>
                      )}

                      <button
                        disabled={isTesting}
                        onClick={() => handleTestConnection(meta)}
                        className="px-2.5 py-1.5 text-xs bg-[#101012] hover:bg-[#1C1C20] text-[#8B8B94] hover:text-[#EDEDEF] rounded border border-[#29292F] font-mono transition-colors disabled:opacity-50"
                      >
                        {isTesting ? 'Testing...' : 'Test'}
                      </button>

                      <button
                        disabled={isSyncing}
                        onClick={() => handleRunSync(meta)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-[#7C6FF7] hover:bg-[#6D5FE6] rounded font-mono flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comprehensive Provider Capability Matrix & Reconciliation Documentation */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-[#EDEDEF] uppercase tracking-wider font-mono">
            Provider Integration & Field Support Documentation Matrix
          </h3>
          <p className="text-xs text-[#8B8B94] mt-0.5">
            Detailed verification breakdown of official API endpoints, supported dimensions, and reconciliation constraints.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#101012] text-[#8B8B94] border-b border-[#29292F] text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Provider</th>
                <th className="py-2.5 px-3">Sync Method</th>
                <th className="py-2.5 px-3">Supported Canonical Fields</th>
                <th className="py-2.5 px-3">Unsupported Fields</th>
                <th className="py-2.5 px-3">Required Permissions</th>
                <th className="py-2.5 px-3">Reconciliation Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222226] text-[11px]">
              {integrations.map((meta) => (
                <tr key={meta.id} className="hover:bg-[#1C1C20]/40">
                  <td className="py-2.5 px-3 font-semibold text-[#EDEDEF] whitespace-nowrap">
                    {meta.displayName}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[10px] bg-[#101012] px-1.5 py-0.5 rounded border border-[#29292F] text-[#7C6FF7]">
                      {meta.capabilities.supportsDirectSync ? 'REST API (Live)' : 'File Export'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#EDEDEF] max-w-xs">
                    <div className="line-clamp-2" title={meta.documentation.supportedFields.join(', ')}>
                      {meta.documentation.supportedFields.slice(0, 4).join(', ')}...
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[#8B8B94] max-w-xs">
                    <div className="line-clamp-2" title={meta.documentation.unsupportedFields.join(', ')}>
                      {meta.documentation.unsupportedFields.length > 0
                        ? meta.documentation.unsupportedFields.join(', ')
                        : 'None'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[#8B8B94] whitespace-nowrap">
                    {meta.documentation.requiredPermissions[0] || 'Standard User Key'}
                  </td>
                  <td className="py-2.5 px-3 text-[#8B8B94] max-w-xs">
                    <div className="line-clamp-2" title={meta.documentation.reconciliationCaveats.join(' ')}>
                      {meta.documentation.reconciliationCaveats[0] || 'Direct match'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credential Configuration Modal */}
      {activeConfigMeta && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
        >
          <div className="bg-[#151518] border border-[#29292F] rounded-lg max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#29292F]">
              <div className="flex items-center gap-2 font-mono font-semibold text-[#EDEDEF]">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Configure {activeConfigMeta.displayName}</span>
              </div>
              <button
                onClick={() => setActiveConfigMeta(null)}
                className="text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#8B8B94] font-sans leading-relaxed">
              Enter authorized credentials to test connection and run live usage synchronization. Credentials are transmitted via encrypted server proxy routes and never logged.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTestConnection(activeConfigMeta);
              }}
              className="space-y-3 font-mono"
            >
              {activeConfigMeta.credentialFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <label className="text-[#EDEDEF] block text-[11px] font-semibold">
                    {field.label} {field.required && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    type={field.type}
                    value={credentials[field.key] || ''}
                    placeholder={field.placeholder}
                    required={field.required}
                    onChange={(e) =>
                      setCredentials({ ...credentials, [field.key]: e.target.value })
                    }
                    className="w-full bg-[#101012] border border-[#29292F] text-[#EDEDEF] rounded px-3 py-1.5 text-xs focus:outline-none focus:border-[#7C6FF7] font-mono"
                  />
                  <span className="text-[10px] text-[#5E5E68] block">{field.description}</span>
                </div>
              ))}

              {testResult?.id === activeConfigMeta.id && (
                <div
                  className={`p-2.5 rounded text-[11px] border ${
                    testResult.res.ok
                      ? 'bg-[#101915] border-emerald-900/60 text-emerald-300'
                      : 'bg-[#1E1214] border-rose-900/60 text-rose-300'
                  }`}
                >
                  {testResult.res.message}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#29292F]">
                <button
                  type="button"
                  onClick={() => setActiveConfigMeta(null)}
                  className="px-3 py-1.5 text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testingConnectionId === activeConfigMeta.id}
                  className="px-4 py-1.5 bg-[#7C6FF7] hover:bg-[#6D5FE6] text-white font-medium rounded transition-colors disabled:opacity-50"
                >
                  {testingConnectionId === activeConfigMeta.id
                    ? 'Testing...'
                    : 'Save & Test Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
