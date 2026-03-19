# Logo System and Header Branding

## Logo source of truth

The header brand system now uses a dedicated component layer in `src/components/ui/logo.tsx`.

- **Default header (light theme):** `src/assets/Logo-Primary.svg`
- **Default header (dark theme):** `src/assets/Logo-Primary-dark.svg`
- **Compact / scrolled sticky state:** `src/assets/monogram.svg`

All SVG roots are normalized to rely on:

- `viewBox`
- `preserveAspectRatio="xMidYMid meet"`
- CSS-driven sizing (no inline `width` / `height` attributes)

## Header behavior model

`src/components/navigation/institutional-header.tsx` now tracks scroll depth and enables a compact state once the page scroll passes 18px.

- **Default state:** full logo mark + wordmark
- **Compact state:** monogram only
- Transition is restrained (`duration-normal`) and only adjusts height/spacing, with no dramatic transforms.

## Sizing decisions

Institutional sizing targets were implemented with fixed height rails and auto width:

- **Primary logo:** `h-7 md:h-8` (28px / 32px)
- **Monogram compact logo:** `h-6 md:h-7` (24px / 28px)

This keeps the mark present but restrained, avoiding oversized startup-style branding.

## Spacing and centering refinements

Desktop header layout is now structured as a 3-column grid:

1. left brand zone: `minmax(15rem, 1fr)`
2. center nav zone: `auto`
3. right controls zone: `minmax(15rem, 1fr)`

This creates deliberate breathing room between logo and menu cluster, while visually centering the 4 dropdown groups.

## Accessibility and interaction

- Logo is wrapped with a home link using `aria-label="Invariance Research home"`.
- SVG images are treated as decorative inside the link wrapper (`aria-hidden` on logo container) to avoid redundant verbosity.
- Hover behavior is restrained (opacity-only refinement).
