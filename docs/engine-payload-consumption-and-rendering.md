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

- **Overview**: top-line chart/metrics + assumptions/limitations/recommendations panel
- **Trade Distribution**: richer figure set + native interpretation/limitations text
- **Monte Carlo**: fan/line/scatter rendering + assumptions/recommendations section
- **Risk of Ruin**: survivability metrics/figure + limitations/recommendations section
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

- real top-line overview metrics and equity chart (engine-first, derived fallback only when missing)
- distribution metrics with at least one chart if engine figures were emitted
- Monte Carlo and ruin summaries/charts when emitted
- report narrative with assumptions/recommendations and explicit limitations

## Remaining artifact-limited states

If the engine marks diagnostics as limited/unavailable (e.g., missing richer artifact context such as OHLCV/regime labels), pages remain explicit about those constraints and do not fabricate missing series or claims.
