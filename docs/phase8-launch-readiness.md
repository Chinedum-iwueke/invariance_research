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
  - engine import + seam
  - queue backlog signal
  - analysis/export worker heartbeat availability and staleness

Worker staleness threshold is configurable with `INVARIANCE_WORKER_STALE_MS`.

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

## Recommended launch checklist

1. Set `INVARIANCE_EMBEDDED_WORKERS=false` in production web pods.
2. Run at least one dedicated `worker:analysis` and one dedicated `worker:export` process.
3. Verify `/api/health` returns `healthy` or expected `degraded` signals before opening traffic.
4. Confirm admin health shows fresh worker heartbeats.
5. Run a canary analysis + PDF export and verify download lifecycle.
6. Ensure retention sweep is scheduled and monitored.
7. Validate Stripe webhook + entitlement checks in a staging-like environment.
