# Product Shell Architecture (Phase 3)

## Purpose
Phase 3 introduces the authenticated Strategy Robustness Lab shell before backend upload/compute wiring.

## Route map
- `/app` workspace landing
- `/app/new-analysis` intake shell
- `/app/analyses` analysis archive
- `/app/analyses/[id]/overview`
- `/app/analyses/[id]/distribution`
- `/app/analyses/[id]/monte-carlo`
- `/app/analyses/[id]/stability`
- `/app/analyses/[id]/execution`
- `/app/analyses/[id]/regimes`
- `/app/analyses/[id]/ruin`
- `/app/analyses/[id]/report`
- `/app/settings`

## Shell structure
All authenticated routes are composed from:
1. Left navigation panel (`AppSidebar`) showing research workflow sequence
2. Top context bar (`AppTopbar`) with strategy metadata and action placeholders
3. Main workspace (`AnalysisPageFrame` + section cards)
4. Right insight rail (`InsightRail`) for analyst interpretation and consulting bridge

## Reusable components
- App shell: `AppShellLayout`, `AppSidebar`, `AppTopbar`
- Dashboard: `AnalysisPageFrame`, `WorkspaceCard`, `MetricRow`, `InsightRail`, `InterpretationBlock`, `VerdictCard`, `LockedFeatureCard`, `AnalysisTable`, `EmptyState`, `SkeletonState`
- Forms: `UploadDropzoneShell`

## Mock payload philosophy
Mock contracts live in `src/lib/mock/analysis.ts` and mirror product-facing API shape:
- `AnalysisSummary`, `AnalysisContext`, `KeyMetric`, `DiagnosticPayload`
- Fields such as `strategy_name`, `trade_count`, `timeframe`, `asset`, `robustness_score`, `interpretation_points`, `verdict`, `warnings`

These contracts avoid leaking internal engine-level objects and can be swapped with server payloads with minimal refactors.

## Phase 4 preparation (upload flow)
- `/app/new-analysis` already has the ingestion frame, accepted-artifact guidance, and confidentiality context.
- Replace shell form state with real file upload pipeline + validation response handling.

## Phase 5 preparation (live diagnostics)
- Every analysis route already follows a consistent pattern:
  - title + interpretation intent
  - primary figure workspace
  - metric row
  - what-this-means block
  - right insight rail
- Replace placeholder figures/metrics with API-backed series payloads while preserving component contracts.
