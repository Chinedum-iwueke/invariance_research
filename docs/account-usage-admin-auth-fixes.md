# Account Usage, Admin Entitlements, and Auth UX Fixes

## Corrected monthly quota rule

Monthly analysis limits now count **only successful completed analyses**.

Counted:
- `completed` analyses with valid persisted records.

Not counted:
- `failed`
- `processing` (including stale/stuck)
- abandoned/incomplete attempts
- retry attempts that never complete successfully

Implementation notes:
- Quota checks now use completed analysis records for the current month (`analyses.status='completed'` grouped by `updated_at` month bucket).
- Analysis usage increments are moved from analysis-creation time to successful worker completion.

## Admin unlimited-run override

Admin identities (email/user ID allowlist) now bypass monthly analysis cap enforcement.

- Admin accounts can continue executing analyses beyond standard plan run limits.
- Usage is still observable in usage surfaces for operator visibility.

## Admin navigation visibility

The workspace sidebar now conditionally renders the `Admin Ops` entry.

- Admin users: `Admin Ops` is shown.
- Non-admin users: `Admin Ops` is omitted entirely.

Server-side admin guard enforcement remains intact.

## Logout and session persistence behavior

- Added a `Log out` action in the authenticated app sidebar (desktop + mobile drawer).
- Logout executes NextAuth sign-out and redirects to the home page.
- Public shell header now reflects authenticated session state, so users stay visibly authenticated across public/app navigation.
- Session configuration explicitly persists JWT sessions for 30 days (with daily update cadence), and only explicit logout ends the session.

## Usage repair / recalculation path

A deterministic repair script is added:

- `scripts/recalculate-usage.ts`
- npm script: `npm run usage:recalculate -- [flags]`

It rebuilds `usage_snapshots.analyses_created` from completed analyses only, preserving upload/export counters.

### Examples

Recalculate for specific trial accounts by owner email:

```bash
npm run usage:recalculate -- --email trial1@example.com --email trial2@example.com
```

Recalculate by account ID:

```bash
npm run usage:recalculate -- --account-id <acct_1> --account-id <acct_2>
```

Preview without writing changes:

```bash
npm run usage:recalculate -- --email trial1@example.com --dry-run
```
