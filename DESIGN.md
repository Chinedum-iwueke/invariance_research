# Design System - Invariance Research

## Product Context

- **What this is:** Invariance Research is an execution-aware strategy validation platform evolving from the current Strategy Robustness Lab into a claim-first research operating system.
- **Who it is for:** Quantitative traders, strategy builders, research teams, allocators, and operators who need evidence that survives hostile review before capital is deployed.
- **Project type:** Public research/commercial site + authenticated analytical workspace + report/share artifact system + future Research Desk and research memory layer.
- **Design posture:** Ambitious redesign language. Preserve the brand color, research red, but allow typography, spacing, chart language, dashboard composition, page structure, and motion to evolve substantially.

## North Star

The product should feel like:

> A private research tribunal for trading strategies: calm, forensic, exacting, and quietly beautiful.

This is not a trading terminal, not a generic SaaS analytics dashboard, and not a consultancy brochure. It is a product that turns a strategy claim into an evidentiary record. The interface should make unsupported claims feel visibly weaker, supported claims feel earned, and every report feel like something a serious person could forward to a committee.

## Design Thesis

Invariance Research should move beyond the current institutional SaaS look into a more distinctive system: **Forensic Research Desk**.

The visual language combines:

- the discipline of an institutional risk report,
- the density of a research cockpit,
- the quiet drama of investigative editorial design,
- the precision of scientific instrumentation,
- the restraint required for capital-risk decisions.

Keep the product visually sober, but not plain. The sophistication should come from hierarchy, evidence architecture, chart craft, typography, and state design rather than decoration.

## What Changes From The Current Design

Preserve:

- research red as the brand color,
- the seriousness of the current institutional posture,
- restrained surfaces and low-radius geometry,
- chart/report-centered workflows,
- clear app shell structure.

Redesign or substantially tighten:

- typography: Montserrat can be retired or demoted,
- metric cards: move from generic tiles to evidence instruments,
- charts: create a stronger diagnostic visual grammar,
- dashboards: move from card grids to research workbenches,
- analysis pages: make verdict/evidence/limitations the primary hierarchy,
- report pages: make them feel like immutable artifacts,
- transitions: introduce purposeful state motion for analysis progress and evidence changes,
- public pages: make them feel more like a research institution with a live product, less like standard SaaS marketing.

## Aesthetic Direction

- **Direction:** Forensic Research Desk.
- **Decoration level:** Minimal but expressive through structure: rules, ledgers, annotations, dividers, stamps, status strips, chart overlays, provenance labels.
- **Mood:** Severe, intelligent, exact, premium, unsentimental.
- **Surface metaphor:** Research paper + risk terminal + evidence room.
- **Primary risk:** Over-indexing on austerity until the product feels lifeless.
- **Counterbalance:** Use beautiful typographic contrast, precise red interventions, and elegant report artifacts.

## Brand Color

Research red remains the anchor.

- **Research Red:** `#B00020`
- **Dark-mode research red:** `#D05266`
- **Muted red wash:** `#F7E8EB`
- **Deep red ink:** `#6E0014`

Usage rules:

- Use research red for brand identity, primary action, active analysis state, critical evidence, and contradiction.
- Do not use red for ordinary decoration.
- Red should appear as an editorial mark, active rule, stamp, chart series, or decisive button.
- When everything is red, nothing is evidence. Keep it scarce.

## Proposed Palette

The current black/white/red palette is solid but can become generic. Move toward a warmer forensic-paper palette with sharper ink and richer neutral depth.

### Light Mode

- **Ink:** `#11100F`
  - Primary text. Slightly warmer than pure black.
- **Carbon:** `#272321`
  - Strong secondary text, section titles, report headings.
- **Graphite:** `#56504C`
  - Body-secondary, metadata, table labels.
- **Ash:** `#8A837E`
  - Tertiary text, placeholders, disabled metadata.
- **Bone:** `#FBFAF7`
  - Main page background, warmer than white.
- **Paper:** `#FFFFFF`
  - Cards, report pages, printable artifacts.
- **Porcelain:** `#F4F1EC`
  - Section bands, right rails, empty surfaces.
- **Rule:** `#DED8D1`
  - Borders and dividers.
- **Rule Strong:** `#C8BFB6`
  - Table headers, report separations, active boundaries.
- **Research Red:** `#B00020`
  - Brand/action/contradiction.

### Evidence And Semantic States

- **Supported Green:** `#24734D`
- **Supported Wash:** `#E7F2EC`
- **Limited Amber:** `#A66400`
- **Limited Wash:** `#F8EEDC`
- **Unsupported Slate:** `#5E6670`
- **Unsupported Wash:** `#ECEFF2`
- **Contradicted Red:** `#B00020`
- **Contradicted Wash:** `#F7E8EB`
- **Locked Graphite:** `#6A625D`
- **Locked Wash:** `#EFEBE7`
- **Processing Blue:** `#326A8C`
- **Processing Wash:** `#E6F0F5`

### Chart Palette

- **Strategy:** `#B00020`
- **Benchmark:** `#235A97`
- **Drawdown / Loss:** `#9B1C31`
- **Positive Expectancy:** `#24734D`
- **Limited / Warning:** `#A66400`
- **Regime 1:** `#485C78`
- **Regime 2:** `#7A6854`
- **Regime 3:** `#5F7561`
- **Neutral Series:** `#8A837E`
- **Gridline:** `#E6E0D9`

### Dark Mode

Dark mode should be a research-night mode, not a neon trading terminal.

- **Night:** `#12100F`
- **Night Panel:** `#1B1816`
- **Night Raised:** `#24201D`
- **Night Rule:** `#39332F`
- **Night Text:** `#F1ECE6`
- **Night Muted:** `#B2A9A1`
- **Night Red:** `#D05266`

Reports and shared reports may remain light by default for artifact credibility and printability.

## Typography

The full ambition deserves a more distinctive type system than Montserrat-only. Montserrat is competent but too familiar for the level of sophistication this product wants.

### Recommended Type Stack

- **Display / Editorial:** `Instrument Serif`
  - Use for public hero moments, report covers, major editorial headers, and selected quote-like claims.
  - Why: adds intelligence, tension, and artifact quality without becoming decorative.
- **Interface / Body:** `IBM Plex Sans`
  - Use for app UI, forms, navigation, body copy, dashboard labels.
  - Why: technical, trustworthy, human, excellent in dense product surfaces.
- **Data / Code / IDs:** `IBM Plex Mono`
  - Use for version IDs, hashes, report snapshot IDs, reason codes, table numerics where helpful, engine/seam metadata.
  - Why: reinforces evidence/provenance without making the whole app feel like a terminal.

### Fallback Stack

If font migration is deferred:

- Keep Montserrat temporarily as UI/body.
- Add IBM Plex Mono first for data/provenance.
- Add Instrument Serif only to public/report hero moments.
- Migrate body UI to IBM Plex Sans later.

### Type Scale

Use a more deliberate scale with clearer distinction between app, report, and public pages.

- **Editorial Display:** 64/70 desktop, 42/46 mobile. Instrument Serif.
- **Public H1:** 48/54 desktop, 34/40 mobile. Instrument Serif or IBM Plex Sans 600 depending on page.
- **Report Title:** 40/48 desktop, 32/38 mobile. Instrument Serif.
- **App H1:** 30/36. IBM Plex Sans 600.
- **Section H2:** 22/30. IBM Plex Sans 600.
- **Card Title:** 16/22. IBM Plex Sans 600.
- **Body:** 15/24 or 16/26. IBM Plex Sans 400.
- **Dense Body:** 13/20. IBM Plex Sans 400/500.
- **Metric Value:** 32/34 to 48/48. IBM Plex Sans 500 with tabular numbers.
- **Evidence Label:** 11/14 uppercase, 0.11em tracking. IBM Plex Sans 600.
- **Provenance/Code:** 12/18. IBM Plex Mono 400/500.

### Typography Rules

- Use Instrument Serif sparingly. It is a signal for editorial importance, not a body font.
- Use mono for evidence IDs, not for whole pages.
- Keep app pages mostly sans. Let reports and public research pages carry the serif contrast.
- Numeric values must use tabular numbers.
- Long report text should read like a memo, not a dashboard tooltip.

## Layout System

### Core Layout Idea

Move from card grids to **evidence workbenches**.

An analysis page should not feel like a collection of independent widgets. It should feel like a structured investigation:

```text
Claim / strategy identity
  -> verdict strip
  -> evidence ledger
  -> diagnostic workbench
  -> limitations and next experiment
  -> report/share artifact
```

### Public Site

- More editorial than current SaaS structure.
- Fewer generic cards.
- More artifact previews: report pages, evidence ledgers, diagnostic matrices, research desk queues.
- First viewport should show or imply the real product surface.
- Keep immersive imagery, but make it feel like product/research evidence, not atmosphere.

### Authenticated Workspace

- Keep the sidebar/topbar frame, but make the content more structured.
- Use a persistent context/evidence rail for active analysis pages.
- Replace repeated card grids with grouped workbench zones:
  - Verdict
  - Evidence
  - Diagnostics
  - Report
  - Actions
- Use fewer, stronger panels.
- Tables and matrices should become more central.

### Report / Share Layout

Reports should feel like immutable documents:

```text
Report snapshot header
Executive verdict
Evidence received
Claims and support status
Diagnostic matrix
Key charts
Limitations
Reproducibility appendix
Version/provenance footer
```

Use document-width constraints and visible page-like surfaces. Shared reports should not inherit the full app dashboard chrome.

## Spacing And Density

- **Base unit:** 4px.
- **App density:** compact but breathable.
- **Report density:** spacious enough for reading.
- **Public density:** editorial breathing room.

### Recommended Scale

- 2xs: 2px
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px
- 4xl: 96px

### Rules

- App workbench sections: 24-32px between major zones.
- Report sections: 40-56px between major sections.
- Public sections: 72-112px desktop, 48-72px mobile.
- Card/panel padding: 16px dense, 24px default, 32px report/artifact.
- Avoid stacking many equal cards with equal gaps; vary density by importance.

## Radius, Borders, Shadows

The geometry should feel precise.

- **Micro controls:** 3-4px radius.
- **Cards/panels:** 6-8px radius.
- **Report pages:** 2-4px radius or square paper edges.
- **Pills:** only for status chips, filters, and compact segmented controls.
- **Shadows:** rare, soft, and functional. Use borders and surface contrast first.
- **Rules/dividers:** part of the visual identity. Lean into fine lines, section rules, and table grids.

Avoid bubbly 12-20px card rounding except for deliberate touch targets or full pills.

## Evidence State System

Evidence states are a core design primitive.

### States

- **Supported:** Evidence supports the claim.
- **Limited:** Evidence supports a weaker or caveated version.
- **Unsupported:** Evidence is insufficient.
- **Contradicted:** Evidence conflicts with the claim.
- **Locked:** Product entitlement state, separate from evidence.
- **Skipped:** Engine intentionally did not compute.
- **Failed:** System failed to produce trustworthy output.
- **Superseded:** A newer snapshot replaced this artifact.
- **Expired/Revoked:** Share lifecycle state.

### Visual Treatment

Each state needs:

- label,
- icon,
- color,
- reason code,
- plain-language explanation,
- next action where possible.

Never rely on color alone. Status components must work in tables, cards, report appendices, and share pages.

## Components

### Metric Cards Become Instruments

Current metric tiles are useful but generic. Redesign them as evidence instruments.

Each metric card should support:

- metric label,
- value,
- unit,
- confidence/evidence status,
- source diagnostic,
- comparison or threshold,
- limitation marker,
- trend/sparkline when useful.

Preferred composition:

```text
[Evidence label]        [source diagnostic]
Metric Name
42.6%                   threshold: < 20%
Reason / limitation / comparison
```

Use big numbers only when the number deserves attention. A missing or unsupported metric should not leave an empty tile; it should become an evidence-state card.

### Verdict Cards Become Verdict Strips

The verdict should span the page near the top, not hide inside a card.

A verdict strip includes:

- verdict status,
- one-sentence reason,
- confidence/evidence state,
- strongest support,
- strongest doubt,
- next experiment.

Use red only for contradicted/failed/fragile verdicts. Conditional should use amber or graphite.

### Evidence Ledger Matrix

This becomes one of the signature components.

Rows:

- claim or diagnostic,
- status,
- required evidence,
- received evidence,
- missing evidence,
- source diagnostic,
- report-safe limitation text.

It should feel like a structured audit table, not a marketing checklist.

### Diagnostic Cards

Diagnostic cards should include:

- status chip,
- source/provenance metadata,
- chart or table,
- interpretation,
- limitation,
- next action.

Avoid chart-only cards. Every diagnostic view should answer: what this proves, what it does not prove, and what to do next.

### Report Snapshot Header

Every report/share page should start with a snapshot header:

- report title,
- snapshot version,
- generated timestamp,
- engine/seam/parser/report versions,
- stale/superseded state,
- share status if relevant.

Use mono metadata and fine dividers.

### Buttons

- Primary: research red, decisive actions only.
- Secondary: paper/panel with ink border.
- Tertiary: text or subtle panel.
- Destructive: contradicted red/deep red.
- Utility icon buttons: small, square, tooltip-required.

Button copy should be specific:

- `Generate report`
- `Create share link`
- `Request deeper validation`
- `Upload richer artifact`
- `View evidence ledger`

Avoid vague `Submit`, `Continue`, `Learn more` where a specific action exists.

## Charts

Charts need to become a product signature. They should feel like analytical evidence, not generic ECharts defaults.

### Chart Principles

1. **Every chart has a claim.** Title should communicate the evidence question, not just chart type.
2. **Every chart has provenance.** Include source diagnostic and data window.
3. **Every chart has limitation state.** If assumptions are thin, show it.
4. **Annotations beat decoration.** Use threshold lines, stress windows, regime labels, and selected callouts.
5. **Color is semantic.** Red is strategy/contradiction; blue is benchmark; green/amber/red are outcomes.

### Chart Container Anatomy

```text
Diagnostic / source label       status chip
Chart title as evidence question
Short interpretation or limitation
[chart]
Legend + assumptions + data window
```

### Chart Types And Treatments

- **Equity vs benchmark:** red strategy, blue benchmark, thin grid, highlighted divergence zones.
- **Drawdown:** red area below baseline, annotated threshold bands.
- **Monte Carlo:** fan chart with muted percentile bands, selected path in red/ink.
- **Distribution:** histogram with tail annotations and concentration markers.
- **Regime heatmap:** restrained multi-neutral palette, red only for failure pockets.
- **Parameter stability:** contour/surface maps with unsafe zones visibly marked.
- **Evidence matrix:** table/heatmap hybrid, not a decorative heatmap.

### Chart Interaction

- Hover states should expose exact values and assumptions.
- Click/selection may pin a regime, threshold, or stress scenario.
- Motion should animate transitions between selected diagnostics, not constantly loop.

## Analysis Pages

Analysis pages should follow a consistent investigation arc.

### Recommended Structure

```text
Analysis identity header
  strategy name, artifact class, time window, snapshot/version state

Verdict strip
  robust/conditional/fragile/unsupported/failed validation

Evidence ledger summary
  strongest support, strongest doubt, unsupported claims

Diagnostic workbench
  chart/table + interpretation + limitation

Next experiment
  what to upload/run/change next

Report/share actions
  generate report, export, share, request deeper validation
```

### Overview Page

The overview page should not be a dashboard summary. It is the case file cover sheet.

Must show:

- headline verdict,
- one-sentence reason,
- strongest support,
- strongest doubt,
- unsupported conclusion,
- evidence coverage,
- next experiment,
- report CTA.

### Diagnostic Pages

Each diagnostic page should be more forensic:

- `What this diagnostic tests`
- `What the current evidence shows`
- `What this does not prove`
- `Chart/table`
- `Assumptions`
- `Next action`

### Upload Inspection

Upload inspection is the first trust moment.

It should show:

- artifact identity,
- accepted/rejected state,
- evidence capability matrix,
- diagnostics unlocked,
- diagnostics limited/unavailable,
- plan locks separately,
- exact missing fields/files,
- template recommendation.

## Dashboards

Dashboards should become operational workbenches, not card mosaics.

### App Home

Prioritize:

- recent analyses by state,
- evidence quality distribution,
- pending reports/exports,
- failed/retryable jobs,
- next best action.

Avoid:

- generic stat-card rows unless tied to a user decision.

### Analyses Library

Use table-first design:

- strategy,
- latest verdict,
- evidence coverage,
- report state,
- share state,
- created/updated,
- next action.

Cards can exist for empty states and summaries, not as the primary browsing pattern.

### Admin Dashboard

Admin should feel like an ops console:

- dense tables,
- status queues,
- retry controls,
- audit trail,
- worker health,
- migration/storage warnings.

Use neutral surfaces, sparse red, and clear destructive affordances.

## Report And Share Pages

Reports are the saleable artifact. Shared reports are the demand object.

### Report Visual Language

- paper-like surface,
- strong typographic hierarchy,
- visible version/provenance,
- fewer cards,
- more sections and rules,
- charts embedded as evidence figures,
- appendix tables.

### Share Visual Language

Shared reports should feel safe and intentional:

- no owner dashboard chrome,
- no raw artifact links,
- no internal job IDs,
- no debug logs,
- visible expiration/revocation/superseded state,
- clear `Request deeper validation` action.

## Public Site

The public site should feel like a research institution with a working product, not a SaaS template.

### Direction

- More editorial sequencing.
- More real artifact previews.
- Fewer generic feature cards.
- Use report/evidence visuals as the primary imagery.
- Keep immersive hero treatment, but make product/report/research artifacts more inspectable.

### Hero Guidance

The first viewport should signal one of:

- Strategy Robustness Lab,
- report artifact,
- evidence ledger,
- Research Desk.

Avoid purely atmospheric images. The user should understand that this is a real product for strategy validation.

## Motion And Transitions

Motion should express research progress and evidence changes.

### Motion Principles

- Functional first.
- Never make analysis feel gamified.
- Animate state transitions, not decoration.
- Respect reduced motion.

### Recommended Patterns

- Upload inspection: staged reveal as parser -> eligibility -> ledger completes.
- Analysis processing: stepper with worker state, not spinner-only.
- Diagnostic tabs: quick crossfade/slide, 150-220ms.
- Evidence status changes: subtle highlight pulse, then settle.
- Report generation: progress from analysis snapshot -> ledger snapshot -> report snapshot.
- Share lifecycle: clear state transition for active -> revoked/expired/superseded.

### Timing

- Hover/focus: 80-120ms.
- Disclosure/tab: 150-220ms.
- Workbench section transition: 220-320ms.
- Public hero scene: 500-700ms maximum.

## Iconography

Use lucide icons, but with restraint.

Recommended icons by concept:

- Evidence supported: `CheckCircle2`
- Limited: `AlertTriangle`
- Unsupported: `CircleSlash`
- Contradicted/failed: `ShieldAlert` or `XCircle`
- Locked: `Lock`
- Snapshot/version: `FileCheck2`
- Share: `Share2`
- Regenerate: `RefreshCw`
- Export: `FileOutput`
- Engine/seam/provenance: `GitBranch` or `Waypoints`

Icons should label states and commands, not decorate feature cards.

## Implementation Plan

### Phase D1: Token Migration

- Add new palette variables while preserving `--brand-research-red` as `#B00020`.
- Add semantic evidence tokens.
- Add chart tokens.
- Add report/share surface tokens.
- Add mono font variable.
- Optionally add serif display variable.

### Phase D2: Typography Upgrade

- Add IBM Plex Sans, IBM Plex Mono, and Instrument Serif through `next/font/google`.
- Migrate UI/body to IBM Plex Sans.
- Use Instrument Serif only in public/report hero contexts.
- Update `/ui-kit` with type specimens.

### Phase D3: Evidence Components

- Build shared evidence status badge/chip.
- Build evidence ledger matrix.
- Build unsupported/limited/locked state panels.
- Replace one-off diagnostic lock language with shared components.

### Phase D4: Analysis Workbench

- Redesign overview as case-file cover sheet.
- Add verdict strip.
- Add evidence ledger summary.
- Redesign metric cards as evidence instruments.
- Update chart containers with provenance and limitation slots.

### Phase D5: Report And Share Artifact System

- Redesign report page as document artifact.
- Add snapshot header.
- Add appendix patterns.
- Create `SharedReportViewModel` visual treatment separate from owner dashboard.

### Phase D6: Public Site Refresh

- Replace generic feature-card moments with product/report/evidence previews.
- Keep immersive visual hero but make real product artifacts more prominent.
- Make `/robustness-lab` feel like a usable product entry point, not a landing page.
- Apply the same forensic language to all public and account-entry routes, including marketing pages, research publication pages, legal pages, team bio pages, and authentication/recovery screens.
- Public heroes should pair editorial positioning with an evidence artifact, report preview, lab snapshot, trust record, or Research Desk state rather than empty marketing composition.
- Legal and trust pages should feel like policy artifacts: paper surface, provenance line, explicit update date, and confidentiality posture.
- Research library and article pages should read like institutional publications, with serif titles, mono metadata, red proof marks, and restrained document surfaces.

## Anti-Patterns

Do not introduce:

- purple or blue gradient SaaS accents,
- bubbly oversized cards,
- generic three-column feature grids as core storytelling,
- chart colors with no semantic meaning,
- celebratory success visuals for merely incomplete evidence,
- dark trading-terminal cosplay,
- AI-generated atmospheric visuals that do not show product, report, evidence, or research state,
- dense dashboards without a decision hierarchy,
- report/share pages that look like ordinary app dashboards.

## UI Kit Requirements

The `/ui-kit` page should evolve into a design-system proof page with:

- typography specimens for serif/sans/mono,
- light/dark palette swatches,
- evidence state badges,
- evidence ledger matrix,
- verdict strip,
- metric instrument cards,
- chart container variants,
- report snapshot header,
- share-safe report preview,
- upload inspection state examples,
- admin table/status examples.

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-15 | Preserve research red as the only locked brand color | User explicitly asked to keep research red but allowed the rest of the system to evolve. |
| 2026-05-15 | Move from institutional SaaS to Forensic Research Desk | The full ambition is a claim-first research OS, not just a diagnostic dashboard. |
| 2026-05-15 | Recommend IBM Plex Sans, IBM Plex Mono, and Instrument Serif | The combination gives dense product utility, provenance precision, and report/editorial sophistication. |
| 2026-05-15 | Make evidence states a design primitive | Supported, limited, unsupported, contradicted, locked, failed, and superseded states are central to product trust. |
| 2026-05-15 | Redesign metrics as evidence instruments | The product should explain what a metric proves, not just display a number. |
| 2026-05-15 | Treat report/share pages as artifacts, not dashboards | The plan depends on immutable report snapshots and share-safe trust boundaries. |
