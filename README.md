# TokenBudgeter

> **Open-source AI usage analytics, cost optimization, and decision-support platform.**  
> *Measure first, explain second, recommend third. Never invent usage data or claim savings that have not been demonstrated.*

TokenBudgeter helps developers, AI coding tool users, engineering teams, and productivity power users understand where their AI budget goes, how much each model and workflow costs, which tasks exhibit runaway retry loops or context bloat, and what optimizations can be safely deployed without degrading output quality.

---

## Key Capabilities

- **Multi-Source Ingestion Pipeline**: Ingest CSV spreadsheets and JSON files exported from Cursor, Copilot, Aider, API proxies, and custom tools with automated column aliasing and duplicate prevention.
- **Dual-Track Deterministic Cost Engine**: Clearly delineates between *Reported Cost* (exact figures stated by source records) and *Estimated Cost* (calculated deterministically against verified rate cards with tier, cached input, and reasoning token rules).
- **Optimization Lab (Inefficiency Detector)**: Rule-based detection of duplicate query submissions, runaway retry loops, extreme context-to-output ratios, un-cached repetitive system prompts, and high-cost model misallocations.
- **On-Demand Gemini Intelligence**: Server-side proxy (`/api/gemini/explain-finding`) powered by `gemini-3.8-flash` to synthesize plain-language architectural explanations of verified findings without hallucinating numbers or exposing credentials.
- **Empirical A/B Experiments Lab**: Rigorously compare baseline workflows against experimental setups with cost, latency, success rate, and quality score tracking.
- **Deterministic Savings Simulator**: Simulate hypothetical input compression, retry reduction, prompt caching adoption, and model down-shifting using transparent formulas and explicit limitations.
- **Executive Reports & Printable HTML**: Generate weekly and monthly audit reports with printable layouts and CSV/JSON export.
- **Local-First & Safe**: Operates directly in the browser using IndexedDB with complete JSON export/import and CSV formula injection protection.

---

## Canonical Usage Schema

Every ingested event is normalized into TokenBudgeter's canonical schema:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique event identifier or stable fingerprint |
| `timestamp` | `string` (ISO-8601) | Timestamp of request execution |
| `provider` | `string` | Normalized provider (`openai`, `anthropic`, `google`, `deepseek`, etc.) |
| `model` | `string` | Model identifier (`claude-3-5-sonnet`, `gpt-4o`, `gemini-1.5-pro`, etc.) |
| `project` | `string` | Assigned project or application budget group |
| `task` | `string` | Specific task or workflow identifier |
| `source` | `string` | Tool origin (`cursor`, `copilot`, `aider`, `api_gateway`, `cli`) |
| `inputTokens` | `number` | Prompt input token count |
| `outputTokens` | `number` | Generated output token count |
| `cachedInputTokens` | `number \| null` | Tokens served from prompt cache |
| `reasoningTokens` | `number \| null` | Dedicated thinking tokens (o1, deepseek-r1, etc.) |
| `requestCount` | `number` | Total requests triggered |
| `retryCount` | `number` | Retries attempted during execution |
| `status` | `'success' \| 'failed' \| 'rate_limited' \| 'cancelled'` | HTTP execution outcome |
| `reportedCost` | `number \| null` | Explicit cost reported by provider or null |
| `costBasis` | `'reported' \| 'estimated' \| 'unknown'` | Cost provenance label |
| `durationMs` | `number \| null` | Request latency in milliseconds |
| `qualityScore` | `number \| null` | Outcome evaluation score (1-100) if recorded |
| `isSample` | `boolean` | Visible flag designating fictional sample records |

---

## Quickstart & Setup

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/your-org/tokenbudgeter.git
cd tokenbudgeter

# Install dependencies
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env` (optional for local deterministic usage; required if using on-demand Gemini summaries):
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```
The server starts at `http://0.0.0.0:3000`.

### 4. Run Automated Test Suite
```bash
npm test
```
Runs deterministic verification tests for cost calculation, deduplication, CSV formula injection neutralization, filter logic, and optimization detection.

### 5. Type Checking & Production Build
```bash
npm run lint
npm run build
```

---

## Architecture Notes

```
┌───────────────────────────────────────────────────────────┐
│                 Frontend (React + Vite)                   │
│                                                           │
│  [Top Bar Contract]  [Date & Dimension Filter Bar]       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Local-First IndexedDB Repository                    │  │
│  │ (Events · Projects · Rate Cards · Experiments)      │  │
│  └──────────────────────────┬──────────────────────────┘  │
│                             │                             │
│  ┌──────────────────────────▼──────────────────────────┐  │
│  │ Deterministic Analytics Engine                      │  │
│  │ · KPI Aggregation (Actual vs Estimates)             │  │
│  │ · Inefficiency Detector (Loops, Caches, Bloat)      │  │
│  │ · Savings Simulator (Mathematical Projections)      │  │
│  └──────────────────────────┬──────────────────────────┘  │
│                             │                             │
│  [Overview] [Explorer] [Lab] [Simulator] [Reports]        │
└─────────────────────────────┼─────────────────────────────┘
                              │ On-Demand Explanation
                              ▼
┌───────────────────────────────────────────────────────────┐
│              Backend Proxy (server.ts)                    │
│   POST /api/gemini/explain-finding (gemini-3.8-flash)     │
│   Untrusted input sanitized · Never does arithmetic       │
└───────────────────────────────────────────────────────────┘
```

---

## Persistence & Storage Architecture

TokenBudgeter employs a **Local-First, Zero-Cloud Storage Architecture** designed for speed, privacy, and future migration flexibility.

### 1. Storage Abstraction Layer (`IStorageAdapter`)
All data operations are decoupled from physical storage through the `IStorageAdapter` interface (`src/services/storage.ts`).
- **IndexedDB (`IndexedDbStorageAdapter`)**: The primary storage backend in browser environments. Stores large usage event collections, import batch manifests, project budgets, custom rate cards, A/B experiments, and schema metadata (`TokenBudgeterDB` database).
- **Synchronous Cache (`localStorage`)**: Stores lightweight display preferences (currency, timezone, theme) to guarantee zero-latency cold-boot hydration without UI flicker.
- **In-Memory Store (`MemoryStorageAdapter`)**: Automatically activated in Node.js test runners, headless CI/CD, or restricted environments where IndexedDB is unavailable.
- **Future Database Migration**: The storage abstraction allows swapping IndexedDB for SQLite, PostgreSQL, DuckDB-Wasm, or remote enterprise databases without rewriting any analytical or visualization logic.

### 2. Schema Versioning & Safe Migrations
- **Current Schema Version**: `v2`.
- **Migration Strategy**: Migrations run automatically on database open (`onupgradeneeded`). When migrating from `v1` to `v2`:
  - New object stores (`import_batches`, `schema_meta`) and indices (`importBatchId`, `isSample`) are created without dropping existing stores.
  - Legacy records without batch provenance or origin tags are safely backfilled as `recordOrigin: 'imported'` or `'manual'` without data loss.
  - User records are strictly preserved across version upgrades.

### 3. Ingestion Governance & Provenance Isolation
Every record tracks its origin:
- **`sample`**: Fictional demonstration workloads generated on initial startup.
- **`imported`**: Real records ingested via CSV or JSON log files with associated batch manifests.
- **`manual`**: Direct user configurations or manual log entries.

Users can selectively reset or purge fictional sample records from **Settings -> Data Management** without deleting any real user imports.

### 4. Transactional Ingestion & Rollback Safety
Imports are saved transactionally across both `events` and `import_batches` stores in a single readwrite transaction:
- If an import fails, contains invalid rows, or encounters storage quota limits, the transaction aborts automatically.
- No partial, corrupted, or orphaned records remain in the dataset.

### 5. Backup & Recovery Operations

#### Exporting a Full Backup
1. Navigate to **Settings** (`/settings`).
2. Click **Export Full Backup (JSON)**.
3. A JSON backup file named `tokenbudgeter-full-backup-v2-<timestamp>.json` will download. The file contains a versioned backup manifest (`app`, `schemaVersion`, `exportedAt`) and all datasets (`events`, `projects`, `pricing`, `experiments`, `importBatches`, `settings`).

#### Restoring a Backup
1. Navigate to **Settings** (`/settings`).
2. Click **Restore Backup** and select a valid TokenBudgeter backup JSON file.
3. The restore pipeline validates the JSON syntax and schema structure before committing records.
4. A status summary confirms the count of restored events, projects, and batches.

#### Selective Batch Deletion
1. In **Settings -> Import Batches & History Governance**, inspect the provenance, token volume, and spend of each imported file.
2. Click **Delete Batch** next to any batch.
3. All events belonging to that specific batch and its manifest are purged, leaving other datasets intact.

### 6. Storage Quota & Recovery Expectations
- **Browser Limits**: Browser IndexedDB limits typically range from 50MB to several gigabytes depending on disk capacity and browser vendor.
- **Quota Exceeded Recovery**: If storage quota is exhausted, TokenBudgeter detects the condition (`QuotaExceededError`, code 22/1014) and surfaces actionable guidance to export a backup and delete older batches.
- **Data Recovery Expectations**:
  - Browser storage is tied to the current browser origin. Clearing browser cookies/site data, or using incognito/private windows, will wipe local storage.
  - **Best Practice**: Export regular JSON backups for long-term audit compliance and historical preservation.

### 7. Zero Telemetry & Privacy Guarantee
TokenBudgeter never uploads user events, tokens, project names, or logs to remote servers or third-party AI providers. The server proxy is strictly used for on-demand finding explanations when requested, transmitting only sanitized architectural metadata.

---

## Provider Integrations & Adapter Architecture

TokenBudgeter features a modular integration framework enabling authorized live synchronization alongside first-class CSV/JSON file ingestion.

### 1. Common Provider Adapter Interface (`IProviderAdapter`)
Every provider integration implements the standardized `IProviderAdapter` interface (`src/services/integrations/types.ts`):
- **Provider Identification & Capabilities**: Declares whether direct REST polling, incremental cursor synchronization, granular per-request traces, prompt caching, or latency tracking are supported.
- **Connection Testing (`testConnection`)**: Tests authentication and granted scopes with narrow test requests before initiating synchronization.
- **Incremental Synchronization (`sync`)**: Fetches usage records within a defined time window or cursor, maps them into canonical `UsageEvent` models, and handles pagination.
- **Rate Limit & Error Handling**: Gracefully handles HTTP 429 backoff, network timeouts, and permission denials.
- **Canonical Mapping (`mapToCanonical`)**: Converts vendor-specific payloads into the canonical schema with deterministic content fingerprints and batch manifests.

### 2. Provider Integration Support Matrix

| Integration | Status | Ingestion Method | Data Basis | Supported Fields | Limitations & Unsupported Fields | Required Scopes |
|---|---|---|---|---|---|---|
| **OpenAI Organization Usage API** | Live REST API | Direct sync via `/v1/organization/usage/completions` | Hourly aggregate token buckets | Timestamp, model, inputTokens, outputTokens, cachedInputTokens, requestCount, project_id, estimatedCost | `durationMs` (latency not in billing buckets), `retryCount` (not distinguished), `status` (HTTP codes omitted) | Organization Admin key with `usage.read` |
| **Mock / Sandbox Adapter** | Sandbox Active | Deterministic in-memory simulation | Per-request synthetic events | All canonical fields | Synthetic test data only; clearly labeled with `mockGenerated: true` | None (Local deterministic fixture) |
| **OpenTelemetry GenAI Collector** | Streaming Ready | Standardized semantic trace ingestion | Granular execution spans | Span ID, timestamp, model, provider, inputTokens, outputTokens, durationMs, status | `reportedCost` (OTel standard tracks execution spans, not financial ledgers; cost estimated via rate cards) | Collector receiver endpoint |
| **Anthropic Console Export** | File Export Only | Console CSV / JSON spreadsheet export | Hourly/Daily billing ledger | Timestamp, model, inputTokens, outputTokens, cachedInputTokens, reportedCost | Direct API sync is unsupported because Anthropic does not expose a public live per-request usage API | Workspace Admin or Billing Owner |

### 3. Server-Side Credential Isolation
- Credentials (e.g. OpenAI Admin API Keys) are stored securely on the server via environment variables (`OPENAI_ADMIN_API_KEY`, `OPENAI_ORGANIZATION_ID`) or passed via HTTPS POST to `/api/integrations/*` server proxy routes.
- Credentials are **never** bundled in client-side code, never stored in browser localStorage, and never logged in console telemetry.

### 4. Idempotency & Zero Double-Counting Guarantee
- Every synchronized event receives a deterministic content fingerprint (`generateEventFingerprint`) and a stable synthetic ID (e.g. `openai_bucket_<timestamp>_<model>_<project>`).
- Synchronization verifies incoming records against existing IndexedDB events before committing. Duplicate records are safely quarantined, guaranteeing that repeated syncs produce **zero** double-counting.

### 5. Explicit Handling of Unavailable Fields
- Missing telemetry fields are preserved as `null` rather than fabricated as zeros (e.g. `durationMs: null` for OpenAI billing buckets, never `0ms`).
- Datasets lacking provider-reported dollar amounts are marked with `costBasis: 'estimated'` and calculated against verified pricing catalogs.

---

## Phase 7: Optional AI Analyst & Anti-Hallucination Architecture

TokenBudgeter includes an optional AI analysis service that explains verified telemetry trends, diagnoses retry anomalies, prioritizes optimization experiments, and audits instrumentation gaps—without conversational chatbot clutter or delegated arithmetic.

### 1. Architectural Boundaries & Pre-computation
- **Zero Delegated Arithmetic**: All financial sums, token totals, retry ratios, and period-over-period delta percentages are computed deterministically by TokenBudgeter's audit engine *before* an AI request is formed. The LLM is never permitted to perform calculations or invent savings figures.
- **Privacy Shield & Minimal Transmission**: The application never sends raw prompt texts, customer completions, source code, headers, or credentials. Only sanitized aggregates and masked candidate evidence IDs are transmitted.
- **Prompt Injection Defense**: All user queries and metadata strings are sanitized to strip prompt-injection patterns (`ignore previous instructions`, `<system>`, `[INST]`), capped to 200 characters, and treated as passive untrusted data.

### 2. Supported Model & Replaceable Provider Interface
- **Model**: Powered by the modern, supported model `gemini-3.8-flash` via `@google/genai` TypeScript SDK on the server (`server.ts` endpoint `POST /api/analyst/analyze`). Deprecated models are strictly prohibited.
- **Pluggable Interface (`IAnalystProvider`)**:
  - `GeminiAnalystProvider`: Connects to the secure server proxy with an automated 15-second timeout.
  - `RuleBasedAnalystProvider`: 100% deterministic, offline rule engine requiring zero network calls or API keys.

### 3. Anti-Hallucination Guard & Citation Verification
- Every generated response is validated against the set of known candidate evidence records. If the model attempts to cite a fabricated ID, the anti-hallucination validator immediately strips the ID from the citations list, marks the response invalid, and emits an explicit alert.
- Summary narratives are scanned for unsupported financial numbers; claims exceeding analyzed spend trigger numerical audit warnings.

### 4. Ground Truth vs. Inferred Hypotheses
The UI explicitly separates:
- **Measured Facts**: Verified ground truth metrics directly calculated from telemetry.
- **AI Hypotheses**: Inferred architectural or workflow explanations clearly tagged with inference badges.
- **Recommended Experiments**: Actionable A/B verification trials with risk levels, target metrics, and step-by-step checklists.
- **Evidence Drawer**: Verifiable source events inspectable with one click.
- **Telemetry Limitations & Missing Data**: Explains data gaps (e.g. missing latency or untracked prompt caching).

### 5. Strict Non-Autonomous Guarantee
TokenBudgeter is a decision-support platform. The AI Analyst **never** executes automated scripts, mutates application code, modifies database records, or changes provider API models automatically.

---

## Phase 9: Data Integrity, Disaster Recovery & Security Hardening

TokenBudgeter incorporates production-grade data integrity and security controls across all financial and ingestion pipelines:

### 1. Financial & Analytics Correctness
- **Preservation of Explicit Zero Cost**: Google AI Studio free tier, OpenAI promotional credits, and local zero-cost models reporting `$0.00` are strictly preserved in `reportedCostUsd` as `$0.0000 reported (free)` rather than misclassified as unrated/unknown calls.
- **Provenance Isolation**: Reported, estimated, unknown, and simulated hypothetical costs are never blended. Missing rate cards trigger explicit amber `Unknown / no rate card` badges in the Usage Explorer.
- **Multi-Currency Normalization**: Table sorting and comparative aggregations normalize native currencies (EUR, GBP, JPY, CAD) to USD using reference exchange rates while preserving native amounts for audit trails.
- **Deterministic Date Boundaries**: Custom date ranges are strictly bound to UTC midnight start and day-end millisecond (`T23:59:59.999Z`), and malformed dates are safely caught without throwing runtime exceptions.

### 2. Backup Integrity & Atomic Recovery
- **Pre-Write Backup Validation (`validateBackupPayload`)**: Backups are audited before modifying storage. Rejects foreign application dumps, unsupported future schema versions, malformed JSON, and corrupt event records.
- **Single-Transaction Atomic Restore**: In IndexedDB, backups restore across `events`, `projects`, `pricing`, `experiments`, `import_batches`, and `settings` inside a single atomic transaction. Any storage quota error triggers an automatic rollback to prevent partial corruption.
- **Selective Sample Reset**: Resetting fictional sample workloads selectively purges only records tagged with `isSample: true` or `recordOrigin: 'sample'`, leaving real user imports and manual entries untouched.

### 3. Security & Anti-Injection Architecture
- **Control-Character CSV Formula Shield (`sanitizeCsvCell`)**: Neutralizes DDE formula injection even when obfuscated with leading spaces, tabs, carriage returns, or null control characters (`\u0000`–`\u001f`, `\u007f`–`\u009f`, `\uFEFF`).
- **XSS-Safe HTML Reports**: All dynamic inputs in printable HTML exports pass through `escapeHtml`.
- **Prototype Pollution Shield**: Both server-side Express routes and client-side ingestion reject payloads containing dangerous object mutation keys (`__proto__`, `constructor`, `prototype`).
- **Endpoint Protection**: Server-side AI proxies enforce strict 15-second request timeouts and 2MB payload limits.

### 4. Comprehensive Test Suite
- Automated regression suite with **698 passing tests** across 20 test suites (`npm test`).
- Zero TypeScript errors (`npm run lint` / `tsc --noEmit`).

---

## Sample Data Governance & Production First-Run Experience

TokenBudgeter enforces strict data provenance to prevent fictional sample records from distorting real financial decisions.

### 1. First-Run Choice: Explore Demo vs. Start Fresh
On initial launch, TokenBudgeter presents a clear choice:
- **Explore Demo**: Loads a verified fictional AI workload (68 events across Claude 3.5 Sonnet, GPT-4o, DeepSeek, and Gemini) simulating PR review bots, flaky test generation, duplicate queries, and prompt caching. Sets the workspace to **Demo Mode**.
- **Start Fresh**: Initializes a pristine, completely empty workspace with standard rate cards. No fictional records are stored.

### 2. Zero Silent Ingestion Guarantee
TokenBudgeter **never** silently injects sample data into a user's real workspace. Once a user has initialized their workspace, empty workspaces stay empty upon reload; demo records are never automatically resurrected.

### 3. Demo Mode vs. Real-Data Mode
- **Real-Data Mode (Default for production)**:
  - All fictional demo records are strictly excluded from KPI totals, charts, project spend, and optimization findings.
  - Usage calculations reflect only verified user data (imported CSV/JSON logs, manual entries, or provider synchronization).
- **Demo Mode**:
  - Displays the fictional workload for feature evaluation, benchmarking, and scenario simulation.
  - Clearly marked with an amber **DEMO MODE ACTIVE** ambient badge across headers and dashboards with a one-click switch back to Real Data Mode.

### 4. Accessible Settings Controls
Under **Settings -> Demo Data & Workspace Governance**, users can at any time:
- **Load / Reload Demo Data**: Loads or refreshes the clean fictional sample workload without creating duplicate records or double-counting.
- **Remove All Demo Data**: Permanently deletes all sample events and batches from IndexedDB. **Real user records (imported files, manual logs, synced traces) are strictly preserved.** Demo deletion persists across page reloads.
- **Start Empty Workspace**: Clears demo data and returns the workspace to an empty state with standard rate cards ready for live ingestion.

### 5. Provenance in Exports & Backups
- **CSV Exports (`exportEventsToCsv`)**: Feature dedicated `is_sample` and `record_origin` (`'sample'`, `'imported'`, `'manual'`) columns.
- **JSON Backups (`exportAllToJson`)**: Contain a top-level `provenanceSummary` breakdown (`sampleEventsCount`, `realEventsCount`, `totalEventsCount`). Restoring backups guarantees exact preservation of record provenance.

---

## Phase 10: Evidence-Based Experiments & Savings Simulator

TokenBudgeter provides empirical decision support for evaluating workflow optimizations.

> **Core Principle**: *Simulated savings are not actual savings. A cheaper result is not automatically a better result. Token reduction alone never implies quality improvement.*

### 1. Cost/Quality Experiments Lab
- **Structured Experiment Configuration**:
  - Name, objective, project, task, task category, and notes.
  - Baseline and experimental configurations with model and prompt parameters.
  - Lifecycle states: `draft`, `collecting_data`, `ready_for_review`, `completed`, `inconclusive`, `archived`.
  - Target sample sizes and inclusion criteria (e.g. `input context > 10,000 tokens`).
  - Evaluation methods: `human_eval`, `automated_benchmark`, `unit_tests`, `llm_judge`, `production_ab`.
- **Scientific Evaluation Metrics**:
  - **Cost per Successful Request**: Evaluates `totalCost / successCount`. If an experimental arm has 0 successful runs, the metric strictly evaluates to `null` and surfaces a critical failure alert rather than calculating `Infinity` or `NaN`.
  - **Latency Delta**: Exact difference in average request duration (`ms`).
  - **Success Rate Delta**: Compares baseline vs. experimental reliability (%).
  - **Quality Score Impact**: Averages evaluation scores (0-100) and displays the net quality point delta.
  - **Token Footprints**: Tracks input, output, and prompt-cached token averages.
- **Scientific Warnings & Guardrails**:
  - **Small Sample Warning (N < 10)**: Warns of high statistical variance when trial runs are underpowered.
  - **Reliability Regression Alert**: Flags when experimental configurations drop success rate by >5%.
  - **Quality Regression Warning**: Explicitly alerts users when quality degrades by >3 points, reminding engineers that cost reduction does not offset degraded output quality.
- **Full Lifecycle & JSON Export**: Create, edit, filter by status, export evaluation to JSON, and delete with confirmation.

### 2. Deterministic Savings Simulator
- **Named Optimization Presets**:
  - *Balanced Optimization*: 20% context compression, 30% retry cut, 50% caching adoption.
  - *Aggressive Prompt Caching*: 80% caching adoption on large prompts.
  - *Model Downshifting Trial*: 50% shift to target model.
  - *Reliability & Clean Retries*: 60% retry reduction via backoff.
  - *Workload Growth (+50% volume)*: +50% volume scaling projection.
- **Deterministic Multi-Lever Mathematics**:
  - Levers: Context compression (0-80%), retry reduction (0-90%), prompt caching (0-100%), model shift (0-100%), workload volume scaling (-50% to +100%).
  - Applies levers sequentially to avoid double-counting savings.
  - Guaranteed clamp safeguards preventing negative costs or projections exceeding 100% of baseline spend.
- **Strict Labeling & Unrated Event Disclosure**:
  - Clearly distinguishes *Measured baseline*, *User-provided assumption*, and *Calculated projection*.
  - Counts and prominently flags unrated events (`costBasis: 'unknown'`) with an amber disclosure badge, excluding unrated records from savings calculations.
  - Real-world trade-off checklists for each active lever (e.g., AST pruning risks, transient network error exposure, cache invalidation from dynamic variables).
  - Standalone scenario JSON export without mutating underlying historical records.

---

## License

MIT © 2026 TokenBudgeter Contributors.


