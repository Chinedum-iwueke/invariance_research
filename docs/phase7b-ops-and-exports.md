# Phase 7B — Exports and Operational Hardening

## Export architecture

Export generation is fully queue-backed and never runs inline in request handlers.

Flow:

1. `POST /api/analyses/:id/exports` calls export service.
2. Service validates analysis ownership/completion and export entitlement.
3. Service persists `exports` + `export_jobs` records and enqueues work.
4. Export worker claims queued jobs, renders report payload (`json`/`md`/`pdf`), stores file via storage abstraction, and updates durable status.
5. `GET /api/exports/:id` exposes export status; `GET /api/exports/:id/download` streams authorized binary payload.

## Storage hardening model

Storage is now abstracted through `ObjectStorage` (`src/lib/server/storage/object-storage.ts`) and currently backed by local filesystem for dev.

Design supports future S3/object-store adapters with the same interface (`putObject/getObject/deleteObject/objectExists`).

Metadata is persisted separately from binary payloads:

- `storage_key`
- `content_type`
- `file_size_bytes`
- `checksum_sha256`

Uploads and exports both use this abstraction.

## Health checks and startup validation

Added startup/health checks for:

- database connectivity
- storage write/delete probe
- Stripe configuration presence
- engine importability (`bt`)
- engine seam existence (`run_analysis_from_parsed_artifact`)
- engine version signal
- queue readiness (db-backed queue in current architecture)

Exposed via `GET /api/health`, returning component-level check details and 200/503 status.

## Logging and observability approach

Added structured JSON logging (`src/lib/server/ops/logger.ts`) and instrumented:

- analysis queue enqueue/worker claim/completion/failure
- export request and export worker completion/failure
- webhook idempotent no-op, success, and failure
- startup validation completion
- export entitlement denial
- retention cleanup runs

## Retention and background maintenance

Added maintenance services:

- expired export cleanup (metadata + stored binary)
- stale failed job cleanup for analysis/export jobs

Exposed a sweep trigger endpoint `POST /api/maintenance/sweep` for cron/ops integration.

## Remaining production-readiness gaps

- Queue remains in-process DB-backed; Phase 7C can move export jobs to external workers (BullMQ/Redis) for horizontal scaling.
- Health endpoint currently performs live checks on request; launch readiness now classifies healthy/degraded/unhealthy and includes worker heartbeats. Add caching/rate limiting if needed.
- Export formats are intentionally minimal (`json`/`md`/`pdf`) and can be extended to richer PDF rendering in a dedicated worker stage.
