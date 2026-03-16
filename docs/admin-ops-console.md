# Admin / Ops Console

## Admin access model (V1)

The admin layer uses the existing auth/session system and a strict server-side allowlist guard.

- `requireAdminSession()` wraps `requireServerSession()` and checks identity against:
  - `ADMIN_EMAILS` (comma-separated emails)
  - `ADMIN_USER_IDS` (comma-separated user ids)
- All `/app/admin/*` routes are protected via `src/app/app/admin/layout.tsx`.
- All admin mutation APIs (`/api/admin/*`) are protected server-side by `requireAdminSession()`.

This intentionally does **not** implement RBAC, impersonation, or multi-role policy in V1.

## Admin routes

- `/app/admin` — consolidated summary and shortcuts
- `/app/admin/jobs` — analysis/export job visibility and retries
- `/app/admin/webhooks` — Stripe webhook receipts and reprocessing
- `/app/admin/exports` — export lifecycle and storage metadata
- `/app/admin/health` — dependency readiness / startup validation snapshot
- `/app/admin/maintenance` — safe maintenance actions with explicit confirmation
- `/app/admin/accounts` — account/subscription/usage/entitlement overview

## Page responsibilities

### Jobs dashboard

Shows combined analysis + export jobs with:
- status, type, linked resource id, progress/step, retry counters, schedule/attempt timestamps
- error code + summary for failures
- summary counters (queued/processing/failed/stale)
- filters by status and job kind
- retry action for failed jobs

### Webhook receipts dashboard

Shows Stripe webhook receipt records with:
- provider event id, event type, processing status, attempts, timing, error summary
- idempotent/no-op signal (`processed` + repeated attempts)
- filters for failed/unprocessed/recent
- safe reprocess action for failed events using stored payload

### Exports dashboard

Shows export records with:
- export id, analysis id, owner/account, status, content/storage metadata, checksum, lifecycle timestamps
- failure summaries
- filters for failed/expired/recent
- regenerate/retry for failed exports
- linked analysis inspection

### System health

Backed by startup/health services and surfaces:
- database, queue, storage, stripe config
- engine importability, seam availability, engine version
- startup validation state + last checked timestamp

### Maintenance controls

Provides explicit operational actions:
- full maintenance sweep
- clean expired exports
- clean stale failed jobs

All actions require explicit checkbox confirmation in UI and route through existing maintenance primitives.

### Account/subscription overview

Shows:
- account id, owner email
- plan + subscription status
- month usage snapshot
- entitlement summary
- created timestamp
- current period end + cancel-at-period-end when available
- Stripe customer/subscription references

Includes filters by plan/status/high usage.

## Safety model

- Server-side admin guard on all admin pages and admin APIs.
- No direct DB editing or arbitrary SQL tools.
- No impersonation/user mutation controls in this phase.
- Destructive/operational actions are intentionally narrow and pre-defined.
- No secrets are surfaced in UI.

## Explicitly out of scope

- Full RBAC / delegated admin roles
- Cross-tenant impersonation or direct account mutation tooling
- Arbitrary job editing/manual SQL consoles
- Feature-flag orchestration

## Future extensions

- Audit trail for admin actions
- Job/event drill-down detail panels
- Pagination and CSV export for large operator datasets
- Optional read-only observer role separate from full admin
