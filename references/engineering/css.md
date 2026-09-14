# CSS

## Layout

- [ ] Flex/grid gap, fluid max-width containers, logical spacing.

## Responsive Design

- [ ] Mobile-first min-width queries, relative units, clamp(); no horizontal scroll at 320px.
- [ ] Mobile: dvh/dvw or svh/svw; full width: 100%, excluding scrollbars.

## Container Queries

- [ ] Query components; media queries handle pages/preferences.
- [ ] Set wrapper container-type: inline-size/size; size needs definite block-size.
- [ ] Use cqi/cqb/cqw/cqh in clamp() under qualifying containers; otherwise units use small viewports.

## Tailwind

- [ ] Built-in scales/configured tokens; no arbitrary values or same-property manual CSS.

## Conventions

- [ ] Tokens/custom properties for magic/repeating/themeable values; colocate styles.
- [ ] Low-specificity classes; no !important, deep nesting, global library overrides, or global * resets.
- [ ] Use inherit/initial/unset/revert; declare layers upfront: `@layer reset, base, theme, components, utilities;`.

## Modern Selectors

- [ ] :has() for parent/sibling state, excluding nested :has() and pseudo-elements.
- [ ] :where() for forgiving zero-specificity groups; :is() for specificity-bearing groups.
- [ ] :user-valid/:user-invalid for forms, excluding immediate validity styling with :invalid/:valid (`forms.md`).
- [ ] @scope (...) to (...) for proximity; :not(:last-child)/:not(:disabled) for exclusions.

## Theming and Color Schemes

- [ ] Match token tiers: literal, semantic, UI-general, component; simplify for small projects.
- [ ] Root color-scheme: light dark; defer light-dark() through unregistered variables for descendant schemes.
- [ ] Accent-color brands native widgets; forced-colors: active replaces meaningful backgrounds/shadows/border images with system colors.
- [ ] Reserve forced-color-adjust: none for color information, e.g. swatches.

## Modern Color

- [ ] Specify gradient/mix interpolation; mix tints/shades in Oklab; avoid direct OKLCH lightness edits until gamut mapping supports them.
- [ ] Drop-shadow() for nonrectangular/translucent shapes; layered box-shadow for rectangular depth (`interactions.md`).

## Modern Layout

- [ ] Flex: one axis; grid: two; subgrid: ancestor tracks; anchors: overlays.
- [ ] Precede subgrid declarations with explicit same-axis track fallbacks.
- [ ] Grid-template-areas for pages; place-* for alignment; aspect-ratio for media.
- [ ] Overflow: clip avoids scroll containment; overflow-clip-margin controls spill; scrollbar-gutter: stable reserves scrollbars.
- [ ] Widgets use overscroll-behavior: contain/none; interactive content excludes grid-auto-flow: dense.
- [ ] Use native overlays (`html.md`).

## Anchor Positioning

- [ ] Trigger anchor-name: --x; floater position-anchor: --x plus absolute/fixed position.
- [ ] Prefer position-area (nine-cell grid, e.g. block-end center); anchor()/anchor-size() for finer control.
- [ ] Add position-try-fallbacks: flip-block, flip-inline; @position-try for custom fallbacks.
- [ ] Repeaters use anchor-scope: --x; duplicate names otherwise select the last anchor.
- [ ] Position-visibility: anchors-visible hides floaters; display:none anchors redirect to nearest positioned ancestors.
- [ ] Popovertarget implicitly anchors to invokers (`html.md` → Native Overlays).
- [ ] Detect `@supports (anchor-name: --a)`; retain usable unanchored fallbacks.

## Transitioning Discrete Properties

- [ ] Pair transition-behavior: allow-discrete with @starting-style for display/dialog/popover transitions.
- [ ] Reduce motion per animation (`accessibility.md` Motion & User Preferences).

## Common Mistakes

- [ ] Height:100% needs explicit ancestor heights; fix overflow instead of hiding it.
- [ ] Plan stacking contexts; native overlays need no z-index.
- [ ] Animate transform/opacity, excluding layout; prefer CSS effects.
- [ ] Scope text-wrap: balance to headings, pretty to short/medium copy.
