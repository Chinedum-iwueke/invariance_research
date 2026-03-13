# Ingestion Spec Foundation (Phase 4)

## Purpose

This ingestion layer formalizes how uploads are validated, normalized, classified, and declared eligible for diagnostics before any analytics engine execution. It preserves architectural discipline:

- frontend remains thin
- backend orchestrates parsing and eligibility
- parser/ingestion emits canonical structures
- UI renders structured upload eligibility truthfully

## Accepted artifact classes

- `trade_csv`
- Bundle Manifest V1 ZIP bundles with artifact types:
  - `trade_history_bundle`
  - `backtest_result_bundle`
  - `research_bundle`

## Canonical trade schema (closed trades only)

Required fields:

- `symbol`
- `side` (`long` or `short`)
- `entry_time` (UTC ISO)
- `exit_time` (UTC ISO)
- `entry_price`
- `exit_price`
- `quantity`

Optional fields include `trade_id`, `fees`, `pnl`, `pnl_pct`, `mae`, `mfe`, `duration_seconds`, `strategy_name`, `timeframe`, `market`, `exchange`, `notes`, `entry_reason`, `exit_reason`, and `risk_r`.

Validation rules:

- timestamps normalized to UTC ISO strings
- side normalized to `long`/`short`
- numeric fields finite and clean
- `entry_time < exit_time`
- closed trades only in V1

## CSV alias mapping philosophy

Alias mapping resolves source headers into canonical fields. Baseline aliases cover common trade export naming variants and support side normalization:

- buy/long => `long`
- sell/short => `short`

The alias map is extendable per adapter, so platform-specific adapters can override or add aliases without mutating the canonical contract.

## Bundle Manifest v1

A valid V1 bundle must include:

- `manifest.json`
- `trades.csv`

Optional:

- `metadata.json`
- `equity_curve.csv`
- `assumptions.json`
- `params.json`
- `ohlcv.csv`
- `ohlcv.parquet`
- `benchmark.csv`

Manifest fields:

- `schema_version` (`1.0`)
- `artifact_type`
- optional strategy/source context fields (`strategy_name`, `source_platform`, etc.)
- `included_files`
- optional presence booleans (`assumptions_present`, `ohlcv_present`, `parameter_metadata_present`)

## Artifact richness model

Richness is explicit and deterministic:

- `trade_only`
- `trade_plus_metadata`
- `trade_plus_context`
- `research_complete`

Classifier baseline:

- trades only => `trade_only`
- trades + metadata => `trade_plus_metadata`
- trades + metadata + assumptions/equity => `trade_plus_context`
- trades + metadata + assumptions + ohlcv/params => `research_complete`

## Diagnostic eligibility matrix

Eligibility is backend-produced and parser-context-aware. Each diagnostic gets:

- `available`
- `limited`
- `unavailable`
- optional reason string

Baseline expectations are implemented for:

- `overview`
- `distribution`
- `monte_carlo`
- `stability`
- `execution`
- `regimes`
- `ruin`
- `report`

Reason strings explain limited/unavailable diagnostics, e.g.:

- requires market-context artifact
- requires parameter metadata
- requires richer execution assumptions
- requires OHLCV or regime-labeled context

## Validator layers

1. File validators: extension, emptiness, size, readable content.
2. Trade CSV validators: parseability, alias-resolved required fields, timestamp/number/side validity, canonical row validity.
3. Bundle validators: zip signature, required files, manifest JSON/schema, coherent included files.
4. Semantic validators: non-empty trade set, coherent timestamps, symbol and quantity sanity, price sanity.

Errors use product-safe codes (e.g. `unsupported_file_type`, `invalid_manifest`, `invalid_trade_row`).

## Parser adapter philosophy

Implemented adapters:

- generic trade CSV parser
- generic bundle V1 parser

Scaffolded future adapters:

- backtrader
- mt5
- binance
- bybit

All adapters emit `ParsedArtifact` with validation summary, parser notes, canonical trades, richness, and diagnostic eligibility.

## Product honesty and UI contract

Frontend does not parse raw uploads and does not infer diagnostic capability. Backend emits `UploadEligibilitySummary` containing:

- accepted status
- detected artifact type and richness
- available/limited/unavailable diagnostics
- limitation reasons
- parser notes
- human-readable summary text

This keeps diagnostic claims honest and explainable.

## Phase 4 readiness and Bulletproof_bt boundary

This layer is orchestration-ready for upload/job workflows:

- deterministic intake contracts
- stable canonical trade model
- explicit artifact capability declaration
- clean handoff point for later analytics execution

It also preserves separation from `Bulletproof_bt`: this phase builds ingestion and eligibility contracts, not engine logic.
