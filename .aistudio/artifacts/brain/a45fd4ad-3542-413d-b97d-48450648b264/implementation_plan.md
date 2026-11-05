# TokenBudgeter — AI Usage Analytics & Optimization Platform

TokenBudgeter is an open-source, local-first analytics and decision-support platform designed for developers, engineering teams, and productivity power users to audit AI usage, trace spend, detect systematic workflow inefficiencies (such as retry loops and context bloat), and test optimizations with deterministic rigor.

> [!IMPORTANT]
> **Confirmed Design & Technical Decisions**:
> - **Visual Design System**: Linear-inspired minimal dark developer tool interface with subtle micro-animations (`animate-fade-in`, `animate-scale-in`, `animate-slide-in`, `interactive-card`, `interactive-btn`, and `prefers-reduced-motion` compliance).
> - **Zero-Pill Discipline**: Static metadata is rendered as unboxed text with typographic `·` and `/` separators. Filter tabs are quiet interactive segmented buttons rather than candy pill capsules.
> - **Production Deployment Architecture**: Hybrid local-first + single-process Node.js backend proxy (`server.ts`). Serves optimized static assets from `dist/` and proxies `/api/*` endpoints with prototype pollution defense, 2MB payload limits, 15s timeouts, and graceful `SIGTERM`/`SIGINT` shutdown.
> - **Storage Strategy**: Local-first browser IndexedDB (`TokenBudgeterDB` v2) with complete JSON/CSV export, backup, and atomic restore. Zero data leaves the browser without explicit action.
> - **Gemini Role**: Strictly on-demand, server-proxied plain-language synthesis of verified findings and anomaly breakdowns (`models/gemini-3.8-flash`). Never used for mathematical arithmetic or financial totals. Falls back seamlessly to offline rule engine when unconfigured.
> - **Verification Rigor**: 436 automated unit, integration, and deployment tests passing 100%. Clean TypeScript compilation (`tsc --noEmit`) and clean Vite production build.

---

## 1. Overview & Core Concept

TokenBudgeter adheres to the core engineering principle: **"Measure first, explain second, recommend third."** It never hallucinates usage, claims unsubstantiated savings, or conflates actual historical spend with speculative estimates.

### Key Capabilities
1. **Multi-Provider Canonical Ingestion**: Ingests usage records from OpenAI, Anthropic, Gemini, DeepSeek, and custom coding tools (Cursor, Copilot, Aider, Cline) via robust CSV/JSON parsers with column auto-detection and schema validation.
2. **Deterministic Dual-Track Cost Engine**: Clearly delineates between *Reported Cost* (exact figures stated by source records) and *Estimated Cost* (calculated deterministically against verified rate cards with tier, cached input, and reasoning token rules).
3. **Automated Inefficiency Detector (Optimization Lab)**: Scans usage events for duplicate prompt submissions, runaway retry loops, extreme context-to-output ratios, un-cached repetitive system prompts, and high-cost model misallocations on low-complexity tasks.
4. **Deterministic Savings Simulator & A/B Experiments**: Simulates impact of prompt compression, caching adoption, retry reduction, and model down-shifting with transparent formulas, explicit confidence ratings, and quality score tracking.
5. **Linear Minimalist UI & Micro-Animations**: High-density developer-first navigation, tabular typography (`tabular-nums font-mono`), quiet dark surfaces, responsive layouts, and smooth 160ms CSS transitions.
6. **Privacy & Local Ownership**: Runs locally in the browser with full offline availability, immediate data wiping, and zero telemetry.

---

## 2. Production Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client Browser (Local-First)                     │
│                                                                        │
│  - React 19 SPA (Vite compiled static assets)                          │
│  - Storage Engine: Browser IndexedDB (TokenBudgeterDB v2)              │
│  - Ingest Pipeline: Client-side CSV/JSON parsing with formula shield   │
│  - Analytics Core: 100% deterministic arithmetic in TypeScript         │
│  - Savings Simulator & A/B Experiments: Client-side mathematical engine│
│  - Zero Cloud Leak: Usage logs never leave the browser by default      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Same-origin API calls (/api/*)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Node.js Backend Proxy (server.ts)                  │
│                                                                        │
│  - Express server on port 3000 (configurable via PORT)                 │
│  - Serves compiled static frontend assets from dist/ in production     │
│  - /api/analyst/analyze: Server-side Gemini 3.8 Flash summary proxy    │
│  - /api/gemini/explain-finding: On-demand architectural explanations   │
│  - /api/integrations/*: Server-side provider API credential isolation  │
│  - Security: 2MB request body cap, 15s timeouts, prototype shield     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Outbound HTTPS only (when configured)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         External Providers                             │
│  - Google AI Studio / Gemini API (gemini-3.8-flash)                    │
│  - OpenAI Organization Usage API (optional sync via server secrets)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Completed Phases & Verification State

- [x] **Phase 1**: Ingestion & Data Pipeline (CSV, JSON, Header detection, Fingerprinting)
- [x] **Phase 2**: Dual-Track Cost Engine & Rate Cards (Deterministic calculations, Currency conversion)
- [x] **Phase 3**: Optimization Lab & Inefficiency Detection (Retry loops, Context bloat, Caching misses)
- [x] **Phase 4**: Usage Explorer & Project Budgets (Filtering, Sorting, CSV formula injection defense)
- [x] **Phase 5**: Storage Abstraction & IndexedDB Persistence (Safe migrations, Backup/Restore)
- [x] **Phase 6**: Provider Integrations & Adapters (OpenAI, Anthropic, Google Cloud Vertex, OpenRouter)
- [x] **Phase 7**: AI Analyst & Evidence Verification (Anti-hallucination validation, Offline fallback)
- [x] **Phase 8**: Comprehensive Requirements Audit (Verification matrix in `docs/REQUIREMENTS_AUDIT.md`)
- [x] **Phase 9**: Critical Defect Fixes & Security Hardening (Zero-cost preservation, XSS escaping)
- [x] **Phase 10**: Cost/Quality Experiments & Savings Simulator (A/B evaluation, volume scaling)
- [x] **UI Design Phase**: Linear-Inspired Minimal Dark UI (Palette, Zero-pill, Sidebar, TopBar, High-density grids)
- [x] **Final Phase**: Production Readiness, Packaging & Deployment:
  - Added Linear-inspired micro-animations (`src/index.css`, `src/App.tsx`) with `prefers-reduced-motion` compliance.
  - Aligned production `package.json` scripts (`"start": "node server.ts"`).
  - Hardened `server.ts` with explicit API 404 handler and `SIGTERM`/`SIGINT` graceful shutdown.
  - Authored comprehensive `docs/DEPLOYMENT.md` covering all 10 architectural and operational sections.
  - Verified 436 automated tests passing 100%, clean `tsc --noEmit`, clean `vite build`.
