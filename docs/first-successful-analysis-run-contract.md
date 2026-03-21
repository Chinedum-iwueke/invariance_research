# First Successful Analysis Run Contract (Upload → Bridge → bt)

This document defines the reconciled contract required to complete a trade-CSV-driven analysis run.

## 1) Upload CSV schema (generic trade CSV adapter)

### Required canonical fields

The upload must resolve these canonical fields (direct header or alias):

- `symbol`
- `side`
- `entry_time`
- `exit_time`
- `entry_price`
- `exit_price`
- `quantity`

### Optional fields

Numeric optional fields:

- `fees`
- `pnl`
- `pnl_pct`
- `mae`
- `mfe`
- `duration_seconds`
- `risk_r`

Text optional fields:

- `trade_id`
- `strategy_name`
- `timeframe`
- `market`
- `exchange`
- `notes`
- `entry_reason`
- `exit_reason`

### Accepted header aliases

The parser resolves headers using alias normalization (`trim + lowercase + spaces -> underscores`):

- `entry_time`: `entry time`, `entry`, `opened_at`, `open_time`
- `exit_time`: `exit time`, `exit`, `closed_at`, `close_time`
- `symbol`: `ticker`, `instrument`, `asset`
- `side`: `direction`, `position_side`, `trade_side`
- `entry_price`: `entry price`, `open_price`, `buy_price`
- `exit_price`: `exit price`, `close_price`, `sell_price`
- `quantity`: `qty`, `size`, `position_size`
- `fees`: `fee`, `commission`, `cost`
- `pnl`: `profit`, `net_pnl`, `realized_pnl`
- `pnl_pct`: `return_pct`, `pnl_percent`, `roi`
- `trade_id`: `id`, `ticket`, `order_id`
- `strategy_name`: `strategy`, `system`
- `timeframe`: `tf`, `interval`
- `market`: `asset_class`
- `exchange`: `venue`

### Value constraints

- `side` is normalized to `long|short` from:
  - long aliases: `buy`, `long`, `b`, `bull`
  - short aliases: `sell`, `short`, `s`, `bear`
- `entry_time` / `exit_time` must parse into timestamps; parser normalizes them to UTC ISO-8601.
- `entry_time` must be earlier than `exit_time`.
- `entry_price` / `exit_price` must be finite, non-negative numbers.
- `quantity` must be finite and strictly positive.

### Timezone expectation

Timestamps are parsed by JavaScript `Date(...)` and emitted as UTC ISO strings.
If input omits offset/timezone, runtime locale assumptions may apply; use explicit `Z` or `±HH:MM`.

## 2) Parsed artifact schema at upload boundary

CSV parser emits a `ParsedArtifact` containing:

- `artifact_kind: "trade_csv"`
- `artifact_type: "trade_csv"`
- `richness: "trade_only"`
- `trades: CanonicalTradeRecord[]`
- `ohlcv_present: false`
- `benchmark_present: false`
- `diagnostic_eligibility` matrix
- `parser_notes`
- `validation` (must be valid to persist artifact)

## 3) Bridge schema at Python boundary

Node worker invokes Python bridge with:

- `parsedArtifact` object (from persisted parsed artifact)
- optional `config`

Bridge adapts to bt’s expected model construction:

- `NormalizedTradeRecord` per trade
- `ParsedArtifactInput` root model
- seam call: `run_analysis_from_parsed_artifact(parsed_artifact, config=...)` when `config` is accepted

## 4) Runtime typing reconciliation fixes

The bridge now avoids invalid runtime checks against subscripted typing generics:

- Safe `isinstance` handling for typing origins (`list[...]`, `dict[...]`, etc.)
- Literal-aware enum coercion (`typing.Literal[...]`) for `artifact_kind` / `richness`
- Constructor signature probing now tolerates non-callable typing artifacts

These changes eliminate the `TypeError: Subscripted generics cannot be used with class and instance checks` class of failures at bridge runtime.

## 5) Early failure behavior for malformed CSV

Malformed uploads now fail at inspection stage with explicit validation errors:

- Missing required header list in one top-level message (plus field-level details)
- No artifact persistence when `parsed.validation.valid === false`
- No deep worker/engine crash for fundamentally invalid CSVs

## 6) Supported vs unsupported variants

Currently implemented:

- Generic `.csv` trade uploads
- Generic Bundle Manifest v1 ZIP uploads

Scaffolded, not implemented:

- Backtrader / MT5 / Binance / Bybit specialized adapters

## 7) What achieved first successful run

The successful path requires:

1. Valid trade CSV matching required canonical schema (or aliases)
2. Successful parsed artifact validation and persistence
3. Worker claim + bridge adaptation to bt input models
4. bt seam execution returning completed analysis payload

With the reconciled bridge typing behavior and strict upload validation, this path now completes end-to-end.
