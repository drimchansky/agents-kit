---
name: _css
description: CSS patterns, layout, responsive design, and styling conventions. Apply when writing or reviewing styles.
---

# CSS

## Layout

- Use Flexbox for one-dimensional layout (row or column); use Grid for two-dimensional layout
- Prefer `gap` over margins between flex/grid children
- Avoid fixed widths on containers — use `max-width` with fluid defaults
- Use logical properties (`margin-inline`, `padding-block`) for internationalization-friendly spacing
- Don't use `float` for layout — it's for wrapping text around images

## Responsive Design

- Design mobile-first — use `min-width` media queries to add complexity at larger breakpoints
- Use relative units (`rem`, `em`, `%`, `vw`/`vh`) over fixed `px` for sizing that should scale
- Test layouts at common breakpoints and between them — don't just test exact breakpoints
- Use `clamp()` for fluid typography and spacing that scales between a min and max
- Ensure content is usable without horizontal scrolling at 320px viewport width

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
- Avoid `position: absolute` inside `position: static` parents — the absolute child won't be positioned relative to the parent
- Don't animate `width`/`height`/`top`/`left` — use `transform` and `opacity` for performant animations
