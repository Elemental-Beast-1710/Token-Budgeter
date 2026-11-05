import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Download,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Layers,
  Server,
} from 'lucide-react';
import { ImportPreviewResult, UsageEvent } from '../../types';
import {
  generateSampleCsvTemplate,
  generateSampleJsonTemplate,
  parseAndPreviewFile,
} from '../../services/importer';
import { downloadFile } from '../../services/export';
import { ProviderIntegrationsPanel } from '../ProviderIntegrationsPanel';

interface ImportViewProps {
  existingEvents: UsageEvent[];
  onCommitImport: (validEvents: UsageEvent[], batchRecord?: import('../../types').ImportBatchRecord) => Promise<void> | void;
  onNavigateTab: (tab: any) => void;
  pricingRates?: import('../../types').PricingRate[];
}

export const ImportView: React.FC<ImportViewProps> = ({
  existingEvents,
  onCommitImport,
  onNavigateTab,
  pricingRates,
}) => {
  const [activeMode, setActiveMode] = useState<'files' | 'providers'>('files');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [importCompletedSummary, setImportCompletedSummary] = useState<{
    imported: number;
    duplicates: number;
    rejected: number;
    batchId?: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = (file: File) => {
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || '');
      const preview = parseAndPreviewFile(
        content,
        file.name,
        file.size,
        existingEvents,
        pricingRates && pricingRates.length > 0 ? pricingRates : undefined
      );
      setPreviewResult(preview);
      setImportCompletedSummary(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleCommit = async () => {
    if (!previewResult || previewResult.validRows.length === 0) return;
    setIsCommitting(true);
    setImportError(null);

    const batchId = previewResult.validRows[0]?.importBatchId || `import_${Date.now()}`;
    const batchRecord: import('../../types').ImportBatchRecord = {
      id: batchId,
      fileName: previewResult.fileName,
      fileType: previewResult.fileType,
      fileSize: previewResult.fileSize,
      importedAt: new Date().toISOString(),
      validCount: previewResult.validRows.length,
      duplicateCount: previewResult.duplicates.length,
      rejectedCount: previewResult.invalidRows.length,
      totalTokens: previewResult.validRows.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0),
      totalCostUsd: previewResult.validRows.reduce((sum, r) => sum + (r.reportedCost || r.estimatedCost || 0), 0),
      isSample: false,
    };

    try {
      await onCommitImport(previewResult.validRows, batchRecord);
      setImportCompletedSummary({
        imported: previewResult.validRows.length,
        duplicates: previewResult.duplicates.length,
        rejected: previewResult.invalidRows.length,
        batchId,
      });
      setPreviewResult(null);
    } catch (err: any) {
      setImportError(err?.message || 'Storage error occurred during batch ingestion.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header with Ingestion Mode Tabs */}
      <div className="bg-[#151518] border border-[#29292F] p-4 sm:p-5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-[#EDEDEF] flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#7C6FF7]" />
            <span>Usage Ingestion & Provider Integrations</span>
          </h2>
          <p className="text-xs text-[#8B8B94] mt-0.5">
            Ingest usage telemetry via first-class CSV/JSON exports or authorized live API sync adapters.
          </p>
        </div>

        {/* Ingestion Mode Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#101012] rounded-md border border-[#29292F] text-xs font-mono">
          <button
            onClick={() => setActiveMode('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeMode === 'files'
                ? 'bg-[#1C1C20] text-[#EDEDEF] font-semibold border border-[#29292F] shadow-xs'
                : 'text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#151518]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>File Ingestion (CSV / JSON)</span>
          </button>
          <button
            onClick={() => setActiveMode('providers')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeMode === 'providers'
                ? 'bg-[#1C1C20] text-[#EDEDEF] font-semibold border border-[#29292F] shadow-xs'
                : 'text-[#8B8B94] hover:text-[#EDEDEF] hover:bg-[#151518]'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Provider Integrations</span>
            <span className="text-[10px] bg-[#7C6FF7]/15 text-[#7C6FF7] border border-[#7C6FF7]/30 px-1.5 rounded">
              4
            </span>
          </button>
        </div>
      </div>

      {activeMode === 'providers' ? (
        <ProviderIntegrationsPanel
          existingEvents={existingEvents}
          pricingRates={pricingRates}
          onCommitImport={onCommitImport}
          onNavigateTab={onNavigateTab}
          onSwitchToFileImport={() => setActiveMode('files')}
        />
      ) : (
        <>
          {/* File Template Download Strip */}
          <div className="flex items-center justify-end gap-2 -mt-2">
            <button
              onClick={() =>
                downloadFile(generateSampleCsvTemplate(), 'tokenbudgeter-template.csv', 'text/csv')
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8B8B94] hover:text-[#EDEDEF] bg-[#151518] hover:bg-[#1C1C20] rounded border border-[#29292F] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV Template</span>
            </button>
            <button
              onClick={() =>
                downloadFile(generateSampleJsonTemplate(), 'tokenbudgeter-example.json', 'application/json')
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8B8B94] hover:text-[#EDEDEF] bg-[#151518] hover:bg-[#1C1C20] rounded border border-[#29292F] transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#7C6FF7]" />
              <span>JSON Example</span>
            </button>
          </div>

      {/* Storage Error / Quota Exceeded Alert */}
      {importError && (
        <div className="bg-[#1E1214] border border-rose-900/60 rounded-lg p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-400 font-semibold">
            <ShieldAlert className="w-4 h-4" />
            <span>Persistence & Ingestion Error</span>
          </div>
          <p className="text-[#EDEDEF] font-mono text-[11px] leading-relaxed">
            {importError}
          </p>
          <div className="text-[11px] text-[#8B8B94]">
            Action: If browser storage quota is exhausted, navigate to Settings to export a full backup and delete old import batches to free space.
          </div>
        </div>
      )}

      {/* Completion Summary Alert */}
      {importCompletedSummary && (
        <div className="bg-[#101915] border border-emerald-900/60 rounded-lg p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Batch Ingestion Completed Successfully</span>
          </div>
          <div className="grid grid-cols-3 gap-3 font-mono text-[#EDEDEF] pt-1">
            <div>
              <span className="text-[#8B8B94] block text-[10px]">Imported Records</span>
              <span className="text-[#EDEDEF] font-bold tabular-nums">{importCompletedSummary.imported}</span>
            </div>
            <div>
              <span className="text-[#8B8B94] block text-[10px]">Deduplicated</span>
              <span className="text-[#8B8B94] font-bold tabular-nums">{importCompletedSummary.duplicates}</span>
            </div>
            <div>
              <span className="text-[#8B8B94] block text-[10px]">Rejected / Malformed</span>
              <span className="text-rose-400 font-bold tabular-nums">{importCompletedSummary.rejected}</span>
            </div>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('overview')}
              className="text-[#7C6FF7] hover:text-[#9B90FF] font-medium flex items-center gap-1"
            >
              <span>Return to Overview Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* File Dropzone Area */}
      {!previewResult && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-[#7C6FF7] bg-[#7C6FF7]/10'
              : 'border-[#29292F] hover:border-[#3E3E48] bg-[#151518]/60 hover:bg-[#151518]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
          />

          <div className="space-y-3 max-w-sm mx-auto">
            <div className="w-10 h-10 rounded-md bg-[#101012] border border-[#29292F] flex items-center justify-center text-[#7C6FF7] mx-auto">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#EDEDEF]">
                Drag and drop your usage logs or click to browse
              </h3>
              <p className="text-xs text-[#8B8B94] mt-1 leading-relaxed">
                Supports CSV spreadsheets and JSON files up to 20MB. Automatic field detection for prompt_tokens, cost, and models.
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#5E5E68]">
              Zero cloud upload · Processed locally inside your browser
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Stage */}
      {previewResult && (
        <div className="space-y-5">
          {/* File Meta Ribbon */}
          <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-[#EDEDEF] font-mono">{previewResult.fileName}</span>
              <div className="text-[#8B8B94] font-mono text-[11px]">
                {(previewResult.fileSize / 1024).toFixed(1)} KB · {previewResult.rawRowCount} rows parsed
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewResult(null)}
                className="px-3 py-1.5 text-xs text-[#8B8B94] hover:text-[#EDEDEF] transition-colors"
              >
                Discard & Pick Another
              </button>
              <button
                disabled={previewResult.validRows.length === 0 || isCommitting}
                onClick={handleCommit}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#7C6FF7] hover:bg-[#6D5FE6] rounded disabled:opacity-40 transition-colors shadow-xs flex items-center gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Committing Transaction...</span>
                  </>
                ) : (
                  <span>Commit Import ({previewResult.validRows.length} valid events)</span>
                )}
              </button>
            </div>
          </div>

          {/* Validation Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-[#151518] border border-[#29292F] p-3 rounded-lg">
              <span className="text-[#8B8B94] block text-[10px]">Valid Events</span>
              <span className="text-emerald-400 font-bold text-lg tabular-nums">
                {previewResult.validRows.length}
              </span>
            </div>
            <div className="bg-[#151518] border border-[#29292F] p-3 rounded-lg">
              <span className="text-[#8B8B94] block text-[10px]">Detected Duplicates</span>
              <span className="text-[#EDEDEF] font-bold text-lg tabular-nums">
                {previewResult.duplicates.length}
              </span>
            </div>
            <div className="bg-[#151518] border border-[#29292F] p-3 rounded-lg">
              <span className="text-[#8B8B94] block text-[10px]">Invalid Rows</span>
              <span className="text-rose-400 font-bold text-lg tabular-nums">
                {previewResult.invalidRows.length}
              </span>
            </div>
            <div className="bg-[#151518] border border-[#29292F] p-3 rounded-lg">
              <span className="text-[#8B8B94] block text-[10px]">Detected Columns</span>
              <span className="text-[#7C6FF7] font-bold text-lg tabular-nums">
                {previewResult.detectedColumns.length}
              </span>
            </div>
          </div>

          {/* Column Aliasing Mapping Table */}
          <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-[#EDEDEF]">Detected Column Mappings</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {Object.entries(previewResult.columnMapping).map(([col, target]) => (
                <div
                  key={col}
                  className="bg-[#101012] p-2 rounded border border-[#29292F] flex items-center justify-between"
                >
                  <span className="text-[#8B8B94] truncate max-w-[50%]">{col}</span>
                  <span className="text-[#5E5E68]">→</span>
                  <span className={target === 'ignore' ? 'text-[#5E5E68]' : 'text-emerald-400 font-semibold'}>
                    {target}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Invalid Rows Review */}
          {previewResult.invalidRows.length > 0 && (
            <div className="bg-[#1E1214] border border-rose-900/50 rounded-lg p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-rose-400 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                <span>Rejected Rows Review ({previewResult.invalidRows.length})</span>
              </div>
              <div className="divide-y divide-rose-900/30 font-mono text-[11px] max-h-48 overflow-y-auto">
                {previewResult.invalidRows.map((inv, i) => (
                  <div key={i} className="py-2 flex items-center justify-between gap-4">
                    <span className="text-[#8B8B94]">Row {inv.rowNumber}</span>
                    <span className="text-rose-300">{inv.reason}</span>
                    <span className="text-[#5E5E68] truncate max-w-xs">{JSON.stringify(inv.raw)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid Sample Preview Rows */}
          {previewResult.validRows.length > 0 && (
            <div className="bg-[#151518] border border-[#29292F] rounded-lg p-4 space-y-3">
              <h4 className="text-xs font-semibold text-[#EDEDEF]">
                Valid Row Preview (First 5 records)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#101012] text-[#8B8B94] border-b border-[#29292F]">
                    <tr>
                      <th className="p-2">Model</th>
                      <th className="p-2">Project · Task</th>
                      <th className="p-2 text-right">In Tokens</th>
                      <th className="p-2 text-right">Out Tokens</th>
                      <th className="p-2 text-right">Cost ($)</th>
                      <th className="p-2">Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222226] text-[11px]">
                    {previewResult.validRows.slice(0, 5).map((row) => (
                      <tr key={row.id} className="hover:bg-[#1C1C20]/40">
                        <td className="p-2 text-[#7C6FF7]">{row.model}</td>
                        <td className="p-2 text-[#EDEDEF] font-sans">
                          {row.project} · {row.task}
                        </td>
                        <td className="p-2 text-right tabular-nums text-[#8B8B94]">{row.inputTokens.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums text-[#8B8B94]">{row.outputTokens.toLocaleString()}</td>
                        <td className="p-2 text-right tabular-nums font-semibold text-[#EDEDEF]">
                          {(row.reportedCost ?? row.estimatedCost) !== null && (row.reportedCost ?? row.estimatedCost) !== undefined
                            ? '$' + (row.reportedCost ?? row.estimatedCost)!.toFixed(4)
                            : 'N/A'}
                        </td>
                        <td className="p-2 text-[#8B8B94]">{row.costBasis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Provider Adapter Roadmap & Architecture Callout */}
      <div className="bg-[#151518] border border-[#29292F] rounded-lg p-5 space-y-3">
        <h3 className="text-xs font-semibold text-[#EDEDEF] uppercase tracking-wider font-mono">
          Provider Adapter Roadmap & Direct Integrations
        </h3>
        <p className="text-xs text-[#8B8B94] leading-relaxed">
          Per TokenBudgeter core architecture principles: universal live monitoring does not exist because individual vendor APIs do not expose every internal tool's usage metrics. Future official adapters will map verified vendor payloads:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 font-mono">
          <div className="p-3 bg-[#101012] rounded border border-[#29292F] space-y-1">
            <span className="text-[#EDEDEF] font-semibold block">OpenAI Usage Ingestion</span>
            <span className="text-[11px] text-emerald-400">Supported via CSV/JSON Export</span>
          </div>
          <div className="p-3 bg-[#101012] rounded border border-[#29292F] space-y-1">
            <span className="text-[#EDEDEF] font-semibold block">Anthropic Console Export</span>
            <span className="text-[11px] text-emerald-400">Supported via CSV/JSON Export</span>
          </div>
          <div className="p-3 bg-[#101012] rounded border border-[#29292F] space-y-1">
            <span className="text-[#EDEDEF] font-semibold block">Cursor / Copilot Telemetry</span>
            <span className="text-[11px] text-[#7C6FF7]">Supported via Canonical JSON Spec</span>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
