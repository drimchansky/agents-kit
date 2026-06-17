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
- [ ] `dvh`/`dvw` (or `svh`/`svw`) over `vh`/`vw` on mobile to account for browser-chrome shift
- [ ] `100%` (or `100dvw`) for full-width — `100vw` ignores scrollbar width and overflows horizontally

## Container Queries

Mental model: container queries = component context. Media queries = page-level layout and user preferences (`prefers-color-scheme`, `prefers-reduced-motion`).

- [ ] Establish a context with `container-type: inline-size` (1D) or `size` (2D) on a wrapper before descendants can query. Shorthand: `container: card / inline-size` (name / type)
- [ ] Use container query units (`cqi`, `cqb`, `cqw`, `cqh`) in `clamp()` to scale type/spacing to component width, not viewport
- [ ] With `container-type: size`, the container ignores intrinsic child size — give it a definite block-size or descendants collapse
- [ ] Don't use container query units inside descendants of a non-qualifying ancestor — they silently fall back to small viewport units

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
- [ ] Use keywords (`inherit`, `initial`, `unset`, `revert`) to express intent — `transition: inherit` beats restating every transition property on a child
- [ ] Declare cascade layers upfront: `@layer reset, base, theme, components, utilities;` — gives predictable priority zones across the codebase
- [ ] Don't write global `*` resets — web components and lower cascade layers can't override them without `!important`. Scope to specific elements/conditions instead

## Modern Selectors

- [ ] `:has()` for parent/sibling state styling — `label:has(:checked)` instead of toggling a class in JS. Don't nest `:has()` and don't use pseudo-elements inside it
- [ ] `:where()` for forgiving, zero-specificity grouping (often used for fallback selectors): `[popover]:where(:popover-open, .\:popover-open) { … }` covers native + polyfill in one rule
- [ ] `:is()` when you want grouping AND specificity (`:is(.a, .b) > c`)
- [ ] `:user-valid` / `:user-invalid` for form styling — never `:valid` / `:invalid`, which flag required-empty fields on page load (see `forms.md`)
- [ ] `@scope (...) to (...)` for proximity-based scoping where specificity doesn't express intent — closest-ancestor theming, "all `.card` content except deeply nested `.content`"
- [ ] `:not(:last-child)` is a clearer expression of "between items" than overriding `:last-child`; same idea for `:not(:disabled)` on hover states

## Theming and Color Schemes

Organize design tokens in tiers, layered:

1. Literal (`--color-blue-10`, `--size-xl`)
2. Semantic (`--color-accent`, `--font-heading`)
3. UI-general (`--ui-border`, `--surface-bg`)
4. Component (`--button-bg-primary-hover`)

Small projects need fewer tiers. Reuse existing conventions before inventing new ones.

- [ ] `color-scheme: light dark` on `:root` plus `light-dark(<light>, <dark>)` for color tokens. Resolve `light-dark()` as late as possible (pass it through unregistered custom properties) so descendants with a different `color-scheme` still adapt
- [ ] `accent-color` to brand native form widgets (checkboxes, radios, sliders, progress) without abandoning semantics
- [ ] Forced Colors Mode strips `background-image`, `box-shadow`, `border-image`. When any carries information, provide `@media (forced-colors: active)` fallbacks using system color keywords (`CanvasText`, `LinkText`, `Highlight`, `GrayText`). Use `forced-color-adjust: none` only where the color **is** the information (syntax highlighter, color picker swatch)

## Modern Color

- [ ] Specify gradient and `color-mix()` interpolation explicitly: `linear-gradient(in oklab, …)`. `oklch` preserves chroma but can escape gamut; `oklab` stays in gamut but desaturates between opposite hues
- [ ] Generate tints/shades via `color-mix(in oklab, var(--accent), white 20%)`. Don't adjust the L channel of `oklch` directly until browsers gamut-map; results are unpredictable today
- [ ] `filter: drop-shadow()` for shadows on non-rectangular shapes or transparent PNGs; `box-shadow` for rectangular elevation
- [ ] Layer multiple `box-shadow`s for natural soft depth (see `interactions.md` for the shadow-as-border recipe)

## Modern Layout

- [ ] Pick layout by decision tree: single axis → flex; rows+columns → grid; nested needs to align to grandparent tracks → subgrid; floating overlay tethered to a trigger → anchor positioning
- [ ] Subgrid (`grid-template-rows: subgrid`) solves ragged-edge alignment across sibling cards — titles, bodies, and CTAs line up across the row. Same-cascade fallback: declare `grid-template-rows: auto 1fr;` (or whatever explicit tracks suit) immediately before the subgrid line; non-supporting browsers ignore the second declaration. For column-axis subgrid, use a same-axis fallback (`grid-template-columns: <tracks>;` before `grid-template-columns: subgrid;`) — axes are independent
- [ ] `grid-template-areas` for page-level layouts — area names are self-documenting and the declaration aligns visually
- [ ] `place-content` / `place-items` / `place-self` to align both axes in one declaration
- [ ] `aspect-ratio` to reserve space for media before assets load (prevents CLS)
- [ ] `overflow: clip` to clip *without* establishing a scroll container; opt into spillover with `overflow-clip-margin`
- [ ] `scrollbar-gutter: stable` reserves scrollbar space and prevents shift when content grows
- [ ] `overscroll-behavior: contain` (or `none`) on scrollable widgets — keeps scroll chains from bubbling into the page
- [ ] Don't use `grid-auto-flow: dense` on interactive content — it reorders visually but keyboard tab still follows DOM
- [ ] For native overlays (`<dialog>`, `[popover]`) and anchor positioning, see `html.md`

## Transitioning Discrete Properties

- [ ] Animate `display`, `<dialog>` open/close, `[popover]` show/hide with `transition-behavior: allow-discrete;` paired with a `@starting-style` block defining the "from" state
- [ ] For reduced-motion variants, prefer per-animation overrides — global `animation-duration: 0.01ms !important` often makes specific animations more jarring (see `accessibility.md` Motion & User Preferences)

## Common Mistakes

- [ ] No `height: 100%` without explicit ancestor heights
- [ ] No `overflow: hidden` as a band-aid when you want clipping — use `overflow: clip` (no scroll container) and fix the real overflow source
- [ ] No `z-index` without a stacking-context strategy — `[popover]` and `<dialog>` live in the top layer, no z-index needed
- [ ] Animate `transform` and `opacity`, not `width`/`height`/`top`/`left`
- [ ] CSS-only solutions over JS for visual effects when possible
- [ ] No `text-wrap: balance` or `pretty` applied via `*` — they have a layout cost; scope to headings (`balance`) and short-to-medium copy (`pretty`)
- [ ] No `:invalid` / `:valid` styling on form fields — use `:user-invalid` / `:user-valid` so styling doesn't fire on page load (see `forms.md`)
