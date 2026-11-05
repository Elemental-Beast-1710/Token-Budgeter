# TokenBudgeter — Production Deployment Guide

This guide documents the production architecture, configuration, security posture, and deployment workflows for **TokenBudgeter**, an open-source, local-first AI usage analytics, cost optimization, and decision-support platform.

---

## 1. Deployment Architecture

TokenBudgeter uses a **hybrid local-first + lightweight backend proxy architecture**:

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

### Why this architecture fits TokenBudgeter:
1. **Local-First Privacy**: Sensitive prompt tokens, project names, code filenames, and developer workloads remain in client-side IndexedDB.
2. **Server-Side Secret Isolation**: Gemini API keys and provider admin keys are stored strictly in server-side environment variables and are never sent to browser bundles.
3. **Single Process Simplicity**: In production, `server.ts` serves both static Vite production bundles (`dist/`) and `/api/*` proxy endpoints on the same port (`PORT=3000`), avoiding cross-origin (CORS) complexity, separate domain management, or split hosting.
4. **Static Fallback Capability**: If deployed on pure static hosting (e.g. GitHub Pages, Cloudflare Pages, S3/CloudFront) without Node.js, TokenBudgeter's core features (analytics, imports, exports, backups, rate cards, simulator, and rule-based analyst) function 100% offline via `RuleBasedAnalystProvider`.

---

## 2. Prerequisites

- **Node.js**: `v18.0.0` or higher (`v22.x` LTS recommended; tested on `v22.23.3`).
- **Package Manager**: `npm` (v9+) or `pnpm` / `bun`.
- **System Memory**: Minimum 512MB RAM; 1GB+ recommended for building production bundles.
- **Port**: Default `3000` (or injected `PORT` environment variable).

---

## 3. Build & Test Commands

Run from the project root:

```bash
# 1. Install all dependencies from package-lock.json
npm ci

# 2. Run TypeScript typechecking across client and server
npm run lint

# 3. Execute the 414 automated regression and security test suite
npm test

# 4. Compile optimized frontend production distribution
npm run build

# 5. Start production full-stack server
npm start
```

---

## 4. Environment Variables & Secrets

Environment variables are defined in `.env` (copy from `.env.example`).

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `3000` | Port for the HTTP server to listen on. Injected automatically by Cloud Run, Heroku, etc. |
| `NODE_ENV` | Recommended | `development` | Set to `production` in production environments to enable static asset serving from `dist/`. |
| `GEMINI_API_KEY` | Optional | `""` | Server-side API key for Google AI Studio / Gemini API (`gemini-3.8-flash`). Required only for AI Analyst narrative summaries. |
| `OPENAI_ADMIN_API_KEY` | Optional | `""` | Optional server-side admin key (`usage.read` scope) for direct OpenAI usage sync. Never exposed to browser. |
| `OPENAI_ORGANIZATION_ID`| Optional | `""` | Optional OpenAI organization identifier (e.g. `org-...`). |
| `APP_URL` | Optional | Injected | Canonical public URL of the application. |
| `DISABLE_HMR` | Optional | `""` | Set to `true` to disable Vite HMR file watching in containerized build sandboxes. |

### Security Rules:
- **Never commit `.env` to version control**.
- **Browser isolation**: Client-side code cannot access `process.env.GEMINI_API_KEY` or `process.env.OPENAI_ADMIN_API_KEY`.
- **Clear fallback**: If `GEMINI_API_KEY` is omitted, the AI Analyst transparently switches to the offline rule-based deterministic engine (`RuleBasedAnalystProvider`).

---

## 5. Hosting Configurations

### Option A: Container / Cloud Run / Docker (Recommended Full-Stack)

TokenBudgeter is container-ready. Below is the production `Dockerfile`:

```dockerfile
# Multi-stage production Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run lint && npm test && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src

EXPOSE 3000
CMD ["npm", "start"]
```

#### Deploying to Google Cloud Run:
```bash
# Build and deploy container directly
gcloud run deploy tokenbudgeter \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets GEMINI_API_KEY=tokenbudgeter-gemini-key:latest
```

### Option B: Node.js VPS / Systemd Service

For Ubuntu/Debian Linux virtual machines:

```ini
# /etc/systemd/system/tokenbudgeter.service
[Unit]
Description=TokenBudgeter AI Usage Analytics
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/tokenbudgeter
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=GEMINI_API_KEY=your_key_here

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tokenbudgeter
sudo systemctl start tokenbudgeter
```

### Option C: Static-Only Deployment (Offline Deterministic Mode)

If deploying purely to static hosts (GitHub Pages, Cloudflare Pages, Vercel, Netlify):
1. Build static output: `npm run build`.
2. Deploy the `dist/` folder.
3. Configure SPA fallback: redirect all routes `/*` to `/index.html`.
4. *Feature Note*: In static-only hosting, `/api/*` routes are unavailable; TokenBudgeter automatically operates in **Offline Deterministic Mode** with full local IndexedDB persistence, file ingestion, budget tracking, and simulator capabilities.

---

## 6. Frontend / Backend Routing Requirements

- In production, `server.ts` mounts static middleware on `/dist`.
- `/api/*` endpoints are defined before the catch-all wildcard.
- Any unmapped `/api/*` route returns a JSON 404 (`{"error": "API endpoint not found."}`).
- The SPA catch-all route `app.get('*')` serves `dist/index.html` with HTTP 200 to allow client-side tab state preservation.

---

## 7. HTTPS & Security Configuration

- **Reverse Proxy**: Place TokenBudgeter behind an HTTPS reverse proxy (Nginx, Cloudflare, or Cloud Run TLS termination).
- **Security Headers (Nginx example)**:
```nginx
server {
    listen 443 ssl http2;
    server_name budget.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/budget.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/budget.yourdomain.com/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://generativelanguage.googleapis.com;" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 8. Post-Deployment Smoke Tests

Verify after deployment:

1. **Health Check**:
   ```bash
   curl -s http://localhost:3000/api/health
   # Expected: {"status":"ok","timestamp":"...","hasGeminiKey":true/false}
   ```
2. **SPA Routing**:
   ```bash
   curl -I http://localhost:3000/
   # Expected: HTTP 200 OK, text/html
   ```
3. **API 404 Guard**:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/unknown-route
   # Expected: 404
   ```
4. **Browser Verification**:
   - Open application in browser.
   - Verify sample records load in Overview dashboard.
   - Test CSV/JSON upload with `examples/sample_usage.csv`.
   - Verify date filter bounds and tabular figures.
   - Test Savings Simulator sliders.
   - Navigate to Settings -> Export Full Backup.

---

## 9. Rollback & Disaster Recovery Steps

1. **Application Rollback**:
   - For container deployments (Cloud Run / ECS): Switch traffic back to previous revision ID.
   - For git/npm deployments:
     ```bash
     git checkout <previous-tag>
     npm ci
     npm run build
     npm start
     ```
2. **Local Data Recovery**:
   - User data resides in browser IndexedDB.
   - If a browser cache is cleared, restore data via **Settings -> Restore Backup** using a previously exported JSON backup file (`tokenbudgeter-full-backup-v2-*.json`).

---

## 10. Known Limitations & Cost Considerations

- **Server-Side API Costs**: Optional Gemini analysis calls (`gemini-3.8-flash`) incur standard Google AI Studio / Vertex AI token charges if called frequently. TokenBudgeter minimizes cost by sending only precomputed aggregated metrics (~500 tokens/request) and never raw logs.
- **IndexedDB Domain Isolation**: User records are scoped strictly to the origin domain and port (`http://domain:port`). Migrating domains requires exporting and re-importing the JSON backup.
- **Provider API Rate Limits**: OpenAI organization usage endpoints are subject to provider tier rate limits (HTTP 429). TokenBudgeter includes exponential backoff and incremental sync caching to conserve quota.
