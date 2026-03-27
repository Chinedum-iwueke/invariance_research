# Invariance Research

Invariance Research is a **Next.js + TypeScript application** for execution-aware trading strategy validation.

The repository currently contains:

- a public, content-driven marketing/research site,
- an authenticated product workspace for upload → analysis → diagnostics,
- a durable SQLite-backed backend with queue-style job processing,
- a Python bridge into the `bulletproof_bt` engine seam (`bt.run_analysis_from_parsed_artifact`),
- plan/entitlement gating, Stripe billing integration, and an internal admin/ops console.

This README describes the system **as implemented today**.

---

## What the product is (current state)

At present, Invariance Research is a SaaS-style diagnostic platform where a signed-in user can:

1. upload a strategy artifact (`.csv` or `.zip`),
2. have it parsed/validated and scored for diagnostic eligibility,
3. create an analysis job,
4. process analysis asynchronously through the `bt` engine bridge,
5. view persisted diagnostic pages (overview, distribution, monte carlo, execution, regimes, ruin, stability, report),
6. request durable exports (`json`, `md`, `pdf`) processed by a separate export worker.

The app is not just a static UI shell anymore; it includes durable persistence, workers, billing hooks, and operational surfaces.

---

## Implemented capabilities

### Public + commercial web surfaces

- Public routes for positioning, methodology, pricing, research, and contact.
- Marketing pages are real and navigable, though some content modules still include curated placeholder/demo copy blocks where noted in page copy.
- Auth routes: credential-based sign in/up flow via Auth.js.

### Authenticated product workspace

- App shell under `/app` with protected routes.
- New Analysis intake UI with drag/drop upload and server-side inspection.
- Analyses library and per-analysis workspace pages.
- Billing and upgrade pages with plan/usage visibility.

### Upload intake and eligibility

- Supported file extensions: `.csv`, `.zip`.
- 10 MB upload limit enforced at intake service.
- Parser + validator pipeline for trade CSV and structured bundles.
- Eligibility summary persisted with diagnostics available/limited/unavailable and limitation reasons.
- Upload class enforcement by plan (trade CSV vs structured bundle vs research bundle).

### Durable analysis pipeline

- Analysis creation persists:
  - analysis record,
  - queued analysis job metadata,
  - benchmark selection/config snapshot.
- Worker claims queued jobs, runs engine seam, normalizes to product `AnalysisRecord`, persists terminal status.
- Retry path exists for failed analyses with persisted retry count/backoff.

### Durable export pipeline

- Export requests are queue-backed and async.
- Export formats implemented: `json`, `md`, `pdf`.
- Export status + job progress persisted separately.
- Download endpoint enforces ownership + expiration.
- Export cleanup participates in maintenance sweep.

### Entitlements, billing, usage

- Plan matrix implemented (`explorer`, `professional`, `research_lab`, `advisory`).
- Diagnostic access resolved through artifact capability + engine capability + plan entitlements.
- Monthly usage tracking for analyses/uploads/exports.
- Stripe checkout, portal session creation, and webhook processing present.
- Webhook receipt persistence + idempotent replay-safe handling implemented.

### Admin / ops console

Admin area under `/app/admin` includes:

- jobs visibility and retry controls,
- webhook receipt inspection and reprocess action,
- exports dashboard with regenerate action,
- accounts/subscriptions/usage visibility,
- health snapshot page,
- maintenance controls (sweep, expired exports, stale failed jobs).

### Health + readiness

- `/api/health` returns component-level checks and `healthy` / `degraded` / `unhealthy` status.
- Checks include DB, storage, Stripe config, engine probe, queue backlog signal, and worker heartbeat freshness.

---

## Analysis flow (implemented)

1. **Upload inspect** (`POST /api/uploads/inspect`)
   - Validates file envelope.
   - Parses artifact and validates semantics.
   - Computes eligibility + diagnostics availability.
   - Persists artifact + parsed payload + checksum.

2. **Create analysis** (`POST /api/analyses`)
   - Confirms artifact ownership and eligibility.
   - Enforces monthly plan limits.
   - Resolves benchmark selection (`auto` / `manual` / `none`) and persists benchmark config.
   - Persists analysis + `analysis_jobs` row in queued state.

3. **Worker execution**
   - Analysis worker claims queued jobs.
   - Builds engine dispatch payload (requested diagnostics + benchmark settings).
   - Calls Python bridge script to invoke `bt.run_analysis_from_parsed_artifact`.
   - Normalizes engine output into app contracts.
   - Persists completed or failed state with product-safe errors.

4. **Workspace rendering**
   - Analysis pages read persisted `AnalysisRecord` data.
   - Pages gracefully handle incomplete/limited diagnostics and lock states.

5. **Export request** (`POST /api/analyses/:id/exports`)
   - Validates ownership, completion state, and export entitlement.
   - Persists export + export_job rows.
   - Export worker renders artifact, stores file, updates status.

6. **Export retrieval**
   - Status endpoint: `/api/exports/:id`.
   - Binary download endpoint: `/api/exports/:id/download`.

---

## Architecture overview

- **Frontend/app:** Next.js App Router pages and server/client components in `src/app` and `src/components`.
- **API layer:** Route handlers in `src/app/api/*`.
- **Domain contracts:** `src/lib/contracts/*` and Zod schemas in `*.schema.ts`.
- **Services + orchestration:** `src/lib/server/services/*`, `src/lib/server/exports/*`.
- **Persistence:** SQLite via `node:sqlite`, migrations + repositories.
- **Queue/workers:** DB-backed queue records and worker runtimes for analysis + export.
- **Storage:** object-storage abstraction (local filesystem adapter currently).
- **Engine seam:** Node → Python bridge script → `bt` (`bulletproof_bt`) runtime.
- **Ops/admin:** health checks, maintenance services, admin dashboards.

---

## Repository map

```text
src/app/                         # Next.js routes (public, app shell, API)
src/components/                  # UI and domain components
src/lib/contracts/               # Product contracts + schemas
src/lib/server/                  # Backend services, workers, persistence, billing, auth
src/lib/server/ingestion/        # Upload parsing, validation, eligibility
src/lib/server/adapters/         # Engine-to-product normalization adapters
src/lib/charts/                  # Figure adapters to ECharts options
src/server/benchmark-library/    # Benchmark manifest loading + health checks
scripts/                         # Worker launchers, engine bridge, ops scripts
docs/                            # Implementation phase docs and architecture notes
tests/                           # Integration/phase coverage tests
```

---

## Local development

### 1) Install dependencies

```bash
npm install
```

### 2) Python bridge dependency

This repository expects Python 3.10+ and the `bulletproof_bt` package (imported as `bt`).

Install from this repo’s `pyproject.toml`:

```bash
pip install -e .
```

### 3) Run web app

```bash
npm run dev
```

Default app URL: `http://localhost:3000`

---

## Running workers

### Default local mode (embedded workers)

By default, the app starts jobs in-process when enqueued:

```bash
npm run dev
```

### Split-process mode (launch-like)

```bash
INVARIANCE_EMBEDDED_WORKERS=false npm run dev
npm run worker:analysis
npm run worker:export
```

Use split mode to mirror production-style process separation.

---

## Configuration

Key environment variables currently used:

- `INVARIANCE_DB_PATH` – SQLite file path.
- `INVARIANCE_STORAGE_ROOT` – local object storage root.
- `INVARIANCE_EMBEDDED_WORKERS` – enable embedded workers (`true` default).
- `INVARIANCE_ANALYSIS_WORKER_POLL_MS` – analysis worker poll interval.
- `INVARIANCE_EXPORT_WORKER_POLL_MS` – export worker poll interval.
- `INVARIANCE_WORKER_STALE_MS` – heartbeat freshness threshold.
- `INVARIANCE_PYTHON_BIN` – Python executable for bridge.
- `INVARIANCE_BULLETPROOF_BRIDGE_SCRIPT` – bridge script path override.
- `INVARIANCE_ENGINE_TIMEOUT_MS` – engine invocation timeout.
- `INVARIANCE_BENCHMARK_LIBRARY_ROOT` – benchmark manifest/dataset root.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` – Stripe API/webhook keys.
- `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_RESEARCH_LAB` – Stripe price IDs.
- `ADMIN_EMAILS`, `ADMIN_USER_IDS` – admin allowlists.
- `APP_URL` – checkout/portal return URLs.

---

## Persistence and storage

### Database

- SQLite database with migrations applied on startup.
- Core tables include users/accounts/subscriptions/entitlements/usage, artifacts, analyses, jobs, exports, webhooks, and worker heartbeats.

### Object storage

- `ObjectStorage` interface is implemented with local filesystem backing.
- Uploads and exports both persist file metadata (size/content-type/checksum) in DB records.
- Design is adapter-ready for future S3-compatible backend migration.

---

## Engine integration (`bulletproof_bt` / `bt`)

Engine execution path:

1. Node worker builds dispatch payload.
2. Node spawns Python bridge script (`scripts/run_bulletproof_engine.py`).
3. Bridge imports `bt`, validates payload against runtime model seam, invokes `run_analysis_from_parsed_artifact`.
4. JSON result returns to Node, then is normalized into product contracts.

Health/startup checks include Python availability, bridge script presence, and `--probe` seam verification.

---

## Charting, diagnostics, and report/export state

### Implemented today

- Diagnostic pages render persisted figures and metrics with ECharts adapter layer.
- Page-level logic includes fallbacks when figures are partial/missing.
- Report workspace synthesizes verdict, confidence, diagnostics summary, methodology, limitations, and recommendations.
- Export renderer supports JSON, Markdown, and a deterministic lightweight PDF generator.

### Current limitations / evolving areas

- PDF output is intentionally lightweight and deterministic (not full template-grade publication layout).
- Diagnostic richness depends on uploaded artifact class and engine-emitted payload depth.
- Some public-facing pages still intentionally include mock/placeholder presentation components.

---

## Admin, billing, and entitlement surfaces

- **Auth:** Auth.js credentials provider with server-side route guards.
- **Entitlements:** central plan matrix + policy resolution for diagnostics/uploads/exports.
- **Billing:** Stripe checkout + portal + webhook reconciliation.
- **Admin:** account, jobs, exports, webhooks, maintenance, and health pages/actions behind allowlist-based admin guard.

---

## Testing and verification

Representative commands:

```bash
npm run lint
npm run build
```

Phase/integration-style tests also exist under `tests/` and `src/__tests__/`.

---

## Internal documentation

Useful repository docs:

- `docs/phase6-saas-architecture.md`
- `docs/phase7a-durability-and-queues.md`
- `docs/phase7b-ops-and-exports.md`
- `docs/phase8-launch-readiness.md`
- `docs/ingestion-spec.md`
- `docs/analysis-contract.md`
- `docs/engine-payload-consumption-and-rendering.md`
- `docs/admin-ops-console.md`
- `docs/validation-report-and-pdf-export.md`

---

## Honest status summary

Implemented and operational now:

- durable upload/analysis/export workflows,
- SQLite persistence and migrations,
- queue-backed worker model with retry/backoff,
- engine bridge integration to `bt`,
- entitlement and usage enforcement,
- Stripe webhook-backed billing reconciliation,
- admin/ops dashboards and maintenance actions.

Implemented but still intentionally limited/evolving:

- export/report visual polish and PDF sophistication,
- benchmark and advanced diagnostic depth depending on artifact richness and engine payload coverage,
- public-site sections that still use controlled demo/placeholder content modules.

