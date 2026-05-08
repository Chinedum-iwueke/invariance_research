# Deployment Readiness Phase 0 and Phase 1

This rollout freezes the app-facing contracts for the analysis lifecycle while keeping the current local development path intact.

## Phase 0 Contracts

### Repository Contract

Core repository contracts live in `src/lib/server/persistence/contracts.ts`.

The contracts separate read/write repositories from query-only surfaces through a `mode` field and define transaction support through `TransactionRunner`. The current SQLite repositories remain the active local implementation:

- accounts, users, subscriptions, entitlements, and usage: `src/lib/server/accounts/repositories.ts`
- analyses: `src/lib/server/repositories/analysis-repository.ts`
- analysis jobs: `src/lib/server/repositories/job-repository.ts`
- parsed artifact metadata: `src/lib/server/repositories/artifact-repository.ts`
- repository provider selection: `src/lib/server/persistence/repositories.ts`

`DATABASE_PROVIDER=sqlite|postgres` selects the database provider. In `postgres` mode, direct calls to `getDb()` throw so staging/prod do not silently write to SQLite.

### ObjectStorage Contract

The provider-neutral interface is in `src/lib/server/storage/object-storage.ts`.

Required operations:

- `putObject`
- `getObject`
- `deleteObject`
- `objectExists`
- optional `getSignedReadUrl`
- optional `getSignedWriteUrl`
- optional `listObjects` / `listByPrefix`
- optional `resolvePublicUrl`

Metadata includes content type, size, checksum, created time, and updated time when available.

Provider selection:

```bash
OBJECT_STORAGE_PROVIDER=local|s3|r2
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_REGION=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
OBJECT_STORAGE_PUBLIC_BASE_URL=
```

Local development uses `LocalFilesystemObjectStorage` through `OBJECT_STORAGE_PROVIDER=local` and `INVARIANCE_STORAGE_ROOT`.

AWS S3 uses `OBJECT_STORAGE_PROVIDER=s3`, bucket, region, and access keys. Cloudflare R2 uses `OBJECT_STORAGE_PROVIDER=r2` plus its account-specific S3 endpoint in `OBJECT_STORAGE_ENDPOINT`. The app-facing adapter is shared so switching between S3 and R2 is config-only. The full runtime S3 client is intentionally not required in Phase 1 validation while local filesystem storage remains in place.

### Queue Contract

The analysis queue contract lives in `src/lib/server/queue/contracts.ts`.

Required operations:

- `enqueue`
- `lease`
- `ack`
- `complete`
- `retry`
- `deadLetter`
- `heartbeat` / `extendLease`
- `getJobStatus`
- `listFailed`
- `listDeadLetters`

The current implementation is DB-backed in `src/lib/server/queue/db-analysis-queue.ts`. Provider selection is in `src/lib/server/queue/provider.ts`:

```bash
ANALYSIS_QUEUE_PROVIDER=db|upstash
```

`upstash` is a reserved provider for a future Redis-backed queue. Future env vars are expected to include:

```bash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Supabase Postgres Setup

Use:

```bash
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
```

Get `DATABASE_URL` from the Supabase project database settings.

Use the direct connection string for workers and migration jobs because they may hold transactions while claiming jobs. For Vercel web requests, use Supabase's pooled connection string when request volume is high, but keep long-running worker claim loops on direct connections if pooling interferes with transaction semantics.

The Postgres schema is captured in `src/lib/server/persistence/postgres-schema.ts`. Analysis job claiming is implemented in `src/lib/server/repositories/postgres-analysis-job-repository.ts` with:

```sql
SELECT ... FOR UPDATE SKIP LOCKED
```

The selected row is updated to `processing`, assigned `leased_until`, and returned from the same transaction. Expired `processing` leases are claimable again. Failed jobs retry until `max_attempts`, then move to `dead_letter`.

## SQLite to Postgres Migration

Script:

```bash
npx tsx scripts/migrate-sqlite-to-postgres.ts --sqlite=.data/invariance.sqlite --dry-run
DATABASE_URL=postgresql://... npx tsx scripts/migrate-sqlite-to-postgres.ts --sqlite=.data/invariance.sqlite
```

The script migrates core tables when present:

- users
- accounts
- subscriptions
- entitlement snapshots
- usage snapshots
- artifacts
- analyses
- analysis jobs
- webhook events
- publications
- waitlist entries

It preserves IDs, timestamps, JSON payloads, and reports row counts per table. It uses upsert behavior and is safe to rerun for the listed primary-key based tables.

Local files are not migrated to object storage in this phase.

## Staging Validation

Phase 1 staging should use:

```bash
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
OBJECT_STORAGE_PROVIDER=local
ANALYSIS_QUEUE_PROVIDER=db
```

Validate:

- signup, login, and session behavior
- upload artifact metadata
- create analysis
- enqueue analysis job
- worker claims job through Postgres
- analysis result persists
- dashboard loads from Postgres
- no SQLite writes happen in Postgres mode

## Tests

Local contract tests:

```bash
npx tsx --test tests/deployment-readiness-contracts.test.ts
npx tsx --test tests/migration-dry-run.test.ts
```

Postgres-specific claim concurrency tests require a running Supabase/Postgres-compatible database and the optional `pg` package installed:

```bash
DATABASE_PROVIDER=postgres DATABASE_URL=postgresql://... npx tsx --test tests/deployment-readiness-contracts.test.ts
```

## Out of Scope

The current rollout is analysis lifecycle only.

Explicitly out of scope:

- export worker expansion or new export lifecycle contracts
- full object storage migration
- Kubernetes orchestration
- Docker/worker orchestration at scale
- Research Desk workers
