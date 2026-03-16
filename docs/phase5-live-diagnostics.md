# Phase 5 — Live Diagnostic Wiring and Report Refinement

This phase deepens the engine-backed adapter mapping from `EngineAnalysisResult` into stable product-facing `AnalysisRecord` contracts without changing core ingestion or orchestration architecture.

## What was deepened

- **Overview** now maps live robustness, overfitting, Monte Carlo tail drawdown, and ruin-probability signals into top-line metrics.
- **Monte Carlo** now maps worst/p95/median drawdown and ruin probability into sober risk metrics with figure-ready fan-chart payload support when emitted.
- **Report** now composes executive summary, methodology assumptions, recommendations, and explicit per-diagnostic availability rows from reconciled eligibility/capability state.
- **Distribution / Execution / Ruin** now pull concrete engine fields where present and degrade honestly where fields are absent.
- **Regimes / Stability** remain limitation-aware and intentionally bounded when richer context is unavailable.

## Diagnostics now genuinely live

From adapter mapping perspective (when engine emits these fields):

- `summary.robustness_score`
- `summary.overfitting_risk_pct`
- `diagnostics.monte_carlo.*drawdown*`
- `diagnostics.ruin.*ruin_probability*`
- Engine warnings and skipped-diagnostic notes
- Report assumptions/recommendations/export readiness
- Figure payloads under diagnostic `figure`/`*_figure` fields (normalized into contract-safe `FigurePayload`)

## Honest limitation behavior preserved

Availability still reconciles in this order:

1. Upload eligibility (ceiling)
2. Engine capability profile (further constrains)
3. Skipped diagnostics (explicitly surfaced)

Pages therefore avoid synthetic completeness:

- Limited diagnostics remain useful and interpretation text states bounds.
- Unavailable/skipped diagnostics are reflected in report rows and warning stream.
- Regimes/Stability avoid overclaiming when OHLCV/regime or parameter-surface depth is not present.

## Figure payload mapping strategy

The adapter now normalizes figure payloads into stable contract fields:

- `figure_id`
- `title`
- `subtitle`
- `type`
- `series`
- `legend`
- `note`

Fallback figure objects are intentionally minimal and limitation-aware when full series payloads are absent.

## Interpretation generation strategy

Interpretation blocks now prefer:

- Engine key findings
- Warnings/skipped reasons
- Diagnostic availability state
- Concrete risk values (e.g., drawdown and ruin estimates)

This replaces generic placeholder text while preserving sober, bounded language.

## Remaining future enhancement areas

- Rich regime decomposition once stronger market-state context is emitted.
- True stability topology once parameter-surface outputs are available.
- Report export artifact workflow (PDF/share actions) beyond readiness flag semantics.
