# Phase 4 Upload Intake, Eligibility, and Job Workflow

## End-to-end loop implemented

1. User uploads `.csv` or `.zip` on `/app/new-analysis`.
2. Client performs lightweight checks (presence, extension, max-size).
3. `POST /api/uploads/inspect` performs authoritative backend intake validation and parsing.
4. Ingestion layer emits canonical `ParsedArtifact` + `UploadEligibilitySummary`.
5. UI renders available/limited/unavailable diagnostics with explicit reasons.
6. User confirms run; `POST /api/analyses` creates analysis + job records.
7. Job execution is orchestrated via service boundary (`scheduleAnalysisJob`) and status updates.
8. Client polls `GET /api/analyses/:id/status` for queued/processing/failed/completed state.
9. Completed artifacts are normalized to product-facing `AnalysisRecord`.
10. User is redirected to `/app/analyses/[id]/overview`.

## Service boundaries

- Route handlers call services only.
- Ingestion parsing/validation is centralized in `src/lib/server/ingestion`.
- Upload persistence uses storage abstraction (`artifact-storage.ts`).
- Artifact, analysis, and job persistence are isolated behind repositories.
- Transitional execution is isolated in `analysis-job-runner.ts`.
- Final payload normalization is isolated in `analysis-normalizer.ts`.

This keeps route handlers thin and future-queue friendly.

## Repository and storage abstractions

- `artifactRepository`: stores uploaded artifact metadata, parsed artifact, eligibility.
- `analysisRepository`: stores lifecycle entity and completed result.
- `jobRepository`: stores queue/processing progress and failure info.
- `artifact-storage`: local file implementation with swap-ready boundary for object storage later.

Current persistence is in-memory + local disk for development, but interfaces are ready for Postgres + cloud object storage replacement.

## Ingestion integration

Inspection service integrates:

- file validators
- parser adapters
- canonical parsing
- richness classification
- diagnostic eligibility summary

No frontend parsing is used for source-of-truth decisions.

## Eligibility honesty

Eligibility is backend-authored and returned as structured fields:

- available diagnostics
- limited diagnostics
- unavailable diagnostics
- limitation reasons
- summary text

The frontend renders these directly and does not infer capability from file structure.

## Analysis/job lifecycle

Statuses supported:

- analysis: `queued` → `processing` → `completed` | `failed`
- job: `queued` → `processing` → `completed` | `failed`

Runner updates `current_step` and `progress_pct` across transitional orchestration steps.

Retry path:

- `POST /api/analyses/:id/retry` allowed for failed analyses.
- job retry count increments and orchestration is re-scheduled.

## Mapping into stable product contract

`analysis-normalizer.ts` produces and validates `AnalysisRecord` via `analysisRecordSchema` before persistence.

This guarantees page/API consumers receive product-facing contract shape rather than parser-native or engine-native output.

## Engine integration seam (`bulletproof_bt` distribution, `bt` runtime module)

Execution now routes through the integrated engine boundary. The seam remains the extension point for future engine capabilities behind:

- `analysis-job-runner.ts` orchestration step
- `analysis-normalizer.ts` adapter boundary

Frontend, routes, and ingestion contracts remain unchanged.

## UI honesty and calm processing UX

`/app/new-analysis` now provides:

- intake guidance and confidentiality language
- explicit eligibility output
- clinical status text for queued/processing states
- clear failure + retry controls
- return-to-archive action

`/app/analyses` is wired to backend list endpoint and reflects true lifecycle states.
