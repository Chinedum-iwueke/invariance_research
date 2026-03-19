# UI Refinement Pass: Header, Workspace, Theme

## Scope
This pass focused on institutional UI polish and layout stability across public and authenticated surfaces, with no backend feature changes.

## Header / Navigation redesign
- Introduced a single institutional header component used by both the marketing site and app shell.
- Replaced long flat nav with four grouped dropdown menus:
  - INSIGHTS → Research
  - OUR APPROACH → Strategy Validation, Research Standards, Methodology
  - IR LABS → Robustness Lab
  - OUR FIRM → About, Contact Us
- Removed the former header button `View Research Standards`.
- Retained `Request Audit` as the primary right-side CTA.
- Added right utility controls:
  - account area (login/signup on public, account button on authenticated shell)
  - global light/dark theme toggle
- Added a dedicated logo slot structure on the far left ready for SVG drop-in.

## Theme system approach
- Added a global `ThemeProvider` with persistent theme state (`localStorage` key `ir-theme`).
- Default theme is light (`data-theme="light"`).
- Theme is applied at the root via `data-theme` and CSS custom properties.
- Added dark-mode token overrides for:
  - text colors
  - surfaces
  - borders
  - chart palette accents
  - shadows and focus ring offsets
- Updated key app/dashboard/chart/admin shells from hardcoded white backgrounds to tokenized surface variables.

## Robustness Lab layout fixes
- Removed nested `AppShellLayout` from `/app/analyses/[id]` route layout to eliminate duplicated sidebar and shell stacking.
- Kept a single authoritative shell at `/app/layout.tsx`.
- Widened analysis workspace frame and increased section spacing for calmer, less cramped surfaces.
- Standardized composition rhythm on key trust pages (Overview, Monte Carlo, Report):
  - dominant figure/analysis block first
  - supporting metrics row
  - interpretation + verdict/supporting block
  - cleaner spacing and less compressed two-column collisions
- Increased main app content padding and tuned right-rail width behavior.

## Intentional tradeoffs / remaining polish
- Header dropdown interaction uses hover/focus behavior to avoid layout shift while staying minimal; if stricter click-only behavior is desired, that can be switched.
- Current logo slot uses a textual placeholder lockup pending final SVG upload.
- Some low-traffic auth pages still retain bespoke button styling and can be further tokenized in a dedicated pass.
