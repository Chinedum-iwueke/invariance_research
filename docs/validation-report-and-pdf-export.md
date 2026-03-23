# Validation Report Structure & PDF Export Flow

## Report page hierarchy

The Validation Report page is now intentionally ordered for institutional decisioning:

1. **Executive Verdict Banner** (visual anchor: verdict status, headline, summary)
2. **Executive Summary + Confidence Level**
3. **Key Metrics Snapshot** (decision-relevant metrics only)
4. **Diagnostic Evidence** (curated charts)
5. **Diagnostics Summary**
6. **Methodology**
7. **Limitations**
8. **Deployment Guidance**
9. **Final Recommendations**
10. **Export & Share**

This keeps the existing scaffold but materially improves narrative and visual hierarchy.

## Entitlement behavior

- `can_view_full_report` controls whether full-depth sections are shown or an upgrade panel is surfaced.
- `can_export_report` controls access to polished PDF export.
- Locked exports still render clear requirements through diagnostic lock messaging.

## PDF export pipeline

1. User clicks **Export polished PDF** in the report page Export & Share section.
2. Frontend posts to `POST /api/analyses/:id/exports` with `format: "pdf"`.
3. Export service validates ownership/completion/entitlement and queues an export job.
4. Export worker renders an institutional PDF report and persists it to export object storage.
5. Frontend polls `GET /api/exports/:export_id` until completion and enables `Download PDF`.
6. Download is served from `GET /api/exports/:export_id/download`.

## Exported PDF contents

The generated PDF includes:

- Brand/report header lockup
- Executive verdict
- Confidence level
- Executive summary
- Key metrics snapshot
- Diagnostics summary
- Methodology
- Limitations
- Deployment guidance
- Final recommendations
- Selected curated charts

## Curated chart inclusion

Chart selection is intentionally constrained to high-value visuals where available:

- Overview equity/comparison figure
- Distribution figure (histogram/distribution)
- Monte Carlo fan/trajectory figure
- Ruin/stress figure

The report intentionally avoids dumping all chart payloads to preserve premium readability.

## Known limitations

- PDF chart rendering currently converts selected figure series into lightweight vector chart blocks (suitable for report context, not full chart-parity with the web UI).
- If a run has no emitted figure payloads, the PDF still exports as a polished institutional report but without chart panels.
