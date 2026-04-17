# Repo-Aware Architecture and Deployment Report (2026-04-17)

## 1) Executive summary of current architecture

- **System shape:** single repository, single Next.js app (App Router) serving both public site and authenticated product, plus API routes and worker runtime modules in the same codebase.
- **Backend runtime:** server logic lives in `src/lib/server/*`; persistence is SQLite via `node:sqlite` (`DatabaseSync`), not an external DB service.
- **Job processing:** analysis and export are DB-backed queue jobs (`analysis_jobs`, `export_jobs`) claimed via polling, with optional embedded workers inside web runtime or split worker processes started via scripts.
- **Engine seam:** analysis worker executes Python bridge (`scripts/run_bulletproof_engine.py`) which imports `bt` from `bulletproof_bt` and invokes `run_analysis_from_parsed_artifact`.
- **Storage:** upload/export object storage abstraction exists but currently only local filesystem implementation under `.data/storage`; publications assets stored separately under `.data/publications`.
- **Auth/billing:** Auth.js credentials (email+password) with JWT sessions; Stripe checkout/portal/webhook flow exists with local subscription persistence and webhook receipt table.

## 2) Current-state deployment report

### 2.1 Monolith/monorepo/app shape (1A)

- **Current shape is a monolithic application repository** (not a split-services repo) with one Node/Next deployment unit plus optional sidecar worker processes from same repo.
- Public and authenticated experiences are both in `src/app` (e.g., `/`, `/pricing`, `/research`, and `/app/*` authenticated workspace).
- API layer is colocated under `src/app/api/*`.
- Worker code is colocated under `src/lib/server/workers/*` and launched by `scripts/run-analysis-worker.ts` and `scripts/run-export-worker.ts`.
- No Docker, compose, Terraform, Helm, or CI workflow files are present in repo root tree.

### 2.2 Local development runtime (1H)

- `npm run dev` launches Next.js dev server.
- By default workers run in **embedded mode** (`INVARIANCE_EMBEDDED_WORKERS` default true), so enqueued jobs trigger in-process queue drains.
- Production-like split mode is supported by disabling embedded workers and running:
  - `npm run worker:analysis`
  - `npm run worker:export`
- Python dependency path is local repo editable install (`pip install -e .`) with `bulletproof_bt` installed from Git tag `v0.2.2` in `pyproject.toml`.

### 2.3 Analysis worker implementation (1D)

- **Entrypoint command:** `npm run worker:analysis` -> `tsx scripts/run-analysis-worker.ts` -> `runAnalysisWorkerRuntime()`.
- Worker loop is infinite polling (`runWorkerLoop`) with heartbeat writes to `worker_heartbeats`.
- Job claim path is DB polling (`analysis_jobs` where status='queued' and available_at <= now).
- Claim operation updates job status to processing and progress step fields.
- Inputs are read from DB (`analyses` + `artifacts.parsed_artifact_json`) and engine config snapshots.
- Engine execution path: Node dispatch builder -> Python child process -> `bt.run_analysis_from_parsed_artifact`.
- Outputs are normalized to product `AnalysisRecord`, persisted into `analyses.result_json`; failures persisted in analysis + job tables.
- Transitional seam indicators:
  - `analysis-job-runner.ts` is a thin pass-through to queue enqueue.
  - debug snapshots are written to local `.debug-analysis/*` JSON files during worker runs.

### 2.4 Export worker implementation (1E)

- **Entrypoint command:** `npm run worker:export` -> `tsx scripts/run-export-worker.ts` -> `runExportWorkerRuntime()`.
- Export job claim is DB polling on `export_jobs` queued records.
- Worker loads completed `analysis.result`, calls `renderExport(...)` for `json|md|pdf`, stores bytes via object storage adapter bucket `exports`, updates `exports` + `export_jobs` states.
- Download is served from API route reading storage key and streaming bytes.
- Export robustness status: functional and durable in DB + file storage, but PDF generator is custom lightweight in-code writer (not headless-browser/templated rendering), so report fidelity is intentionally limited.

### 2.5 Auth/session implementation (1C)

- Auth is Auth.js/NextAuth with **credentials provider** only (email + password).
- Signup is custom API route validating password policy then creating user/account with password hash.
- Password hashing uses `scrypt` (`crypto.scryptSync`) with stored params+salt+derived key.
- Session strategy is **JWT** (not DB sessions), with account_id/user_id copied into token/session callbacks.
- Protected APIs call `requireServerSession()` and throw on missing user/account fields.
- Admin auth is allowlist-based (`ADMIN_EMAILS` / `ADMIN_USER_IDS` env vars), not role table in DB.

### 2.6 Database and persistence model (1B)

- DB is SQLite file at `INVARIANCE_DB_PATH` or default `.data/invariance.sqlite`.
- Access style: direct SQL repositories over `node:sqlite` (no ORM).
- Migrations run automatically at DB open through `schema_migrations` table.
- Key tables in current schema:
  - identity/billing/account: `users`, `accounts`, `subscriptions`, `entitlement_snapshots`, `usage_snapshots`
  - analysis pipeline: `artifacts`, `analyses`, `analysis_jobs`
  - export pipeline: `exports`, `export_jobs`
  - operations: `webhook_events`, `worker_heartbeats`
  - product extensions: `publications`, `waitlist_entries`
- Data model stores large payloads as JSON text blobs (`parsed_artifact_json`, `result_json`, `eligibility_snapshot_json`, etc.).
- Current DB model is clearly **production-transitional** for single-node durability, not horizontally scalable multi-writer architecture.

### 2.7 File/artifact storage model (1F)

- Upload blobs: local object storage adapter (`bucket=uploads`) under `.data/storage/uploads/...`.
- Export blobs: local object storage adapter (`bucket=exports`) under `.data/storage/exports/...`.
- Publication PDF/cover assets: separate local FS root `.data/publications/{pdfs|covers}` (or env override).
- Parsed upload artifacts + eligibility + analysis results are persisted in SQLite JSON columns.
- Debug analysis snapshots write to `.debug-analysis/*.json`.
- No S3/GCS/R2 adapter yet despite storage interface abstraction.

### 2.8 Billing / Stripe wiring (1G)

- Billing plan catalog and Stripe price IDs are env-driven.
- Checkout API creates Stripe subscription checkout session with account/plan metadata.
- Portal API requires persisted provider customer id from local subscription table.
- Webhook endpoint validates Stripe signature and applies events.
- Webhook handler persists receipts for idempotency-ish handling (`provider_event_id` unique + attempt_count).
- Internal subscription truth is mirrored into local `subscriptions` and `accounts.plan_id/subscription_status`.
- Gap: webhook mapping depends on metadata `account_id` on subscription events and price-ID map; there is no strong reconciliation job or dead-letter queue for failed webhook processing.

### 2.9 Implicit current deployment architecture (1I + 1A)

**What the code implies today:**

- Single Next.js service can run full app + embedded workers + SQLite + local file storage on same machine.
- Optional split-process mode can separate web and workers but still shares same local DB file and filesystem root, implying co-location requirements.
- No managed queue; queue semantics rely on DB polling.
- No cloud storage dependency; all artifacts assumed locally readable by serving process.
- Health/ops exist (`/api/health`, admin pages) and include worker heartbeat freshness and backlog signals.

## 3) Current-state worker / DB / storage / billing analysis

### 3.1 Analysis workers

- **Mixed async model:** API request creates records synchronously, then job is async via DB queue; execution can be embedded (effectively same process) or external worker.
- **Concurrency/claiming risk:** claim uses `SELECT ... LIMIT 1` then update, without explicit transactional claim lock semantics; race behavior under multiple worker instances depends on timing and could double-claim under contention.
- **Engine coupling:** worker requires Python runtime + bridge script path + `bt` importability at runtime.

### 3.2 Export workers

- Export pipeline is parallel to analysis queue and durable in tables.
- Output durability tied to filesystem-backed object storage; file missing/corruption not guarded by remote redundancy.
- PDF implementation is deterministic but simplistic; strong for reproducibility, weak for high-fidelity formatting.

### 3.3 Database

- SQLite with WAL is solid for local/dev and low write contention.
- For production multi-instance web+workers, SQLite file locking and shared-disk constraints become major operational and scaling constraints.
- JSON blob fields centralize large domain outputs, reducing queryability for analytics/search.

### 3.4 Storage

- Upload/export/publication storage are local FS paths, not object-storage service.
- This tightly couples app correctness to host disk persistence and shared mount design.

### 3.5 Billing

- Stripe wiring is meaningful and closer to launch-ready than placeholder:
  - checkout, portal, webhook signature verification, event receipt table, subscription sync.
- Still needs stronger production controls:
  - webhook retry visibility + alerting,
  - reconciliation worker/cron,
  - explicit entitlement truth precedence strategy,
  - stronger metadata guarantees and backfill.

## 4) Risks and deployment blockers

1. **SQLite as primary prod DB** for concurrent web + workers + growth (1k users) is the top blocker.
2. **Local filesystem object storage** for uploads/exports/publications is not cloud-resilient nor multi-instance-safe.
3. **DB-polled queue without transactional leasing** is vulnerable under horizontal worker scaling.
4. **Worker-runtime coupling to local Python environment** makes immutable deploys and autoscaling harder unless packaged.
5. **Embedded workers default true** can overload web processes and blur resource isolation.
6. **Admin auth via env allowlist only** lacks auditable RBAC model.
7. **No infra-as-code / CI workflows present** for repeatable staging+prod deploy pipelines.
8. **No explicit observability stack** (central logs/traces/alerts) beyond application logs and health endpoint.
9. **No documented backup/restore automation** for DB and storage in repository code.
10. **No explicit rate limiting / abuse controls** on upload-heavy endpoints in visible API layer.

## 5) Recommended target production architecture

### 5.1 Target shape (2A)

- Keep **single code repository + single Next.js app** for public + authenticated surfaces.
- Deploy web tier separately from worker tier.
- Replace SQLite with managed Postgres.
- Replace local object storage with managed object storage (S3-compatible).
- Replace DB-polled queue with managed Redis queue (BullMQ/Upstash QStash alternative), or at minimum Postgres-backed queue with SKIP LOCKED semantics if minimizing moving parts.
- Keep Python bridge seam short-term, but package worker runtime in one container image that includes Node + Python + `bt` dependency to avoid drift.

### 5.2 Suggested hosting split (2B)

- **Vercel:** Next.js web/API tier only (public site + app + lightweight APIs).
- **Do NOT run heavy analysis/export workers on Vercel** (long-running compute, Python subprocess, background loops).
- **Managed Postgres (Neon/Supabase/RDS):** source of truth for accounts/jobs/analyses/exports/billing state.
- **Managed Redis/queue:** job enqueue/dequeue and retry/backoff semantics.
- **Managed object storage (S3/R2/Backblaze):** uploads, exports, publication assets.
- **Stripe:** keep managed SaaS; harden webhook ingestion + replay/reconciliation.
- **Proxmox (optional):** can host worker containers initially to control cost, but only if uptime/backup/monitoring are acceptable; do not host primary DB/object store there for launch-critical reliability unless you already operate HA and backups.

## 6) Detailed phased roadmap

### Phase 0 — Contracts & freeze
- **Objective:** freeze persistence/storage/job interfaces before migrations.
- **Tasks:** define `Database` abstraction boundary (repo layer), finalize object storage interface to support signed URLs, define queue contract (`enqueue`, `lease`, `ack`, `retry`, `dead-letter`).
- **Output:** ADR docs + test harness for worker contract.
- **Risk:** schema drift mid-migration.
- **Tests:** contract tests around analysis+export lifecycle.

### Phase 1 — DB hardening to Postgres
- **Objective:** move durable state off SQLite.
- **Tasks:**
  - introduce Postgres client layer (or ORM migration only if worth scope),
  - port migrations and repository SQL,
  - add transactional job claim semantics,
  - data migration script from SQLite -> Postgres for existing records.
- **Output:** app and workers running on Postgres in staging.
- **Risk:** JSON column type differences, timestamp semantics.
- **Tests:** create-analysis, worker claim concurrency, export flow, webhook persistence.

### Phase 2 — Storage migration
- **Objective:** replace local FS for uploads/exports/publications.
- **Tasks:**
  - add S3-compatible adapter implementing existing `ObjectStorage` interface,
  - migrate publication asset storage path logic to shared object storage (not separate local root),
  - add signed download URLs or streaming proxy.
- **Output:** all artifact classes in object storage with checksums.
- **Risk:** stale keys + migration copy correctness.
- **Tests:** upload inspect, export download, publication asset serving, retention cleanup.

### Phase 3 — Queue/worker hardening
- **Objective:** production-safe async processing.
- **Tasks:**
  - disable embedded workers in all non-dev envs,
  - move from DB polling queue to managed queue (or robust Postgres lease pattern),
  - add heartbeat + lease timeout recovery + max retry/dead-letter.
- **Output:** independent worker tier with predictable retries.
- **Risk:** duplicate processing during cutover.
- **Tests:** chaos retries, concurrent workers, idempotent job execution.

### Phase 4 — Runtime packaging for workers
- **Objective:** deterministic worker deploys with Python+Node.
- **Tasks:**
  - containerize worker runtime (single image including Python and pip install of `bulletproof_bt`),
  - pin Python dependency lock strategy,
  - add startup probe for bridge script + `bt` seam.
- **Output:** reproducible worker artifact deployable on Proxmox or managed container platform.
- **Risk:** image size/build time.
- **Tests:** worker smoke tests executing real bridge probe.

### Phase 5 — Auth/admin hardening
- **Objective:** reduce operational/security risk.
- **Tasks:**
  - keep credentials auth but add email verification + password reset flow,
  - add optional OAuth for operator/admin resilience,
  - migrate admin allowlist toward DB-backed roles/audit logs.
- **Output:** stronger account lifecycle and admin governance.
- **Risk:** migration edge cases for existing users.
- **Tests:** auth integration and admin authorization tests.

### Phase 6 — Stripe production readiness
- **Objective:** make billing resilient and auditable.
- **Tasks:**
  - ensure account linkage strategy between checkout + subscription events is deterministic,
  - add webhook replay tooling and alerting,
  - implement nightly reconciliation against Stripe API.
- **Output:** stable subscription truth + entitlement sync.
- **Risk:** entitlement drift.
- **Tests:** simulated event ordering permutations and duplicates.

### Phase 7 — CI/CD and env management
- **Objective:** repeatable deployments with safety checks.
- **Tasks:**
  - GitHub Actions for lint/test/build, worker smoke tests, migration checks,
  - separate dev/staging/prod env vars,
  - deploy gates requiring successful migrations and health checks.
- **Output:** reliable release pipeline.
- **Risk:** broken rollbacks without schema versioning discipline.
- **Tests:** staging promotions, rollback rehearsals.

### Phase 8 — Staging and launch
- **Objective:** realistic pre-prod dress rehearsal and controlled launch.
- **Tasks:**
  - staging parity with prod services,
  - load test queue and upload/report paths,
  - establish on-call runbooks, backup restore drill.
- **Output:** launch checklist sign-off.
- **Risk:** hidden infra bottlenecks.
- **Tests:** end-to-end synthetic analysis/export flows.

### Phase 9 — Post-launch optimization (~1k users)
- **Objective:** maintain reliability and headroom.
- **Tasks:** tune worker concurrency, add cache for benchmark manifest and static publication metadata, implement rate limits on upload/analysis APIs.
- **Output:** stable operations with predictable latency.
- **Risk:** cost spikes from heavy analysis workloads.
- **Tests:** capacity tests and monthly usage/billing audits.

### Phase 10 — Research Desk extensibility
- **Objective:** prepare for heavier agentic workflows.
- **Tasks:** introduce generic workflow/job model (multi-step state machine), artifact lineage model, and long-running task orchestration with resumable steps.
- **Output:** extensible async platform without re-platforming core web app.
- **Risk:** over-engineering too early.
- **Tests:** prototype agent workflow using same queue/storage primitives.

## 7) Initial scale plan (~1,000 users)

### Likely bottlenecks from current repo

1. SQLite write contention (analysis/job/export/webhook writes) under concurrent activity.
2. Single-host local storage throughput and durability for upload+export files.
3. Worker claim race/throughput ceiling from polling + non-lease queue model.
4. Python bridge process startup/CPU bound analysis execution per job.
5. Embedded worker contention with web request handling if left enabled.

### What must be async/off-request-path

- Keep upload parsing lightweight in request path; heavy analysis/export strictly async workers.
- All report/PDF generation remains worker-only.
- Stripe webhook handling can remain API-triggered but with durable event queueing and replay.

### Caching and durability requirements

- Cache benchmark manifest reads.
- Keep immutable analysis outputs and exports in object storage.
- Retain DB rows as source of truth for state transitions and auditability.

### What breaks first if unchanged

- First likely failure: multi-process deployment with SQLite+local files where web and workers do not share consistent disk/locks.
- Second likely: throughput and duplicate-claim edge cases when adding more worker instances.

## 8) Research Desk future-proofing plan

Design now (without full replatform):

- Standardize a **job orchestration envelope** beyond `analysis_jobs`/`export_jobs` so future agent tasks can be represented as typed workflow steps.
- Evolve artifact model from single upload/result blobs to lineage graph (input artifact -> derived datasets -> analysis outputs -> publications/reports).
- Keep API/app in same Next.js repo, but define worker task contracts that are language-agnostic (JSON schema + storage keys).
- Preserve Python seam behind adapter boundary so additional engines/agent tools can be inserted later.
- Introduce tenant-safe storage prefixes and scoped credentials now to avoid migration pain when Research Desk multi-agent workloads increase artifact volume.

## 9) Concrete next actions for the next 2 weeks

### Week 1

1. Add Postgres-backed persistence path behind repository interfaces; keep SQLite only for local dev fallback.
2. Implement S3-compatible object storage adapter and migrate upload/export writes.
3. Set `INVARIANCE_EMBEDDED_WORKERS=false` by default outside development.
4. Containerize analysis/export worker runtime including Python + `bt` probe in startup.

### Week 2

5. Introduce robust queue leasing (managed Redis queue preferred) and idempotent worker execution keys.
6. Add Stripe reconciliation cron + webhook failure alerting.
7. Add CI pipeline (lint/build/tests + migration check + worker smoke).
8. Stand up staging (Vercel web + managed Postgres + managed Redis + object storage + one worker instance) and run end-to-end validation.

