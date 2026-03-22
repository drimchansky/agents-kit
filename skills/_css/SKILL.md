---
name: _css
description: CSS patterns, layout, responsive design, and styling conventions. Apply when writing or reviewing styles.
---

# CSS

## Layout

- Prefer `gap` over margins between flex/grid children
- Avoid fixed widths on containers — use `max-width` with fluid defaults
- Use logical properties (`margin-inline`, `padding-block`) for internationalization-friendly spacing

## Responsive Design

- Design mobile-first — use `min-width` media queries to add complexity at larger breakpoints
- Use relative units (`rem`, `em`, `%`, `vw`/`vh`) over fixed `px` for sizing that should scale
- Test layouts at common breakpoints and between them — don't just test exact breakpoints
- Use `clamp()` for fluid typography and spacing that scales between a min and max
- Ensure content is usable without horizontal scrolling at 320px viewport width

## Tailwind

- Avoid arbitrary values (`max-h-[500px]`, `w-[calc(...)]`) — prefer design tokens, className props, or CSS custom properties
- Use Tailwind's built-in scale values; if no scale value fits, consider whether a custom token belongs in the config
- Don't mix Tailwind utilities with manual CSS for the same property — pick one approach per concern

## CSS-Only Techniques

- When implementing visual effects prefer pure CSS solutions over JS-driven approaches

## Conventions

- Avoid magic numbers — use design tokens or variables for spacing, colors, and typography
- Use CSS custom properties (`--color-primary`, `--space-md`) for values that repeat or should be themeable
- Keep specificity low — prefer class selectors; avoid `!important` and deep nesting
- Colocate styles with the component they belong to (CSS Modules, scoped styles, or utility classes)
- Don't override library/framework component styles with global CSS — use their intended customization API

## Common Pitfalls

- Don't set `height: 100%` without ensuring all ancestors have explicit heights
- Avoid `overflow: hidden` as a band-aid — find and fix the element that overflows
- Don't use `z-index` without a stacking context strategy — define named layers or a scale
- Don't animate `width`/`height`/`top`/`left` — use `transform` and `opacity` for performant animations
