# Phase 8 — Launch Readiness, Scaling, Rich Exports, and Ops Maturity

## Worker/runtime architecture

Phase 8 introduces explicit worker runtime separation while preserving the durable DB-backed queue model.

- Queue producers still persist `analysis_jobs` / `export_jobs` and enqueue via queue services.
- Embedded worker execution is now controlled by `INVARIANCE_EMBEDDED_WORKERS` (default `true` for local/dev convenience).
- Standalone worker boot entrypoints are provided:
  - `npm run worker:analysis`
  - `npm run worker:export`
- Worker runtime loops poll queue jobs with configurable intervals:
  - `INVARIANCE_ANALYSIS_WORKER_POLL_MS`
  - `INVARIANCE_EXPORT_WORKER_POLL_MS`
- Workers now upsert heartbeat records into `worker_heartbeats`, enabling cross-process readiness visibility.

### Run modes

**Single-process local mode (default):**

```bash
npm run dev
```

**Launch-like split mode:**

```bash
INVARIANCE_EMBEDDED_WORKERS=false npm run dev
npm run worker:analysis
npm run worker:export
```

## Export formats and rendering

Exports remain queue-backed and durable, with metadata persisted in `exports` and runtime progress in `export_jobs`.

Supported formats:
- `json`
- `md`
- `pdf` (new)

The PDF renderer uses a deterministic lightweight generator suitable for launch report downloads without introducing heavyweight browser/rendering dependencies.

## Health/readiness model

`/api/health` now reports a tiered status model:

- `healthy`
- `degraded`
- `unhealthy`

Behavior:
- Liveness/readiness compatibility:
  - `healthy` + `degraded` => HTTP 200
  - `unhealthy` => HTTP 503
- Component checks include:
  - database
  - storage
  - stripe config
  - email config
  - engine import + seam
  - queue backlog signal
  - analysis/export worker heartbeat availability and staleness

The database and queue checks must be provider-aware:

- `DATABASE_PROVIDER=sqlite` uses the local SQLite runtime.
- `DATABASE_PROVIDER=postgres` uses the Postgres pool and must never call SQLite.

Worker staleness threshold is configurable with `INVARIANCE_WORKER_STALE_MS`.

## Production worker deployment

Use `deploy/docker-compose.worker.yml` from a host that has both repositories as siblings:

```text
/home/omenka/Projects/
  invariance_research/
  bulletproof_bt/
```

Override the root if needed:

```bash
INVARIANCE_STACK_ROOT=/srv/invariance docker compose -f deploy/docker-compose.worker.yml build
```

First launch defaults:

- `INVARIANCE_EMBEDDED_WORKERS=false` in Vercel.
- one `analysis-worker` container.
- one `export-worker` container.
- concurrency `1` for each worker.
- `LLM_INSIGHTS_ENABLED=false` unless Ollama has been explicitly tested.
- benchmark library read from object storage.

Worker startup:

```bash
cd deploy
cp .env.worker.example .env.worker
# Fill Supabase, R2, email, benchmark, and optional LLM values.
docker compose -f docker-compose.worker.yml up -d --build analysis-worker export-worker
```

Optional LLM support:

```bash
docker compose -f docker-compose.worker.yml --profile llm up -d ollama
docker exec -it invariance-ollama ollama pull qwen2.5:14b
```

Do not make the core analysis worker depend on Ollama for launch. LLM synthesis is an enhancement, not a prerequisite for deterministic validation.

## Stripe production hardening

The current Stripe integration uses Checkout, Customer Portal, signed webhooks, event idempotency, and internal entitlement snapshots. Before paid launch, complete both sides of the setup.

App requirements:

- Checkout sessions must set session metadata and subscription metadata with `account_id` and `plan_id`.
- Webhook events must be signature verified with `STRIPE_WEBHOOK_SECRET`.
- Webhook event ids must be persisted and replay-safe.
- Price ids must map to canonical internal plan ids on the server.
- Production health must flag missing live price ids or webhook secret.
- Entitlements must update from webhooks, not from the user returning to the billing page.
- Admin overrides must be explicit and auditable.

Stripe Dashboard requirements:

1. Create live products/prices:
   - Individual: `$39/month`
   - Pro: `$99/month`
   - Research Desk: quoted/manual invoice product
2. Set Vercel env vars:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_INDIVIDUAL`
   - `STRIPE_PRICE_PRO`
3. Create webhook endpoint:
   - `https://YOUR_DOMAIN/api/webhooks/stripe`
4. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Configure Customer Portal:
   - payment method update
   - cancellation
   - Individual to Pro upgrade
   - support link
   - terms link
6. Configure receipts, statement descriptor, invoice footer, tax/VAT stance, and support email.
7. Test in Stripe test mode before exposing paid CTAs.
8. Run one live internal checkout and cancellation test with an admin account.

If webhook delivery fails, the account can show a pending billing state, but the app must not grant or revoke paid rights from the client redirect alone.

## Vercel production environment

Required production env vars:

- `APP_URL`
- `DATABASE_PROVIDER=postgres`
- `DATABASE_URL`
- `INVARIANCE_EMBEDDED_WORKERS=false`
- `OBJECT_STORAGE_PROVIDER`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_FORCE_PATH_STYLE=true`
- `BENCHMARK_PROVIDER=object_storage`
- `BENCHMARK_MANIFEST_OBJECT_KEY`
- `BENCHMARK_OBJECT_PREFIX`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_INDIVIDUAL`
- `STRIPE_PRICE_PRO`
- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- email provider API key
- `ADMIN_EMAILS`
- session/auth secrets
- upload limits and rate-limit settings

Production must not set local-only paths as durable storage. Any `/home/...` path is acceptable only on the worker host as Docker build context or local scratch/cache, never as a production source of truth for user evidence.

## Admin/Ops refinements

Admin health and jobs/exports dashboards now expose stronger operational context:

- health snapshot includes worker status and queue backlog metadata
- jobs summary includes `overdue_processing`
- exports summary includes `pdf_exports`
- export rows now include retry/current-step/last-attempt metadata for triage

## Remaining known launch limitations

- Queue transport is still DB-backed (not Redis/BullMQ yet), but process separation and worker heartbeats are now launch-viable.
- PDF generation is intentionally lightweight (single-font report layout), not full template-grade pagination.
- Health checks are still live-evaluated on request; caching can be added if endpoint load grows materially.
- Locally hosted workers are acceptable for the first 100 users, but they need daily operator checks, fresh heartbeats, and clear restart/replay runbooks.
- Benchmark library production correctness depends on R2 materialization, not local cache presence.

## Recommended launch checklist

1. Set `INVARIANCE_EMBEDDED_WORKERS=false` in production web pods.
2. Run at least one dedicated `worker:analysis` and one dedicated `worker:export` process.
3. Verify `/api/health` returns `healthy` or expected `degraded` signals before opening traffic.
4. Confirm admin health shows fresh worker heartbeats.
5. Run a canary analysis + PDF export and verify download lifecycle.
6. Ensure retention sweep is scheduled and monitored.
7. Validate Stripe webhook + entitlement checks in a staging-like environment.
8. Verify benchmark manifest and datasets exist in R2.
9. Verify signup verification/password reset emails in production.
10. Verify admin and non-admin access boundaries.
