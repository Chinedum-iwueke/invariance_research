# Analysis Workspace Stability and Trade-Only Rendering

## Root causes identified

1. **Fresh-user routing mismatch**
   - `/app` always rendered workspace home, even when a user had zero analyses.
   - This dropped first-time users into a dead-end list experience instead of the upload path.

2. **Sidebar architecture mixed contextual and non-contextual workflow links**
   - `getAnalysisWorkflowItems(undefined)` returned workflow links targeting `/app/analyses`.
   - Multiple items used the same href (`/app/analyses`) as React keys, causing duplicate-key collisions.
   - Workflow group rendered even without active analysis context.

3. **Trade-only completed runs were under-rendered**
   - The adapter passed through engine fields when present but did not backfill safe, derived trade-level diagnostics.
   - If engine omitted chart series, pages showed sparse “no series emitted” surfaces despite available trade-level data.

4. **Admin entitlement bypass was incomplete**
   - Diagnostic access checks and report/export capability checks did not include an explicit admin override for plan locks.

---

## Fixes implemented

### 1) Fresh-user `/app` entry rule

- `/app` now checks account analyses count and redirects to `/app/new-analysis` when count is `0`.
- Existing users with analyses continue to see workspace home.

### 2) Sidebar workflow navigation stabilization

- Added explicit stable `key` fields to nav items.
- Changed `getAnalysisWorkflowItems(undefined)` to return an empty array.
- Render workflow nav group only when an active analysis id exists in route context (`/app/analyses/:id/*`).
- Sidebar now has one stable global workspace group plus one contextual workflow group (or none).

This removes:
- duplicate `/app/analyses` keys,
- pre-analysis phantom workflow tabs,
- stale duplicated workflow sections.

### 3) Trade-only result rendering improvements

Adapter changes for persisted `analyses.result_json` mapping:
- Added trade-derived stats from persisted trades when engine leaves fields blank:
  - total PnL,
  - expectancy proxy (mean trade PnL),
  - win rate,
  - median trade PnL,
  - average duration.
- Added derived cumulative PnL line series for overview when engine emits no overview figure series.
- Added derived trade PnL histogram bins for distribution when engine emits no histogram series.
- Added parser notes into run-context and report methodology assumptions.
- Expanded summary key findings to include trade-only quantitative points.

Workspace page updates:
- **Overview** now includes operational summary block (trade count, window, execution/risk model context).
- **Trade Distribution** now includes persisted trade-level summary card in addition to metrics/figures.
- **Risk of Ruin** assumptions section now has explicit empty-state messaging instead of rendering an empty list.

### 4) Admin plan-lock bypass

- `resolveDiagnosticAccess` now accepts `is_admin`; admin bypasses only `plan_locked` checks.
- Artifact and engine limitations remain intact.
- Analysis diagnostic pages pass `is_admin` from authenticated identity.
- Report page allows admin full report/export view surfaces.
- Export entitlement assertion now accepts `isAdmin` and bypasses plan restriction for admin.
- Export API route passes `is_admin` to export requests.

---

## Trade-only payload audit (current persisted shape)

Because the runtime `bt` module is unavailable in this environment, audit was performed by executing the production mapper (`mapEngineAnalysisResultToAnalysisRecord`) with a realistic trade-only parsed artifact and sparse engine diagnostic payload.

### Observed persisted fields now surfaced for trade-only

- `dataset.trade_count`, `dataset.start_date`, `dataset.end_date`
- `summary.key_findings` with trade-level quantitative statements
- `diagnostics.overview.metrics` now includes trade count + win rate even if robustness metrics are unavailable
- `diagnostics.overview.figure.series` receives derived cumulative PnL series when engine figure series are empty
- `diagnostics.distribution.metrics` falls back to derived expectancy/median/duration when engine omits them
- `diagnostics.distribution.figures[0].series` receives derived histogram bins when engine omits bins
- `run_context.notes` now includes parser notes
- `report.methodology_assumptions` includes parser-note trace entries

### Still truly limited for trade-only

- Stability/regimes/execution/ruin can remain artifact-limited depending on richness gates.
- Monte Carlo/RoR surfaces remain dependent on engine-emitted simulation outputs; only summaries can be shown when full series are absent.

---

## Workspace-page behavior for trade-only completed runs

1. **Overview**
   - Top-line metrics + derived trade context
   - Derived cumulative PnL line when engine chart series absent
   - Operational context card to prevent “empty page” feel

2. **Trade Distribution**
   - Primary metrics now favor real emitted values and derived fallbacks
   - Derived histogram when engine histogram series absent
   - Trade-level summary card with persisted counts/window/findings

3. **Monte Carlo Crash Test**
   - Continues to show emitted metrics and warnings
   - If series absent, page still carries metric/warning context

4. **Execution Sensitivity**
   - Admin bypasses plan locks
   - Artifact-limited behavior remains honest

5. **Parameter Stability / Regime Analysis**
   - Retain truthful artifact/engine-limited surfaces
   - No admin bypass for artifact/engine limitations

6. **Risk of Ruin**
   - Surfaces emitted/available metrics
   - Cleaner empty state for missing assumptions

7. **Validation Report**
   - Admin sees full report/export affordances without entitlement gating
   - Report keeps explicit diagnostic-status and methodology assumption framing

---

## Verification checklist (intended runtime behavior)

- Fresh users with zero analyses are guided to `/app/new-analysis`.
- No workflow group appears without active analysis route context.
- Workflow group appears once per active analysis context with stable unique nav keys.
- Admin bypasses plan locks only; artifact/engine limitations still shown.
- Trade-only completed runs render richer, real payload-derived content without mock data.
