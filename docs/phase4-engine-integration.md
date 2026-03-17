# Phase 4B Engine Integration (bulletproof_bt distribution, `bt` runtime seam)

## What changed

Phase 4 orchestration now executes analysis through a subprocess bridge boundary:

Node/Next server → Python bridge script → `bt.run_analysis_from_parsed_artifact(...)`.

This replaces the previous incorrect approach where Node attempted `import("bt")` directly.

## Dependency vs runtime namespace

- Distribution/dependency/install name: `bulletproof_bt`
- Runtime Python module import: `bt`

Correct runtime examples (Python only):

```python
import bt

bt.__version__
bt.run_analysis_from_parsed_artifact(parsed_artifact, config)
```

Node/TypeScript never imports `bt` now.

## Integration boundary

- `scripts/run_bulletproof_engine.py`
  - Imports runtime module `bt`.
  - Supports `--probe` for health/startup checks.
  - Reads JSON payload from stdin for analysis execution.
  - Calls `run_analysis_from_parsed_artifact(parsedArtifact, config)`.
  - Writes JSON result to stdout and failures to stderr with non-zero exit.
- `src/lib/server/engine/bulletproof-client.ts`
  - Owns subprocess invocation (`spawn`) of Python bridge.
  - Serializes payload safely over stdin.
  - Parses stdout JSON and normalizes failures into structured `engine_process_*` errors.
  - Reads runtime config from env (`INVARIANCE_PYTHON_BIN`, optional bridge path override).
- `src/lib/server/engine/bulletproof-runner.ts`
  - Builds engine config from persisted upload eligibility.
  - Preserves existing engine context contract (name/version/seam/degradation notes).

This keeps route handlers and general services free of engine internals.

## Environment/runtime knobs

- `INVARIANCE_PYTHON_BIN` (default: `python3`)
  - Python executable used by web/worker Node processes to invoke the bridge.
- `INVARIANCE_BULLETPROOF_BRIDGE_SCRIPT` (optional)
  - Absolute/relative path override for bridge script; defaults to `scripts/run_bulletproof_engine.py`.
- `INVARIANCE_ENGINE_TIMEOUT_MS` (optional)
  - Max subprocess runtime before forced kill/failure.

In local VM/shared-venv setups, point `INVARIANCE_PYTHON_BIN` to that venv interpreter.

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
3. Invokes engine seam through Python bridge.
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
