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

- **Primary logo:** `h-8 md:h-10` (32px / 40px)
- **Monogram compact logo:** `h-8 md:h-9` (32px / 36px)

This keeps the mark present but restrained, avoiding oversized startup-style branding.

## Spacing and centering refinements

Desktop header layout now uses a left-anchored flex composition:

1. logo block on the left
2. nav block offset with `ml-10` / `xl:ml-14`
3. right controls pinned with `ml-auto`

This keeps a deliberate 40px–56px separation between logo and nav while shifting the nav slightly left from perfect center for improved optical balance.

## Accessibility and interaction

- Logo is wrapped with a home link using `aria-label="Invariance Research home"`.
- SVG images are treated as decorative inside the link wrapper (`aria-hidden` on logo container) to avoid redundant verbosity.
- Hover behavior is restrained (opacity-only refinement).
