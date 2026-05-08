# Deployment Readiness Phase 2 and Phase 3

This phase hardens storage and worker execution for production deployment on Vercel, Supabase Postgres, and S3-compatible object storage.

## Object Storage

The production adapter lives in `src/lib/server/storage/object-storage.ts`.

Supported providers:

- `OBJECT_STORAGE_PROVIDER=local`
- `OBJECT_STORAGE_PROVIDER=s3`
- `OBJECT_STORAGE_PROVIDER=r2`

Required env vars for `s3` and `r2`:

```bash
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_PUBLIC_BASE_URL=
OBJECT_STORAGE_FORCE_PATH_STYLE=
OBJECT_STORAGE_SIGNING_SECRET=
```

Provider selection is config-only. `r2` uses the Cloudflare S3-compatible endpoint through `OBJECT_STORAGE_ENDPOINT`. `OBJECT_STORAGE_FORCE_PATH_STYLE=true` is supported when the provider requires it.

The app does not import the AWS SDK outside the adapter.

## Durable Key Layout

New files use deterministic namespaces:

```text
uploads/{account_id}/{artifact_id}/{filename}
analysis-artifacts/{account_id}/{analysis_id}/{filename}
reports/{account_id}/{analysis_id}/{filename}
publications/{publication_id}/{filename}
publication-covers/{publication_id}/{filename}
```

Original filenames remain metadata. Keys are never based only on raw user filenames.

## File Categories on Object Storage

The following now write through `ObjectStorage`:

- uploads via `src/lib/server/services/upload-intake-service.ts`
- legacy report/export assets via `src/lib/server/workers/export-worker.ts`
- publication PDFs and covers via `src/lib/server/publications/repository.ts`

Publication records now also store:

- `pdf_storage_key`
- `cover_storage_key`

The public asset route is still `/api/publications/assets/...`, but it now resolves stored object keys and redirects to a signed URL or public object URL depending on access mode.

## Signed Downloads

Signed-read support is used for:

- `/api/artifacts/[id]/download`
- `/api/exports/[id]/download`
- publication asset reads when the asset is not intentionally public

Behavior:

- authorization is checked before any signed URL is issued
- signed URLs expire after a short TTL
- credentials are never exposed to the client
- the UI only sees internal app routes; object keys stay behind the route boundary

For local development, signed reads resolve to `/api/object-storage/signed` using an HMAC token, so local storage follows the same access pattern as S3/R2.

## Local File Migration

Migration script:

```bash
npm run migrate:object-storage -- --sqlite=.data/invariance.sqlite --dry-run
OBJECT_STORAGE_PROVIDER=s3 OBJECT_STORAGE_BUCKET=... npm run migrate:object-storage -- --sqlite=.data/invariance.sqlite
```

The script migrates:

- upload artifacts
- legacy export/report assets
- publication PDFs and covers

It reports `migrated`, `skipped`, and `missing` counts and is safe to rerun for records that already use the target key.

## Worker Execution

Runtime config is enforced in `src/lib/server/queue/runtime-config.ts`.

Env vars:

```bash
WORKER_MODE=embedded|external
ALLOW_EMBEDDED_WORKERS=true|false
```

Rules:

- embedded workers are allowed only in local development
- staging and production must use `WORKER_MODE=external`
- `NODE_ENV=production` with embedded workers configured throws a startup/config error
- web routes enqueue jobs and read status only

## External Worker

Run the production worker separately from the web app:

```bash
npm run worker:analysis
```

The worker:

- polls and leases jobs independently
- reads uploaded artifact bytes through `ObjectStorage`
- writes outputs through repositories and object storage
- logs structured events
- exits cleanly on `SIGTERM` and `SIGINT`

## Queue Semantics

The Postgres path continues to use `SELECT ... FOR UPDATE SKIP LOCKED` for claims.

The queue now supports:

- enqueue
- lease / claim
- complete / ack
- retry with backoff
- expired lease reclaim
- `max_attempts` caps
- dead-letter status
- status inspection for failed and dead-letter jobs

Default retry cap is `3` unless a job carries a more specific value.

## Local vs Production

Local development:

- `OBJECT_STORAGE_PROVIDER=local`
- `DATABASE_PROVIDER=sqlite` or `postgres`
- `WORKER_MODE=embedded` optionally
- `ALLOW_EMBEDDED_WORKERS=true`

Staging or production:

- `DATABASE_PROVIDER=postgres`
- `DATABASE_URL=...`
- `OBJECT_STORAGE_PROVIDER=s3` or `r2`
- `WORKER_MODE=external`
- `ALLOW_EMBEDDED_WORKERS=false`

## Out of Scope

Still intentionally out of scope:

- expanding export functionality in the public product
- Redis/Upstash queue implementation
- Kubernetes or container orchestration rollout
- Research Desk worker topology
