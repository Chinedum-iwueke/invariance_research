# Invariance Research Design System (Phase 1)

## Token philosophy
The system is token-driven and light-first, optimized for institutional quantitative interfaces:
- 90/9/1 balance (neutral surfaces, restrained secondary tones, red accent)
- Montserrat-only typography for consistency and credibility
- Border-led hierarchy with subtle shadows
- 4px/8px spacing rhythm with semantic section/card/gap tokens

Token sources:
- CSS variables in `src/app/globals.css`
- TypeScript exports in `src/lib/design/*`
- Tailwind extensions in `tailwind.config.ts`

## Core component usage
- **Layout:** `Navbar`, `Footer`
- **Marketing sections:** `HeroSection`, `CtaSection`, `FeatureGrid`
- **UI primitives:** `Button`, `Alert`, `Card`, `SectionHeader`
- **Analytical modules:** `MetricCard`, `ChartCard`, `InsightPanel`, `UploadPanel`, `ReportPreviewCard`, `PricingCards`
- **Chart shells:** `MockLineChart`, `MockHistogram`, `MockHeatmap`, `MockMultiMetricPanel`

## Visual rules
- Use `Research Red` as brand accent only.
- Use benchmark blue strictly for chart comparison states.
- Prefer whitespace, borders, and hierarchy over decoration.
- Keep motion minimal and duration-tokenized.
- Preserve consistent card framing for report-like UX.

## Extending in Phase 2
1. Compose pages from existing section and card components instead of introducing one-off wrappers.
2. Wire real chart libraries into `ChartCard` while preserving current spacing and legend conventions.
3. Add dark mode through existing token architecture (`themes.ts`) without changing component APIs.
4. Add domain modules (research pipeline, report library, diagnostics) by combining existing primitives.

## Phase 2 public-site extensions
Additional reusable public-site components were added under `src/components/public/`:
- `PublicShell` + site navbar/footer
- `PageHero`
- `ProcessTimeline`
- `CtaBanner`
- `ArticleCard`
- `ConfidentialityCallout`
- `ContactForm`
- `DashboardMockShell`

These are composed from Phase 1 primitives (`Button`, `Card`, `SectionHeader`, `ChartCard`, chart mocks) to preserve one visual language.
