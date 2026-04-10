# CSS

## Layout

- [ ] `gap` over margins between flex/grid children
- [ ] No fixed widths on containers — `max-width` with fluid defaults
- [ ] Logical properties (`margin-inline`, `padding-block`) for i18n-friendly spacing

## Responsive Design

- [ ] Mobile-first — `min-width` media queries
- [ ] Relative units (`rem`, `em`, `%`, `vw`/`vh`) for scalable sizing
- [ ] `clamp()` for fluid typography and spacing
- [ ] Usable without horizontal scroll at 320px viewport

## Tailwind

- [ ] No arbitrary values (`max-h-[500px]`) — use design tokens or config
- [ ] Built-in scale values; custom tokens in config if no fit
- [ ] Don't mix Tailwind utilities with manual CSS for the same property

## Conventions

- [ ] No magic numbers — design tokens or variables for spacing, colors, typography
- [ ] CSS custom properties for repeating/themeable values
- [ ] Low specificity — class selectors, no `!important`, no deep nesting
- [ ] Colocate styles with their component
- [ ] Don't override library component styles with global CSS

## Common Pitfalls

- [ ] No `height: 100%` without explicit ancestor heights
- [ ] No `overflow: hidden` as a band-aid — fix the overflow source
- [ ] No `z-index` without a stacking context strategy
- [ ] Animate `transform` and `opacity`, not `width`/`height`/`top`/`left`
- [ ] CSS-only solutions over JS for visual effects when possible
