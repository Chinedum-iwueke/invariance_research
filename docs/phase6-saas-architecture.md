# Phase 6 — SaaS Architecture

## Scope
Phase 6 introduces authentication, account ownership, subscription billing, entitlement policy, usage metering, and commercial UX across the existing diagnostic product.

## Auth architecture
- Auth.js-based central auth module: `src/lib/server/auth/auth.ts`.
- Session helpers and guards:
  - `getServerSession` and `requireServerSession` in `src/lib/server/auth/session.ts`.
  - `/app` route protection in `src/lib/server/auth/guards.ts` and `src/app/app/layout.tsx`.
- Auth routes + pages:
  - `src/app/api/auth/[...nextauth]/route.ts`
  - `src/app/(auth)/login/page.tsx`
  - `src/app/(auth)/signup/page.tsx`

## Account ownership model
- New domain contracts:
  - `User`, `Account`, `Subscription` in `src/lib/contracts/account.ts`.
  - `EntitlementSnapshot`, `UsageSnapshot` in `src/lib/contracts/entitlements.ts`.
- In-memory repositories and service layer:
  - `src/lib/server/accounts/repositories.ts`
  - `src/lib/server/accounts/service.ts`
- Analyses and artifacts now carry `owner_user_id` + `account_id` for ownership attribution.

## Plan matrix and entitlement model
Plan IDs:
- Explorer
- Professional
- Research Lab
- Advisory / Enterprise

Central matrix and resolver:
- `src/lib/server/entitlements/plans.ts`
- `src/lib/server/entitlements/entitlements.ts`

Policy module (`src/lib/server/entitlements/policy.ts`) enforces:
- upload artifact class eligibility by plan
- diagnostic access entitlement checks
- reason separation (`artifact_unavailable`, `engine_unavailable`, `plan_locked`)

## Gating architecture
Diagnostic access now resolves with three layers:
1. artifact eligibility (`artifactSupports`)
2. engine capability (`engineSupports`)
3. plan entitlement (`isPlanEntitled`)

The regimes page (`src/app/app/analyses/[id]/regimes/page.tsx`) renders these lock reasons explicitly.

## Usage metering
Monthly usage snapshots track:
- analyses created
- artifacts uploaded
- report exports

Implemented in:
- `usageRepository` in `src/lib/server/accounts/repositories.ts`
- `assertUsageWithinPlan` in `src/lib/server/entitlements/usage.ts`

Enforced in analysis creation (`src/lib/server/services/analysis-service.ts`) and upload ingestion (`src/lib/server/services/upload-intake-service.ts`).

## Billing architecture
Stripe integration modules:
- `src/lib/server/billing/stripe-client.ts`
- `src/lib/server/billing/stripe-checkout.ts`
- `src/lib/server/billing/stripe-portal.ts`
- `src/lib/server/billing/stripe-webhooks.ts`
- `src/lib/server/billing/billing-config.ts`

API routes:
- checkout: `src/app/api/billing/checkout/route.ts`
- billing portal: `src/app/api/billing/portal/route.ts`
- webhook endpoint: `src/app/api/webhooks/stripe/route.ts`

Webhook is the billing state source of truth and updates account/subscription state via `accountService.applySubscription`.

## Commercial UX routes
- `/account` (redirect to settings)
- `/app/settings`
- `/app/billing`
- `/app/upgrade`
- `/login`
- `/signup`

## Tier inclusion summary
### Explorer
- account, sign-in
- trade CSV uploads
- low monthly cap
- core diagnostics only
- no export

### Professional
- Explorer + higher cap
- structured bundle upload
- export and execution sensitivity
- fuller report depth

### Research Lab
- Professional + highest cap
- research bundle support
- regimes + stability
- highest processing profile

### Advisory / Enterprise
- contact/advisory path
- bespoke limits and institutional support

## Phase 7 hardening remaining
- persistent database-backed repositories and migrations
- formalized Stripe customer/account mapping for existing tenants
- webhook idempotency + replay protection
- robust auth providers (email magic link/OAuth) and CSRF hardening
- integration tests with Stripe event fixtures
- background pruning by retention policy
- full report export metering + enforcement
