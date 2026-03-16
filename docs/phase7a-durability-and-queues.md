# Phase 7A — Durability and Queue Hardening

## Durable persistence architecture

Phase 7A replaces transitional in-memory maps with SQLite-backed repositories using `node:sqlite`.

- Database bootstrap: `src/lib/server/persistence/database.ts`
- Migration definitions: `src/lib/server/persistence/migrations.ts`
- Durable repositories now cover:
  - users/accounts/subscriptions/entitlements/usage
  - artifacts/analyses/analysis_jobs
  - webhook_events

Migrations include IDs, timestamps, foreign keys, and queue/webhook indexes to keep integrity and replay safety.

## Queue and worker architecture

Analysis execution now follows enqueue -> worker -> persist:

1. Route handler calls analysis service.
2. Analysis service persists analysis + `analysis_jobs` row and enqueues work.
3. Queue producer (`src/lib/server/queue/analysis-queue.ts`) marks jobs as queued and schedules worker processing.
4. Worker (`src/lib/server/workers/analysis-worker.ts`) claims queued jobs, updates progress/step state, runs the engine seam, normalizes output, and persists terminal state.

No heavy engine execution is performed inside request handlers.

## Job lifecycle

Persisted job lifecycle:

- `queued` (with `available_at` for backoff)
- `processing` (with `started_at`, `last_attempt_at`)
- `completed` (with `finished_at`, persisted AnalysisRecord)
- `failed` (with persisted structured code + product-safe message)

Retries use persisted job metadata and apply backoff. `analysis.retry` behavior is represented by re-queueing failed jobs with incremented `retry_count` and delayed `available_at`.

## Webhook receipt and idempotency model

Stripe webhook flow now persists every receipt in `webhook_events` before applying side effects.

Receipt fields include:

- `provider_event_id`
- `event_type`
- `received_at`
- `processed_at`
- `status`
- `attempt_count`
- `error_summary`

Processing rules:

- Duplicate `provider_event_id` receipts are safely no-op'd if already processed.
- New or failed events are attempted once per receipt call.
- Success marks event `processed`; failures persist `failed` plus summary.

This guarantees replay-safe subscription/account reconciliation.

## What remains for Phase 7B

- Dedicated external queue transport (e.g., BullMQ + Redis) and horizontally scaled worker processes.
- Dead-letter queue semantics and richer retry policies.
- Operational observability expansion (worker metrics, webhook latency/failure dashboards).
- Export generation durability and async workerization.
