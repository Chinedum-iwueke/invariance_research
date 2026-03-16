# Phase 4B Engine Integration (bulletproof_bt distribution, `bt` runtime seam)

## What changed

Phase 4 orchestration now executes analysis through the audited engine seam (`bt.run_analysis_from_parsed_artifact`) instead of transitional in-process placeholder generation.

## Dependency vs runtime namespace

- Distribution/dependency/install name: `bulletproof_bt`
- Runtime Python module import: `bt`

Correct runtime examples:

```python
import bt

bt.__version__
bt.run_analysis_from_parsed_artifact(parsed_artifact, config)
```

Incorrect runtime example:

```python
import bulletproof_bt
```

## Integration boundary

- `src/lib/server/engine/bulletproof-client.ts`
  - Isolates package import details.
  - Dynamically imports runtime module `bt`.
  - Verifies `run_analysis_from_parsed_artifact(parsedArtifact, config?)` exists.
- `src/lib/server/engine/bulletproof-runner.ts`
  - Builds engine config from persisted upload eligibility.
  - Returns structured engine run context (engine name/version, seam name, degradation notes).
  - Uses `bt.__version__` when version is not already present in run context.

This keeps route handlers and general services free of direct engine package imports.

## Product adapter responsibilities

- `src/lib/server/adapters/bulletproof/map-engine-analysis-record.ts`
  - Maps `EngineAnalysisResult` into stable `AnalysisRecord`.
  - Reconciles upload eligibility with engine capability/skips.
  - Preserves unavailable/limited/skipped diagnostics honestly.
  - Emits product-safe warnings instead of raw engine internals.
  - Validates final record against `analysisRecordSchema`.

## Eligibility/capability reconciliation rules

1. Upload inspection eligibility is baseline truth.
2. Engine capability can further restrict diagnostics (limited/unavailable/skipped).
3. Adapter never upgrades a diagnostic above upload eligibility.
4. If engine skips a diagnostic, final output marks it skipped/limited and includes calm warning text.
5. Access flags and interpretation blocks align to reconciled status.

## Job runner hardening

`src/lib/server/services/analysis-job-runner.ts` now:

1. Loads persisted artifact + eligibility snapshot.
2. Moves job through queue-ready progress steps.
3. Invokes engine seam.
4. Maps engine result into `AnalysisRecord`.
5. Persists record and engine context.
6. Stores structured failure codes/messages for status/retry APIs.

## Retry behavior

Retry still reuses persisted artifact and persisted eligibility snapshot. No re-upload is required for retry in current in-memory implementation.

## Failure handling categories

Current failure codes used by runner:

- `artifact_parse_failed`
- `eligibility_conflict`
- `engine_execution_failed`
- `normalization_failed`
- `persistence_failed`

Status/detail endpoints remain product-safe and do not expose stack traces.

## Remaining work before production queue/DB deployment

- Replace in-memory repositories with durable persistence.
- Store immutable engine input/output envelopes for reproducible audits.
- Add worker queue transport and idempotency around job pickup.
- Add engine dependency/version health checks at startup.

## Remaining Phase 5 diagnostic deepening

- Expand per-diagnostic figure/metric mapping from rich `EngineAnalysisResult` payloads.
- Add richer interpretation and recommendation generation for limited/skipped diagnostics.
- Add report export workflow once diagnostic payload mapping reaches final fidelity.
