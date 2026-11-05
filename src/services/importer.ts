import { CostBasis, EventStatus, ImportPreviewResult, ProviderKey, UsageEvent } from '../types';
import { calculateDeterministicCost, DEFAULT_PRICING_CATALOG } from './pricing';
import { parseCurrencyFromText } from './currency';

/**
 * Intelligent column aliasing map
 */
export const COLUMN_ALIAS_MAP: Record<string, keyof UsageEvent> = {
  // Input tokens
  input_tokens: 'inputTokens',
  prompt_tokens: 'inputTokens',
  tokens_in: 'inputTokens',
  prompt_token_count: 'inputTokens',
  inputtokens: 'inputTokens',
  input: 'inputTokens',

  // Output tokens
  output_tokens: 'outputTokens',
  completion_tokens: 'outputTokens',
  tokens_out: 'outputTokens',
  candidates_token_count: 'outputTokens',
  outputtokens: 'outputTokens',
  output: 'outputTokens',

  // Cached tokens
  cached_input_tokens: 'cachedInputTokens',
  cached_prompt_tokens: 'cachedInputTokens',
  cache_read_input_tokens: 'cachedInputTokens',
  cached_tokens: 'cachedInputTokens',
  cachedinputtokens: 'cachedInputTokens',

  // Reasoning tokens
  reasoning_tokens: 'reasoningTokens',
  thinking_tokens: 'reasoningTokens',
  reasoningtokens: 'reasoningTokens',
  thinkingtokens: 'reasoningTokens',

  // Model & Provider
  model: 'model',
  model_name: 'model',
  engine: 'model',
  provider: 'provider',
  vendor: 'provider',

  // Project & Task
  project: 'project',
  project_name: 'project',
  app: 'project',
  workspace: 'project',
  task: 'task',
  task_name: 'task',
  workflow: 'task',
  endpoint: 'task',

  // Cost & Currency
  cost: 'reportedCost',
  cost_usd: 'reportedCost',
  reported_cost: 'reportedCost',
  reported_cost_usd: 'reportedCost',
  estimated_cost: 'estimatedCost',
  estimated_cost_usd: 'estimatedCost',
  cost_basis: 'costBasis',
  total_cost: 'reportedCost',
  price: 'reportedCost',
  currency: 'reportedCurrency',
  reported_currency: 'reportedCurrency',

  // Timestamps
  timestamp: 'timestamp',
  created_at: 'timestamp',
  time: 'timestamp',
  date: 'timestamp',
  datetime: 'timestamp',

  // Execution & Latency
  duration_ms: 'durationMs',
  latency_ms: 'durationMs',
  duration: 'durationMs',
  latency: 'durationMs',
  status: 'status',
  status_code: 'status',
  retries: 'retryCount',
  retry_count: 'retryCount',
  requests: 'requestCount',
  request_count: 'requestCount',
  source: 'source',
  id: 'id',
  event_id: 'id',
};

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Simple CSV parser handling quotes, commas, and escaped quotes.
 */
export function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 2) return [];

  // Parse header
  const headers = splitCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvRow(lines[i]);
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!DANGEROUS_KEYS.has(header)) {
        rowObj[header] = values[index] !== undefined ? values[index].trim() : '';
      }
    });
    rows.push(rowObj);
  }

  return rows;
}

function splitCsvRow(rowText: string): string[] {
  const result: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      if (inQuotes && rowText[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentVal);
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal);
  return result;
}

/**
 * Generates a stable fingerprint for an event to prevent duplicate ingestion.
 */
export function generateEventFingerprint(raw: Partial<UsageEvent>): string {
  const parts = [
    raw.id || '',
    raw.timestamp || '',
    raw.provider || '',
    raw.model || '',
    raw.project || '',
    raw.task || '',
    raw.source || '',
    raw.inputTokens ?? '',
    raw.outputTokens ?? '',
    raw.cachedInputTokens ?? '',
    raw.durationMs ?? '',
    raw.metadata?.prompt_hash || '',
  ];
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

/**
 * Parses raw file content (CSV or JSON) and produces an ImportPreviewResult.
 * Safely strips UTF-8 BOM, sanitizes prototype pollution, and validates row contents.
 */
export function parseAndPreviewFile(
  content: string,
  fileName: string,
  fileSize: number,
  existingEvents: UsageEvent[],
  catalog: import('../types').PricingRate[] = DEFAULT_PRICING_CATALOG
): ImportPreviewResult {
  // Strip UTF-8 Byte Order Mark (BOM) if present
  const cleanContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const isJson = fileName.toLowerCase().endsWith('.json') || cleanContent.trim().startsWith('[') || cleanContent.trim().startsWith('{');
  const batchId = `import_${Date.now()}`;
  const existingFingerprints = new Set<string>();
  const existingIds = new Set<string>();
  for (const e of existingEvents) {
    if (e.fingerprint) existingFingerprints.add(e.fingerprint);
    if (e.id) existingIds.add(String(e.id));
  }

  let rawObjects: Array<Record<string, any>> = [];

  if (isJson) {
    try {
      const parsed = JSON.parse(cleanContent);
      if (Array.isArray(parsed)) {
        rawObjects = parsed;
      } else if (parsed.events && Array.isArray(parsed.events)) {
        rawObjects = parsed.events;
      } else if (parsed.data && Array.isArray(parsed.data)) {
        rawObjects = parsed.data;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        rawObjects = parsed.items;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        rawObjects = parsed.results;
      } else if (parsed.records && Array.isArray(parsed.records)) {
        rawObjects = parsed.records;
      } else {
        rawObjects = [parsed];
      }
      // Filter non-object items
      rawObjects = rawObjects.filter((r) => r && typeof r === 'object');
    } catch (e: any) {
      return {
        fileName,
        fileSize,
        fileType: 'json',
        rawRowCount: 0,
        detectedColumns: [],
        columnMapping: {},
        validRows: [],
        invalidRows: [{ rowNumber: 1, raw: {}, reason: `Malformed JSON: ${e.message}` }],
        duplicates: [],
        warnings: ['Unable to parse JSON file structure.'],
      };
    }
  } else {
    rawObjects = parseCsvRows(cleanContent);
  }

  if (rawObjects.length === 0) {
    return {
      fileName,
      fileSize,
      fileType: isJson ? 'json' : 'csv',
      rawRowCount: 0,
      detectedColumns: [],
      columnMapping: {},
      validRows: [],
      invalidRows: [{ rowNumber: 1, raw: {}, reason: 'File contains no data rows.' }],
      duplicates: [],
      warnings: ['Empty file or missing headers.'],
    };
  }

  // Detect columns across all rows to support sparse JSON records
  const detectedKeys = new Set<string>();
  for (const obj of rawObjects) {
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        detectedKeys.add(k);
      }
    }
  }
  const detectedColumns = Array.from(detectedKeys);
  const columnMapping: Record<string, keyof UsageEvent | 'ignore'> = {};
  for (const col of detectedColumns) {
    const normalized = col.toLowerCase().replace(/[\s\-_]/g, '_');
    if (COLUMN_ALIAS_MAP[normalized]) {
      columnMapping[col] = COLUMN_ALIAS_MAP[normalized];
    } else {
      columnMapping[col] = 'ignore';
    }
  }

  const validRows: UsageEvent[] = [];
  const invalidRows: Array<{ rowNumber: number; raw: Record<string, any>; reason: string }> = [];
  const duplicates: UsageEvent[] = [];
  const warnings: string[] = [];

  const seenInBatch = new Set<string>();
  const seenIdsInBatch = new Set<string>();

  rawObjects.forEach((raw, idx) => {
    const rowNum = idx + 2; // account for header line in CSV
    const mapped: Partial<UsageEvent> = {
      importBatchId: batchId,
      metadata: {},
      isSample: false,
    };

    // Extract mapped fields
    for (const [col, targetField] of Object.entries(columnMapping)) {
      if (targetField !== 'ignore') {
        const val = raw[col];
        if (val !== undefined && val !== null && val !== '') {
          (mapped as any)[targetField] = val;
        }
      }
    }

    // Capture unmapped fields in metadata (safeguarded against prototype pollution)
    for (const [col, targetField] of Object.entries(columnMapping)) {
      if (targetField === 'ignore' && raw[col] !== undefined && raw[col] !== '' && !DANGEROUS_KEYS.has(col)) {
        mapped.metadata![col] = raw[col];
      }
    }

    const cleanInt = (v: any): number => {
      const s = String(v ?? '').replace(/,/g, '').trim();
      return parseInt(s, 10);
    };

    // Required fields & validation
    // 1. Model
    const model = String(mapped.model || raw.model || raw.model_name || '').trim();
    if (!model) {
      invalidRows.push({ rowNumber: rowNum, raw, reason: 'Missing required field: model' });
      return;
    }

    // 2. Input & Output tokens
    const rawIn = mapped.inputTokens !== undefined ? mapped.inputTokens : raw.prompt_tokens ?? raw.input_tokens;
    const rawOut = mapped.outputTokens !== undefined ? mapped.outputTokens : raw.completion_tokens ?? raw.output_tokens;

    if (rawIn === undefined || rawIn === null || String(rawIn).trim() === '') {
      invalidRows.push({ rowNumber: rowNum, raw, reason: 'Missing required field: inputTokens' });
      return;
    }
    if (rawOut === undefined || rawOut === null || String(rawOut).trim() === '') {
      invalidRows.push({ rowNumber: rowNum, raw, reason: 'Missing required field: outputTokens' });
      return;
    }

    const inputTokens = cleanInt(rawIn);
    const outputTokens = cleanInt(rawOut);
    if (isNaN(inputTokens) || inputTokens < 0) {
      invalidRows.push({ rowNumber: rowNum, raw, reason: 'Invalid or negative input token count' });
      return;
    }
    if (isNaN(outputTokens) || outputTokens < 0) {
      invalidRows.push({ rowNumber: rowNum, raw, reason: 'Invalid or negative output token count' });
      return;
    }

    // 3. Timestamp (Must be present and valid date, NEVER silently invented)
    const timestampStr = String(mapped.timestamp || raw.created_at || raw.timestamp || '').trim();
    if (!timestampStr) {
      invalidRows.push({ rowNumber: rowNum, raw, reason: 'Missing required field: timestamp' });
      return;
    }
    const parsedDate = new Date(timestampStr);
    if (isNaN(parsedDate.getTime())) {
      invalidRows.push({ rowNumber: rowNum, raw, reason: `Invalid date format: "${timestampStr}"` });
      return;
    }

    // 4. Provider detection
    let provider: ProviderKey = 'other';
    const rawProv = String(mapped.provider || raw.provider || '').toLowerCase();
    if (rawProv.includes('openai') || model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) {
      provider = 'openai';
    } else if (rawProv.includes('anthropic') || model.includes('claude')) {
      provider = 'anthropic';
    } else if (rawProv.includes('google') || rawProv.includes('vertex') || model.includes('gemini')) {
      provider = 'google';
    } else if (rawProv.includes('deepseek')) {
      provider = 'deepseek';
    } else if (rawProv.includes('meta') || model.includes('llama')) {
      provider = 'meta';
    } else if (rawProv.includes('mistral')) {
      provider = 'mistral';
    }

    // 5. Cached and Reasoning Tokens
    let cachedTokens: number | null = null;
    const rawCached = mapped.cachedInputTokens ?? raw.cached_tokens ?? raw.cached_prompt_tokens ?? raw.cached_input_tokens;
    if (rawCached !== undefined && rawCached !== null && String(rawCached).trim() !== '') {
      const parsedCached = cleanInt(rawCached);
      if (!isNaN(parsedCached) && parsedCached >= 0) {
        if (parsedCached > inputTokens) {
          warnings.push(`Row ${rowNum}: cached tokens (${parsedCached}) exceeded input tokens (${inputTokens}); clamped to input tokens.`);
          cachedTokens = inputTokens;
        } else {
          cachedTokens = parsedCached;
        }
      } else if (!isNaN(parsedCached) && parsedCached < 0) {
        warnings.push(`Row ${rowNum}: negative cached tokens (${parsedCached}) ignored.`);
      }
    }

    let reasoningTokens: number | null = null;
    const rawReasoning = mapped.reasoningTokens ?? raw.reasoningTokens ?? raw.reasoning_tokens ?? raw.thinking_tokens;
    if (rawReasoning !== undefined && rawReasoning !== null && String(rawReasoning).trim() !== '') {
      const parsedReasoning = cleanInt(rawReasoning);
      if (!isNaN(parsedReasoning) && parsedReasoning >= 0) {
        reasoningTokens = parsedReasoning;
      }
    }

    // 6. Currency and Cost Parsing: Robust text and symbol parsing
    let currencyStr = String(mapped.reportedCurrency || raw.currency || raw.reported_currency || '').trim().toUpperCase();

    let reportedCost: number | null = null;
    let estimatedCost: number | null = null;
    let costBasis: CostBasis = 'unknown';

    const rawCostField = mapped.reportedCost !== undefined ? mapped.reportedCost : raw.cost_usd ?? raw.cost ?? raw.reported_cost;
    if (rawCostField !== undefined && rawCostField !== null && String(rawCostField).trim() !== '') {
      const parsedRes = parseCurrencyFromText(rawCostField);
      if (parsedRes.currency && !currencyStr) {
        currencyStr = parsedRes.currency;
      }
      if (parsedRes.amount !== null && !isNaN(parsedRes.amount) && parsedRes.amount >= 0) {
        reportedCost = Number(parsedRes.amount.toFixed(6));
        costBasis = 'reported';
      } else if (parsedRes.amount !== null && !isNaN(parsedRes.amount) && parsedRes.amount < 0) {
        warnings.push(`Row ${rowNum}: negative reported cost (${parsedRes.amount}) rejected; treating cost as unknown.`);
      }
    }

    if (!currencyStr) {
      currencyStr = 'USD';
    }

    // Check if source explicit estimated cost is present
    const rawEstField = mapped.estimatedCost !== undefined ? mapped.estimatedCost : raw.estimated_cost ?? raw.estimated_cost_usd;
    if (costBasis !== 'reported' && rawEstField !== undefined && rawEstField !== null && String(rawEstField).trim() !== '') {
      const parsedEst = parseCurrencyFromText(rawEstField);
      if (parsedEst.amount !== null && !isNaN(parsedEst.amount) && parsedEst.amount >= 0) {
        estimatedCost = Number(parsedEst.amount.toFixed(6));
        costBasis = 'estimated';
      }
    }

    if (costBasis === 'unknown') {
      const calc = calculateDeterministicCost(
        {
          provider,
          model,
          inputTokens,
          outputTokens,
          cachedInputTokens: cachedTokens,
          reasoningTokens,
        },
        catalog
      );
      estimatedCost = calc.costUsd;
      costBasis = calc.costBasis;
    }

    // 7. Status
    let status: EventStatus = 'success';
    const rawStatus = String(mapped.status || raw.status || 'success').toLowerCase();
    if (rawStatus.includes('fail') || rawStatus.includes('error') || rawStatus === '500') {
      status = 'failed';
    } else if (rawStatus.includes('rate_limit') || rawStatus.includes('429')) {
      status = 'rate_limited';
    } else if (rawStatus.includes('cancel')) {
      status = 'cancelled';
    }

    const sourceExplicitId = mapped.id || raw.id || raw.event_id;
    const eventId = String(sourceExplicitId || `event_${Date.now()}_${idx}`);
    const durationMs = mapped.durationMs !== undefined && mapped.durationMs !== null && String(mapped.durationMs).trim() !== ''
      ? cleanInt(mapped.durationMs)
      : null;
    const requestCount = cleanInt(mapped.requestCount ?? 1) || 1;
    const retryCount = cleanInt(mapped.retryCount ?? 0) || 0;

    const fingerprint = generateEventFingerprint({
      id: sourceExplicitId ? String(sourceExplicitId) : '',
      timestamp: parsedDate.toISOString(),
      provider,
      model,
      project: String(mapped.project || raw.project || 'General'),
      task: String(mapped.task || raw.task || 'default'),
      source: String(mapped.source || raw.source || 'import'),
      inputTokens,
      outputTokens,
      cachedInputTokens: cachedTokens,
      durationMs,
    });

    // Deduplication check: stable event ID if available, plus deterministic fingerprint
    const isDuplicateId = Boolean(
      sourceExplicitId && (existingIds.has(String(sourceExplicitId)) || seenIdsInBatch.has(String(sourceExplicitId)))
    );
    const isDuplicateFingerprint = existingFingerprints.has(fingerprint) || seenInBatch.has(fingerprint);

    if (isDuplicateId || isDuplicateFingerprint) {
      const dupEvent: UsageEvent = {
        id: eventId,
        timestamp: parsedDate.toISOString(),
        provider,
        model,
        project: String(mapped.project || raw.project || 'General'),
        task: String(mapped.task || raw.task || 'default'),
        source: String(mapped.source || raw.source || 'import'),
        inputTokens,
        outputTokens,
        cachedInputTokens: cachedTokens,
        reasoningTokens,
        requestCount,
        retryCount,
        status,
        reportedCost,
        estimatedCost,
        reportedCurrency: currencyStr,
        costBasis,
        durationMs,
        metadata: mapped.metadata || {},
        importBatchId: batchId,
        fingerprint,
        qualityScore: null,
        isSample: false,
      };
      duplicates.push(dupEvent);
      return;
    }

    seenInBatch.add(fingerprint);
    if (sourceExplicitId) {
      seenIdsInBatch.add(String(sourceExplicitId));
    }

    const validEvent: UsageEvent = {
      id: eventId,
      timestamp: parsedDate.toISOString(),
      provider,
      model,
      project: String(mapped.project || raw.project || 'General'),
      task: String(mapped.task || raw.task || 'default'),
      source: String(mapped.source || raw.source || 'import'),
      inputTokens,
      outputTokens,
      cachedInputTokens: cachedTokens,
      reasoningTokens,
      requestCount,
      retryCount,
      status,
      reportedCost,
      estimatedCost,
      reportedCurrency: currencyStr,
      costBasis,
      durationMs,
      metadata: mapped.metadata || {},
      importBatchId: batchId,
      fingerprint,
      qualityScore: null,
      isSample: false,
    };

    validRows.push(validEvent);
  });

  return {
    fileName,
    fileSize,
    fileType: isJson ? 'json' : 'csv',
    rawRowCount: rawObjects.length,
    detectedColumns,
    columnMapping,
    validRows,
    invalidRows,
    duplicates,
    warnings,
  };
}

/**
 * Generates sample CSV template for download
 */
export function generateSampleCsvTemplate(): string {
  return `timestamp,provider,model,project,task,source,prompt_tokens,completion_tokens,cached_tokens,cost_usd,duration_ms,status,retry_count
2026-10-18T14:32:00Z,anthropic,claude-3-5-sonnet,Web Platform,component_refactor,cursor,8400,620,0,,1450,success,0
2026-10-18T15:10:15Z,openai,gpt-4o,Web Platform,generate_unit_tests,aider,12500,1400,6000,0.0385,2100,success,0
2026-10-18T16:04:30Z,google,gemini-1.5-flash,Docs Search,query_faq,api_gateway,34000,380,32000,,420,success,0
2026-10-18T17:20:00Z,openai,o1-preview,Algorithm Lab,matrix_solver,manual,19200,3400,,0.4920,18400,success,1
2026-10-18T18:05:12Z,deepseek,deepseek-coder,Backend Refactor,type_generation,cli,6800,950,5000,,980,success,0`;
}

/**
 * Generates sample JSON template for download
 */
export function generateSampleJsonTemplate(): string {
  const example = [
    {
      id: "evt_usr_001",
      timestamp: "2026-10-18T14:32:00Z",
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      project: "Web Platform",
      task: "component_refactor",
      source: "cursor",
      inputTokens: 8400,
      outputTokens: 620,
      cachedInputTokens: 0,
      reportedCost: 0.0345,
      reportedCurrency: "USD",
      durationMs: 1450,
      status: "success",
      retryCount: 0,
      metadata: { gitBranch: "main" }
    },
    {
      id: "evt_usr_002",
      timestamp: "2026-10-18T15:10:15Z",
      provider: "openai",
      model: "gpt-4o",
      project: "Algorithm Lab",
      task: "solver_review",
      source: "api_gateway",
      inputTokens: 14200,
      outputTokens: 1850,
      cachedInputTokens: 10000,
      reportedCost: null,
      reportedCurrency: "USD",
      durationMs: 2300,
      status: "success",
      retryCount: 0
    }
  ];
  return JSON.stringify(example, null, 2);
}
