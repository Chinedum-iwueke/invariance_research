# Real Analysis Rendering and Empty States

## Why this document exists

This document captures the production-honesty rules for authenticated analysis surfaces:

- Fresh accounts must **not** see fabricated analysis counts or diagnostic values.
- Completed runs must render from the persisted `AnalysisRecord` payload only.
- Missing payloads must show explicit limited/unavailable states instead of synthetic fallback numbers.

## End-to-end real run flow

1. **Artifact upload + inspection** (`POST /api/uploads/inspect`)
   - Upload is parsed and validated.
   - `artifacts` row stores parsed artifact + eligibility summary.

2. **Run Analysis** (`POST /api/analyses`)
   - `createAnalysisFromArtifact()` creates an `analyses` row with:
     - `status = queued`
     - `eligibility_snapshot_json`
     - `artifact_id`, `account_id`, `owner_user_id`
   - A `jobs` row is created for queue processing.

3. **Worker execution** (`analysis-worker`)
   - Job is claimed and `analyses.status` moves to `processing`.
   - Bulletproof engine executes with parsed artifact.
   - Output is normalized through `normalizeEngineResultToAnalysisRecord()`.
   - On success, `analyses.status = completed` and `analyses.result_json` persists full `AnalysisRecord`.
   - On failure, `analyses.status = failed` with `failure_code`/`failure_message`.

4. **UI rendering**
   - List view uses `GET /api/analyses` (`listAnalyses(account_id)`) to show owned rows.
   - Detail surfaces resolve account-owned analysis and render diagnostics from `analysis.result_json`.
   - If status is complete but payload is missing, UI shows honest warning state rather than placeholder metrics.

## What a completed analysis is expected to persist

`analyses.result_json` must contain a schema-valid `AnalysisRecord` with:

- `summary` headline metrics and verdict.
- `diagnostics` blocks:
  - `overview`, `distribution`, `monte_carlo`, `stability`, `execution`, `regimes`, `ruin`
- `report` payload (`executive_summary`, `diagnostics_summary`, `methodology_assumptions`, `recommendations`, `export_ready`).
- `access` capability flags.

## UI state separation rules

### A) New user / no analyses

- Workspace home shows `Total Analyses = 0` and honest zero metrics.
- Recent analyses panel shows empty state CTA only.
- Analyses library shows `No analyses yet` empty state.

### B) Existing user / in progress

- Workspace and library counts derive from real queued/processing rows.
- Detail routes without persisted result show `AnalysisRunState` status panel.

### C) Existing user / completed analyses

- Completed rows are clickable to `/app/analyses/:id/overview`.
- Detail pages render figures/metrics/interpretation from persisted `AnalysisRecord`.

### D) Existing user / failed analyses

- Status remains failed in list/dashboard counts.
- Detail routes show explicit failure context from persisted failure fields.

## Mock data removed from authenticated product surfaces

Removed from authenticated app shell:

- Hardcoded dashboard counts (`Completed 12`, `Avg Robustness 69`, `Audit Flags 3`).
- Seeded recent analysis rows (`alpha-trend-v2`, `fx-meanrev-core`).
- Hardcoded workflow links pointing to `alpha-trend-v2`.
- Static/mock chart components and fake metric arrays on detail routes.
- Placeholder report sections pretending to be live run output.

Retained mock visuals are limited to public marketing/docs surfaces (e.g. `/`, `/robustness-lab`, `/ui-kit`) where they are illustrative and not tied to authenticated user data.
