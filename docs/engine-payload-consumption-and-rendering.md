# Engine payload consumption and rendering

## What the richer payload now contains

`invariance_research` now treats the engine diagnostics contract as an envelope-first payload with:

- `summary_metrics` (global + per diagnostic)
- `figures` (per diagnostic; multiple figure support)
- narrative sections: `interpretation`, `assumptions`, `warnings`, `recommendations`, `limitations`
- `metadata` blocks where emitted
- raw engine result preserved for traceability in persisted `result_json.engine_payload.raw_result`

## Persistence

The completed `AnalysisRecord` now persists an `engine_payload` snapshot alongside existing UI-facing fields:

- `engine_payload.summary_metrics`
- `engine_payload.diagnostics.<diagnostic>` envelope snapshots
- `engine_payload.report_sections` for report-specific assumptions/limitations/recommendations
- `engine_payload.raw_result` full engine response object for reconciliation and audits

This preserves richer contract data while keeping existing page contracts stable.

## Adapter mapping path

Engine output path:

1. Python bridge emits engine result JSON.
2. Node runner receives and forwards `EngineAnalysisResult`.
3. `mapEngineAnalysisResultToAnalysisRecord(...)` now:
   - prioritizes envelope-native fields (`summary_metrics`, `figures`, narrative lists)
   - keeps backward-compatible fallbacks to legacy fields
   - fills page-oriented diagnostics while also storing raw envelope snapshots
4. Repository persists the normalized `AnalysisRecord` in `analyses.result_json`.

## Page consumption updates

Pages now use richer persisted envelope content:

- **Overview**: top-line equity chart with provenance metadata (engine-emitted vs reconstructed), dynamic best-available six metric selection, strengthened verdict rendering (confidence/rationale when present), structured methodology posture grid, and explicit assumptions/limitations/recommendations sections with empty-state safeguards
- **Trade Distribution**: richer figure set + native interpretation/limitations text
- **Monte Carlo**: percentile fan-chart-first rendering, survivability-priority metric row (worst/p95/median drawdown + ruin probability), simulation metadata panel, risk classification framing, and expanded methodology sections (assumptions/limitations/recommendations)
- **Risk of Ruin**: survivability-priority metric selection, model-status badges (artifact richness, sizing completeness, limited/full status, stress linkage), explicit unlock messaging (`account_size` + `risk_per_trade_pct`), richer assumptions panel, and figure empty-states tied to missing sizing/model output instead of generic chart absence
- **Validation Report**: explicit limitations section sourced from engine-native report payload
- **Stability/Regimes**: remain honest; show emitted limitations when present

## Figure rendering support

Frontend figure schema/rendering now supports:

- `line`
- `area`
- `bar`
- `grouped_bar`
- `histogram`
- `scatter`
- `fan` / `fan_chart`
- `heatmap`
- `table` (schema-level support remains; renderer currently displays series-backed plots)

## Trade-only expectations

For trade-only runs with richer engine emissions, users should now see:

- real top-line overview metrics and equity chart (engine-first, derived fallback only when missing) with explicit provenance badges
- distribution metrics with at least one chart if engine figures were emitted
- Monte Carlo and ruin summaries/charts when emitted
- report narrative with assumptions/recommendations and explicit limitations

## Overview-specific adapter additions

`mapEngineAnalysisResultToAnalysisRecord(...)` now enriches `engine_payload.diagnostics.overview.metadata` with:

- `overview_figure_provenance`
- `benchmark_status` (future-friendly: currently `available` or `pending`)
- `artifact_richness`
- `execution_context_level`
- `figure_series_count`

This keeps Overview rendering institutional and traceable without introducing benchmark-comparison logic ahead of readiness.

## Remaining artifact-limited states

If the engine marks diagnostics as limited/unavailable (e.g., missing richer artifact context such as OHLCV/regime labels), pages remain explicit about those constraints and do not fabricate missing series or claims.

## Monte Carlo crash-test framing specifics

The Monte Carlo page now prefers persisted engine envelope content in this order:

1. `engine_payload.diagnostics.monte_carlo.figures` for fan chart data.
2. `diagnostics.monte_carlo.figure` as page contract fallback.
3. Explicit missing-output state that names the absent simulation payload path.

Additional rendering posture:

- simulation metadata is read from `engine_payload.diagnostics.monte_carlo.metadata` (paths, horizon, method, ruin threshold)
- warnings are Monte Carlo-scoped and emphasize true baseline limitations (IID sequencing, no regime conditioning/serial dependence/liquidity amplification) instead of implying baseline invalidation
- interpretation block consumes richer fields when emitted (`summary`, `positives`, `cautions`, `caveats`)

## Risk of Ruin framing specifics

The Risk of Ruin page now treats the diagnostic as a capital-survivability decision surface:

1. **Metric priority** favors emitted `probability_of_ruin`, `expected_stress_drawdown`, `survival_probability`, and `max_tolerable_risk_per_trade` equivalents.
2. **Figure selection** prefers `engine_payload.diagnostics.ruin.figures[0]` and falls back to `diagnostics.ruin.figure`; missing-output messaging is explicit about missing sizing assumptions vs missing engine-emitted figure payload.
3. **Unlock conditions** are explicit:
   - trade-only runs remain limited ruin context
   - full ruin analysis requires `account_size` and `risk_per_trade_pct`
   - Monte Carlo linkage (when emitted) increases stress-confidence context
4. **Assumptions panel** calls out: account size, risk per trade, sizing model, artifact richness, trade count, and model method/linkage.
5. **Optional sensitivity rendering**: if `engine_payload.diagnostics.ruin.metadata.risk_scenarios` is emitted, the page renders a risk-per-trade vs ruin-probability mini-table.
