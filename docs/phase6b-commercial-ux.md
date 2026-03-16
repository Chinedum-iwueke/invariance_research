# Phase 6B — Commercial UX Refinement

## Objective
Phase 6B refines the existing SaaS layer to improve clarity, trust, and analytical justification in upgrade and billing experiences.

## Diagnostic lock states
A standardized lock panel now renders three distinct states and never mixes them:

1. **Artifact limitation**
   - Explains required richer artifact context.
   - Provides specific upload guidance.
   - Does **not** show upgrade prompts.

2. **Engine limitation**
   - Explains current engine capability boundary.
   - Notes future support expansion.
   - Does **not** show upgrade prompts.

3. **Plan restriction**
   - Explains plan-based access boundary.
   - Shows upgrade options and advisory CTA.

Implementation:
- `src/components/dashboard/diagnostic-lock-panel.tsx`
- `src/lib/app/diagnostic-locks.ts`
- plan-gated diagnostics use `UpgradePanel` only for `plan_locked` reason.

## Upgrade flow principles
Upgrade prompts are rendered only at high-value boundaries:
- plan-gated diagnostic access
- monthly analysis quota reached
- report export attempts on unsupported plans
- richer artifact uploads blocked by plan

Artifact/engine limitations do not display upsell messaging.

Implementation:
- `src/components/dashboard/upgrade-panel.tsx`
- `src/components/forms/new-analysis-intake.tsx`
- diagnostic pages under `src/app/app/analyses/[id]/*`
- `src/app/app/analyses/[id]/report/page.tsx`

## Billing UX structure
`/app/billing` now includes:
- billing summary
- usage meter
- analyses remaining
- retention visibility
- subscription controls
- plan comparison matrix
- advisory CTA

Implementation:
- `src/app/app/billing/page.tsx`
- `src/components/dashboard/billing-summary-card.tsx`
- `src/components/dashboard/usage-meter.tsx`
- `src/components/dashboard/plan-comparison-table.tsx`

## Plan comparison presentation
A reusable plan matrix maps commercial tiers to capabilities:
- upload class support
- analyses/month
- diagnostic coverage
- export access
- retention and processing priority

Implementation:
- `src/components/dashboard/plan-comparison-table.tsx`

## Consulting bridge
Subtle expert escalation CTAs appear where risk/fragility context is high:
- ruin/stability/regimes pages
- billing and upgrade surfaces

Tone remains institutional and analytical.
