# Production Worker Stack

This stack runs the external `analysis-worker`, `export-worker`, `experiment-worker`, and `execution-worker` services for the Vercel web app. Production analysis and exchange supervision must not depend on Vercel request lifetimes or embedded workers.

The launch target is:

- Web app on Vercel.
- On-prem Postgres as the shared queue, account, analysis, export, and share database. See [ON_PREM_POSTGRES_RUNBOOK.md](./ON_PREM_POSTGRES_RUNBOOK.md) for the VM/PgBouncer design and cutover procedure.
- Cloudflare R2 as object storage for uploads, reports, exports, and benchmark library objects.
- Locally hosted worker containers with `bulletproof_bt` installed into the image.
- The experiment worker materializes approved Research Program experiment contracts through `bt experiment execute` and stores the run-config, manifest, verdict, and log artifacts.
- The execution worker validates encrypted Binance/Bybit spot or perpetual connectors in demo or bounded live-canary environments, consumes idempotent deployment commands, and reconciles exchange-authoritative balances, orders, fills, and positions.
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
- `DATABASE_URL` using the on-prem PgBouncer runtime endpoint, for example `postgresql://invariance_worker:URL_ENCODED_WORKER_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true`.
- `POSTGRES_POOL_MAX=2` for the worker host until on-prem pool capacity is measured. Keep Vercel at `POSTGRES_POOL_MAX=1`.
- `INVARIANCE_WORKER_DB_ERROR_BACKOFF_MS=300000` so worker loops pause for five minutes on database auth, TLS, DNS, or connection failures instead of retrying aggressively.
- `OBJECT_STORAGE_*` using a Cloudflare R2 key scoped to the production bucket
- `OBJECT_STORAGE_LIFECYCLE_CONFIGURED=true` only after R2 lifecycle rules have been configured and verified
- `BENCHMARK_PROVIDER=object_storage`
- `BENCHMARK_OBJECT_PREFIX`
- `BENCHMARK_MANIFEST_OBJECT_KEY`
- `EMAIL_PROVIDER`, `EMAIL_FROM`, and provider API key if worker-side email is enabled
- `LLM_INSIGHTS_ENABLED=false` for the first production wedge unless Ollama has been explicitly provisioned
- `LLM_CREDENTIAL_ENCRYPTION_KEY` if any worker or server process needs to decrypt user-supplied LLM provider keys. Use the same 32+ character secret on Vercel and any trusted worker that performs assistant inference. Do not put quotes around the value in Vercel.

Benchmark env vars must be set on both Vercel and the worker host. Vercel resolves and persists the selected benchmark; the worker materializes the actual dataset and passes its worker-local path to the engine. If the worker host is missing `BENCHMARK_PROVIDER=object_storage` or R2 credentials, selected benchmarks will be disabled during analysis even when the UI accepted the selection.

Keep `deploy/.env.worker` untracked. Rotate any key that was copied into logs, screenshots, chat, or a shared machine.

## Assistant Provider Layer

Research Desk supports two inference modes at this stage:

- Hosted Invariance inference: set `LLM_RESEARCH_ASSISTANT_ENABLED=true`, `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` on Vercel. Assistant turns use the platform key unless the account has an active BYOK connector.
- OpenAI BYOK: a signed-in user opens `Settings -> AI Provider`, pastes an OpenAI API key, chooses a model such as `gpt-4.1-mini`, and clicks `Save and use OpenAI`. The app verifies the key, stores only encrypted ciphertext plus a key hint, and routes future Research Desk copilot turns for that account through the user's key.

Required Vercel variables for BYOK:

```env
LLM_CREDENTIAL_ENCRYPTION_KEY=your-32-plus-character-random-secret
```

Required Vercel variables for hosted inference:

```env
LLM_RESEARCH_ASSISTANT_ENABLED=true
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

If hosted inference is disabled and no BYOK connector exists, the Research Desk assistant falls back to deterministic research drafts. Invariance still owns source retrieval, citations, tool authorization, typed object validation, and approval gates; the model provider only supplies reasoning text and structured proposals.

## B12 Production Controls

The platform has env-driven kill switches. Set the relevant value to `true`, redeploy/restart the affected service, and Admin Health will show the paused surface.

```bash
INVARIANCE_PLATFORM_PAUSED=true          # pause all new queue/assistant intake
INVARIANCE_QUEUE_PAUSED=true             # pause all queues
INVARIANCE_ANALYSIS_QUEUE_PAUSED=true    # pause new audit analyses
INVARIANCE_EXPORT_QUEUE_PAUSED=true      # pause new report exports
INVARIANCE_EXPERIMENT_QUEUE_PAUSED=true  # pause new research experiments
INVARIANCE_ASSISTANT_PAUSED=true         # pause assistant-generated briefs/specs/plans
```

Use these switches before risky deploys, during worker incidents, when database pool saturation appears, or when R2 writes are failing. Existing records remain inspectable; the switches stop new intake rather than deleting queued work.

Rate limits are enabled by default. For first users keep these conservative:

```bash
RATE_LIMITS_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_UPLOAD_MAX=20
RATE_LIMIT_ANALYSIS_CREATE_MAX=10
RATE_LIMIT_EXPORT_MAX=20
RATE_LIMIT_PROGRAM_WRITE_MAX=30
RATE_LIMIT_ASSISTANT_MAX=20
RATE_LIMIT_EXPERIMENT_QUEUE_MAX=10
```

## Object Storage Lifecycle

Configure lifecycle rules in Cloudflare R2 before setting `OBJECT_STORAGE_LIFECYCLE_CONFIGURED=true`.

Recommended launch policy:

- Keep user uploads, immutable analysis artifacts, program reports, and share-room artifacts until product retention policy deletes them explicitly.
- Expire temporary export files after the export retention window.
- Expire benchmark staging or temporary refresh objects after 7-14 days.
- Do not expire `benchmarks/manifest.v1.yaml` or current benchmark parquet objects automatically.

Admin Health reports `storage_lifecycle=degraded` until this is acknowledged through the env var.

## Benchmark Library Refresh

The admin Maintenance page exposes a `Refresh benchmark library` button. Run it only from an environment that has Python, pandas/parquet support, network egress, and production R2 credentials. It executes the same weekly command sequence below.

Manual refresh from the worker/admin VM:

```bash
cd /opt/invariance_research
set -a
source deploy/.env.worker
set +a
npm run benchmarks:weekly
```

Equivalent expanded commands:

```bash
npm run benchmarks:update
npm run benchmarks:sync-object-storage
```

Expected result: local benchmark parquet files are refreshed, `manifest.v1.yaml` is rebuilt, and `benchmarks/manifest.v1.yaml` plus the benchmark parquet files are uploaded to the configured R2 bucket. After refresh, verify `/api/benchmark-library/health` and Admin Health show an object-storage benchmark provider with a valid manifest.

## Database Readiness

Before starting workers:

1. Confirm Vercel production and workers point at the same on-prem production database.
2. Apply the production schema before accepting jobs:

   ```bash
   cd /opt/invariance_research
   set -a
   source deploy/.env.worker
   set +a
   npm run db:init:postgres
   ```

   Keep `POSTGRES_SCHEMA_AUTO_INIT=false` for normal web and worker runtime. The command above performs an explicit one-shot schema initialization; request-time schema mutation should stay disabled in production.
3. Confirm queue/control tables exist: `analysis_jobs`, `export_jobs`, `experiment_jobs`, `exchange_connectors`, `strategy_deployments`, `deployment_commands`, `deployment_events`, `deployment_projections`, and `worker_heartbeats`.
4. Confirm the web app uses `INVARIANCE_EMBEDDED_WORKERS=false` in production.

The workers lease jobs from Postgres. Multiple workers are only safe when queue leasing and heartbeat behavior have been verified in staging.

### Database auth and connection recovery

If Postgres or PgBouncer returns repeated auth, DNS, TLS, or connection failures, treat this as an active incident: at least one app, worker, or healthcheck is still using bad database credentials, a bad host, a bad SSL mode, or stale deployment environment variables.

Immediate recovery:

```bash
cd /srv/invariance/invariance_research

INVARIANCE_STACK_ROOT=/srv/invariance \
docker compose -f deploy/docker-compose.worker.yml down
```

Then verify `deploy/.env.worker` before restarting:

```bash
grep -E "DATABASE_PROVIDER|DATABASE_URL|POSTGRES_POOL_MAX|POSTGRES_SCHEMA_AUTO_INIT|INVARIANCE_WORKER_DB_ERROR_BACKOFF_MS" deploy/.env.worker
```

Expected production shape:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://invariance_worker:URL_ENCODED_WORKER_PASSWORD@db.invarianceresearch.xyz:6432/invariance_research?sslmode=require&uselibpqcompat=true
POSTGRES_POOL_MAX=2
POSTGRES_SCHEMA_AUTO_INIT=false
INVARIANCE_WORKER_DB_ERROR_BACKOFF_MS=300000
```

After correcting credentials, confirm the database endpoint is reachable, then restart:

```bash
INVARIANCE_STACK_ROOT=/srv/invariance \
docker compose -f deploy/docker-compose.worker.yml up -d --build analysis-worker export-worker experiment-worker execution-worker
```

Do not repeatedly run `db:init:postgres` during the circuit-breaker window. If schema initialization already printed `Postgres schema is initialized.`, schema is not the problem.

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
docker compose -f docker-compose.worker.yml up -d --build analysis-worker export-worker experiment-worker execution-worker
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

```bash
docker logs -f invariance-experiment-worker
```

```bash
docker logs -f invariance-execution-worker
```

## Exchange Connector Safety

- Use different API keys for demo/testnet and live. Endpoint/environment crossing is rejected.
- Enable read and trade permission only. Withdrawal permission must remain disabled.
- Restrict keys by the execution worker's egress IP where supported.
- Set `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` to the same dedicated random value on Vercel and the execution worker. Rotating it requires re-encrypting existing connector records.
- Exchange API keys are not worker or Vercel environment variables. Each user enters an API key and secret through the connector form; the values are encrypted before persistence, never returned to the browser, and only decrypted inside the execution worker. Credential rotation is write-only and replaces both values atomically.
- Create separate connectors when an exchange issues different credentials for spot, perpetual, demo/testnet, or live. Product type and environment are immutable parts of the connector identity, so a demo key cannot be silently reused against a live endpoint.
- Apply Postgres migrations 33 through 38 before starting the updated execution worker. Migrations 35-38 add canary promotion evidence, approved safety policies, incidents and alert delivery, recovery drills, immutable portfolio/audit state, memory-policy evaluation, private-stream sessions, and connector certification.
- Connector secrets are encrypted before persistence, never returned by APIs, and passed to `bulletproof_bt` over child-process stdin rather than command arguments.
- Live remains a bounded canary: approved qualification, a successful demo promotion, exact hash pinning, explicit `LIVE CANARY` confirmation, clean reconciliation, an authenticated private stream, a tested emergency freeze, and conservative risk limits are mandatory.
- REST remains the authoritative restart/reconciliation source. Binance and Bybit connector diagnosis now authenticates the real private stream; a connector is blocked when private authentication fails.
- Set `EXECUTION_INCIDENT_WEBHOOK_URL` and a random `EXECUTION_INCIDENT_WEBHOOK_SECRET` to deliver critical incidents outside the app. Receivers must verify `x-invariance-signature` against the raw body and deduplicate `x-invariance-delivery`.
- Follow [INCIDENT_RUNBOOK_EXECUTION.md](./INCIDENT_RUNBOOK_EXECUTION.md) for freeze, reconciliation, recovery, and credential incidents.

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

All workers run `scripts/healthcheck-worker.ts`.

Expected checks:

- Postgres connectivity.
- Object storage connectivity.
- Worker heartbeat updates in the database.
- Engine bridge probe for the analysis worker.
- `bt experiment validate` contract probe for the experiment worker.

The web app admin health page should show:

- database provider as Postgres
- queue backlog
- analysis worker heartbeat
- export worker heartbeat
- experiment worker heartbeat
- object storage health
- benchmark library health
- Stripe config health
- email config health

If admin health reports no fresh worker heartbeat, do not accept paid production analyses until the worker is restarted or the queue is explicitly paused.

## Stuck Job Recovery

If Admin Jobs shows overdue processing jobs:

1. Inspect the worker logs for the affected worker.
2. Set the relevant queue kill switch if the failure is still active.
3. Run Admin Maintenance -> `Recover stale processing jobs`, or call:

   ```bash
   curl -X POST -H "Cookie: <admin-session-cookie>" https://your-domain.example/api/admin/maintenance/stale_processing_jobs
   ```

The recovery action requeues stale processing analysis, export, and experiment jobs when they have retry budget left. It does not delete artifacts or mutate completed jobs.

If recovery repeatedly requeues the same job, leave the queue paused and inspect the job error/event trail before retrying again.

## Rebuild

Rebuild after changing app code, worker scripts, engine code, or Python dependencies:

```bash
docker compose -f docker-compose.worker.yml up -d --build analysis-worker export-worker experiment-worker
```

## Stop

```bash
docker compose -f docker-compose.worker.yml down
```

## Smoke Test

Before opening production to users:

1. Deploy the Vercel build with production env vars.
2. Start `analysis-worker`, `export-worker`, and `experiment-worker`.
3. Confirm fresh worker heartbeats in Admin Ops.
4. Upload a small reference trade CSV through the production UI.
5. Confirm the queued analysis is leased by `analysis-worker`.
6. Confirm generated artifacts are written to R2.
7. Open the validation report page.
8. Request an export.
9. Confirm `export-worker` renders and persists the export.
10. Download the export from the UI.
11. Create a Research Program, approve a strategy spec, generate and approve an experiment plan, then queue one item.
12. Confirm `experiment-worker` claims the job, stores artifacts in R2 under `analysis-artifacts/<account>/programs/<program>/experiments/<job>/`, and marks the job completed.

## Launch Defaults

Use conservative first-user settings:

- one analysis worker
- one export worker
- one experiment worker
- analysis concurrency `1`
- export concurrency `1`
- experiment concurrency `1`
- embedded web workers disabled
- LLM synthesis disabled unless deliberately tested
- benchmark library read from object storage
- production keys scoped by environment

Scale only after staging proves duplicate leasing, stale heartbeat recovery, retry behavior, and R2 write consistency.

## First-100-User Monitoring Checklist

Check Admin Health at least daily during the first private cohort:

- overall health is not `unhealthy`
- all three worker heartbeats are fresh
- queue backlog is not growing for more than one worker poll interval
- overdue processing jobs are zero
- rate-limit events are explainable
- storage lifecycle is acknowledged
- Stripe and email checks are healthy in production
- benchmark manifest cache is warm when benchmark comparisons are enabled

Check Admin Jobs for repeated failures before inviting more users. Check Admin Audit Log when specs are approved, accounts are overridden, or maintenance actions are run.
