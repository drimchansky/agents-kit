# CSS

Motion values: `interactions.md`. Reduced motion and forced colors: `accessibility.md` § *Motion & User Preferences*.

## Native First

- [ ] Prefer native CSS over JavaScript or library equivalents: container queries, :has(), @scope, subgrid, and anchor positioning.
- [ ] Query components with container queries; media queries handle pages and preferences.
- [ ] Pair transition-behavior: allow-discrete with @starting-style for display/dialog/popover transitions.
- [ ] Feature-detect newer features with @supports, e.g. `@supports (anchor-name: --a)`; retain a usable fallback.
- [ ] Anchored floaters need absolute/fixed position; repeaters need anchor-scope, or duplicate names resolve to the last anchor.

## Responsive Design

- [ ] Mobile-first min-width queries; no horizontal scroll at 320px.
- [ ] Full width uses 100%; viewport-width units ignore classic scrollbars.

## Conventions

- [ ] Tailwind: built-in scales and configured tokens; no arbitrary values or same-property manual CSS.
- [ ] Tokens/custom properties for magic, repeating, or themeable values; colocate styles.
- [ ] Match token tiers: literal, semantic, UI-general, component; simplify for small projects.
- [ ] Declare layers upfront: `@layer reset, base, theme, components, utilities;`.
- [ ] Low-specificity classes; no !important, global library overrides, or global * resets.
- [ ] Pass dynamic values through inline custom properties; keep styling in stylesheets.

## Color

- [ ] Root color-scheme: light dark.
- [ ] Mix tints/shades in Oklab; avoid direct OKLCH lightness edits until gamut mapping supports them.
