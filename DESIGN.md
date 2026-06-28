# Design

## Theme
Light, product-focused utility. Pure white surface; brand warmth carried by olive primary and umber accent, not by tinted page background.

## Color palette (OKLCH)

```css
--color-bg: oklch(1 0 0);
--color-surface: oklch(0.985 0.004 113);
--color-surface-raised: oklch(1 0 0);
--color-border: oklch(0.9 0.008 113);
--color-border-strong: oklch(0.82 0.012 113);
--color-ink: oklch(0.22 0.02 113);
--color-text-secondary: oklch(0.38 0.018 113);
--color-muted: oklch(0.52 0.015 113);
--color-primary: oklch(0.42 0.11 113);
--color-primary-hover: oklch(0.36 0.11 113);
--color-accent: oklch(0.38 0.07 55);
--color-accent-soft: oklch(0.95 0.03 113);
--color-success: oklch(0.42 0.1 145);
--color-success-bg: oklch(0.96 0.03 145);
--color-focus: oklch(0.55 0.14 113);
```

Strategy: **Restrained** — neutrals dominate; primary on CTAs only; accent on links and tags.

## Typography
- Family: **IBM Plex Sans** (single family for UI and headings)
- Scale (rem): 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25
- Body line-length: max 65ch
- Headings: font-weight 600, letter-spacing -0.02em (never tighter than -0.04em)

## Spacing
Base unit 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64.

## Radius
- Controls & inputs: 8px
- Cards & panels: 12px
- Pills & buttons: 999px

## Motion
- Duration: 150–200ms
- Easing: cubic-bezier(0.22, 1, 0.36, 1)
- Respect `prefers-reduced-motion: reduce`

## Components
- Primary button: filled primary, white text
- Secondary button: white surface, border
- Drop zone: dashed border, accent on drag-over
- Tool index: grouped list rows, not identical marketing cards
