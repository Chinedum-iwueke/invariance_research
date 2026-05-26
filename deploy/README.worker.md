# Production Worker Stack

This stack runs the external `analysis-worker` and `export-worker` services for the Vercel web app. Production analysis must not depend on Vercel request lifetimes or embedded workers.

The launch target is:

- Web app on Vercel.
- Supabase Postgres as the shared queue, account, analysis, export, and share database.
- Cloudflare R2 as object storage for uploads, reports, exports, and benchmark library objects.
- Locally hosted worker containers with `bulletproof_bt` installed into the image.
- Optional local Ollama only when LLM synthesis is explicitly enabled.

## Repository Layout

The Docker build context must contain both repositories as siblings:

```text
/home/omenka/Projects/
  invariance_research/
  bulletproof_bt/
```

The default Compose context is `/home/omenka/Projects`. Override it when needed:

```bash
INVARIANCE_STACK_ROOT=/srv/invariance docker compose -f docker-compose.worker.yml build
```

Inside the image, `bulletproof_bt` is installed editable into `/opt/venv`, and the app calls the engine through `/opt/invariance_research/scripts/run_bulletproof_engine.py`.

## Environment

Create the worker environment file on the worker host:

```bash
cp deploy/.env.worker.example deploy/.env.worker
```

Fill real values for:

- `DATABASE_PROVIDER=postgres`
- `DATABASE_URL` using the Supabase production connection string
- `OBJECT_STORAGE_*` using a Cloudflare R2 key scoped to the production bucket
- `BENCHMARK_PROVIDER=object_storage`
- `BENCHMARK_OBJECT_PREFIX`
- `BENCHMARK_MANIFEST_OBJECT_KEY`
- `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider API key if worker-side email is enabled
- `LLM_INSIGHTS_ENABLED=false` for the first production wedge unless Ollama has been explicitly provisioned

Benchmark env vars must be set on both Vercel and the worker host. Vercel resolves and persists the selected benchmark; the worker materializes the actual dataset and passes its worker-local path to the engine. If the worker host is missing `BENCHMARK_PROVIDER=object_storage` or R2 credentials, selected benchmarks will be disabled during analysis even when the UI accepted the selection.

Keep `deploy/.env.worker` untracked. Rotate any key that was copied into logs, screenshots, chat, or a shared machine.

## Database Readiness

Before starting workers:

1. Confirm Vercel production and workers point at the same Supabase production database.
2. Apply the production schema/migration path before accepting jobs.
3. Confirm queue tables exist: `analysis_jobs`, `export_jobs`, and `worker_heartbeats`.
4. Confirm the web app uses `INVARIANCE_EMBEDDED_WORKERS=false` in production.

The workers lease jobs from Postgres. Multiple workers are only safe when queue leasing and heartbeat behavior have been verified in staging.

## Object Storage Readiness

The R2 key used by workers needs read/write/delete/list access for the production bucket paths used by:

- uploaded artifacts
- generated reports
- export files
- report share assets
- benchmark library manifest and object keys

For launch, use a dedicated R2 access key for the worker host. Do not reuse a personal Cloudflare admin key.

## Start

Run from this `deploy/` directory:

```bash
docker compose -f docker-compose.worker.yml up -d --build analysis-worker export-worker
```

Check containers:

```bash
docker ps
```

Follow logs:

```bash
docker logs -f invariance-analysis-worker
```

```bash
docker logs -f invariance-export-worker
```

## Optional Ollama

Core launch analysis should work with `LLM_INSIGHTS_ENABLED=false`. If you intentionally enable LLM synthesis, start the optional profile:

```bash
docker compose -f docker-compose.worker.yml --profile llm up -d ollama
```

Pull the configured model:

```bash
docker exec -it invariance-ollama ollama pull qwen2.5:14b
```

Then set `LLM_INSIGHTS_ENABLED=true` and restart `analysis-worker`.

## Health Checks

Both workers run `scripts/healthcheck-worker.ts`.

Expected checks:

- Postgres connectivity.
- Object storage connectivity.
- Worker heartbeat updates in the database.
- Engine bridge probe for the analysis worker.

The web app admin health page should show:

- database provider as Postgres
- queue backlog
- analysis worker heartbeat
- export worker heartbeat
- object storage health
- benchmark library health
- Stripe config health
- email config health

If admin health reports no fresh worker heartbeat, do not accept paid production analyses until the worker is restarted or the queue is explicitly paused.

## Rebuild

Rebuild after changing app code, worker scripts, engine code, or Python dependencies:

```bash
docker compose -f docker-compose.worker.yml up -d --build analysis-worker export-worker
```

## Stop

```bash
docker compose -f docker-compose.worker.yml down
```

## Smoke Test

Before opening production to users:

1. Deploy the Vercel build with production env vars.
2. Start `analysis-worker` and `export-worker`.
3. Confirm fresh worker heartbeats in Admin Ops.
4. Upload a small reference trade CSV through the production UI.
5. Confirm the queued analysis is leased by `analysis-worker`.
6. Confirm generated artifacts are written to R2.
7. Open the validation report page.
8. Request an export.
9. Confirm `export-worker` renders and persists the export.
10. Download the export from the UI.

## Launch Defaults

Use conservative first-user settings:

- one analysis worker
- one export worker
- analysis concurrency `1`
- export concurrency `1`
- embedded web workers disabled
- LLM synthesis disabled unless deliberately tested
- benchmark library read from object storage
- production keys scoped by environment

Scale only after staging proves duplicate leasing, stale heartbeat recovery, retry behavior, and R2 write consistency.
