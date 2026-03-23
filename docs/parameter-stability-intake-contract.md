# Parameter Stability Intake Contract (SaaS)

## Why this contract exists

Parameter Stability should never be described as needing generic "richer artifacts." Baseline unlock depends on one concrete input type: a **parameter sweep bundle**.

## User-facing unlock requirement

Use this product language:

> To unlock Parameter Stability, upload a parameter sweep bundle containing multiple runs across parameter combinations, with each run mapped to its parameter values.

Minimum evidence expected by intake guidance:

- multiple strategy runs
- explicit run-to-parameter mapping metadata
- per-run trade history/results
- packaged as one structured bundle where possible

## Supported format guidance shown in product

### Preferred format

Structured ZIP bundle with:

- `manifest.json`
- per-run trade/result files
- parameter mapping metadata (run_id => parameter values)

### Advanced format

Single combined table with:

- `run_id`
- parameter columns
- trade/result rows for each run

## Lock panel behavior and trust model

Parameter Stability lock panel must distinguish:

1. **Artifact limitation**
   - explain missing parameter sweep contract evidence
   - CTA points to upload parameter sweep bundle and supported format guidance
2. **Plan limitation**
   - explain entitlement tier requirement
   - CTA points to upgrade/plan comparison

The panel should explicitly avoid implying OHLCV is required for baseline Parameter Stability.

## Future richer variants

The intake and messaging stay future-friendly by reserving optional context (OHLCV/regime, benchmark, assumptions) for richer variants:

- regime-aware or market-state-conditioned stability overlays
- richer execution sensitivity coupling with stability maps
- additional plan-tier diagnostics derived from expanded context

Baseline Parameter Stability remains grounded in parameter sweep structure first.
