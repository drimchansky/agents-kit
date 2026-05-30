# Interactions

Details that make UI feel polished — motion, micro-feedback, and the static surfaces and type that frame them. Distilled from ["Details that make interfaces feel better"](https://github.com/jakubkrehel/make-interfaces-feel-better).

For touch-target minimums see `accessibility.md`. For the "animate `transform`/`opacity`, not layout properties" rule see `css.md`.

## Motion Mechanics

- [ ] CSS transitions for interactive state changes — they interpolate toward the latest state and retarget mid-animation when re-triggered
- [ ] CSS keyframes only for one-shot sequences (page enter, loaders) — they restart from frame zero on re-trigger and feel broken when interrupted
- [ ] Never `transition: all` (or Tailwind's bare `transition`) — list exact properties: `transition-[scale,opacity]`
- [ ] `will-change` only on GPU-compositable properties (`transform`, `opacity`, `filter`, `clip-path`), and only when first-frame stutter is observed — never `will-change: all`
- [ ] Exit duration shorter than enter (e.g., 150ms exit vs. 300ms enter)

## Enter and Exit

- [ ] Break enter content into semantic chunks (title, description, CTA); stagger ~100ms between groups; ~80ms between words inside a heading split
- [ ] Combine `opacity` + `translateY(12px)` + `blur(4px)` for enter — fade, lift, sharpen together
- [ ] Use a small fixed `translateY(-12px)` for exit, never the full container height
- [ ] `AnimatePresence initial={false}` for elements already in their default state on first render (icon swaps, tabs); omit when the enter animation is the feature (hero, loader)

## Contextual Icon Transitions

Use these exact values — they're tuned to feel native, not "animated."

- [ ] `scale`: `0.25` → `1` (never `0.5` or `0.6`)
- [ ] `opacity`: `0` → `1`
- [ ] `filter`: `blur(4px)` → `blur(0px)`
- [ ] With `motion`/`framer-motion`: `transition: { type: "spring", duration: 0.3, bounce: 0 }` — bounce stays `0`
- [ ] Without a motion library: cross-fade by keeping both icons in the DOM (one absolutely positioned), timing `cubic-bezier(0.2, 0, 0, 1)` — don't add a dependency just for this

Animate icons that change state (play→pause, like→liked), appear on hover, or indicate loading/success. Don't animate static navigation, decorative, or always-visible icons.

## Tactile Feedback

- [ ] `scale(0.96)` on press for buttons — never below `0.95` (smaller feels exaggerated)
- [ ] A `static` prop (or equivalent) to disable press scale where motion would distract — destructive confirmations, dense toolbars
- [ ] On hover-elevated surfaces, transition the `box-shadow`, not a layout property

## Hit Areas

`accessibility.md` is the canonical baseline (44×44px default; 24×24 WCAG floor). The interaction-specific patterns:

- [ ] Extend a smaller visible target up to the baseline with a centered `::after` pseudo-element — preserves the visual design without shrinking the hit area
- [ ] Adjacent interactive elements never have overlapping hit areas — shrink the pseudo-element to the largest size that avoids collision

## Surfaces

- [ ] **Concentric radius** — `outerRadius = innerRadius + padding`. The most common cause of "feels off" nesting. If padding > 24px, treat layers as independent surfaces and pick each radius freely.
- [ ] **Optical over geometric alignment** — buttons with a trailing icon: icon-side padding = text-side − 2px. Play triangles: shift ~2px right. Asymmetric icons (stars, carets): fix the SVG viewBox where possible.
- [ ] **Shadows over borders for depth** — layered transparent `box-shadow` (1px ring + 1–2 soft layers) adapts to any background. Solid borders stay for dividers, table cells, and form input outlines.
- [ ] **Image outlines** — `outline: 1px solid` with `outline-offset: -1px`. Color is pure black `rgba(0,0,0,0.1)` light, pure white `rgba(255,255,255,0.1)` dark — never a tinted neutral (`slate-900`, `zinc-900`) which picks up the surface color and reads as dirt on the edge.

## Typography Polish

- [ ] `text-wrap: balance` on headings — distributes line lengths evenly; engine-capped at ~6 lines (Chromium) / ~10 (Firefox), silently ignored beyond
- [ ] `text-wrap: pretty` on body text — paragraphs, descriptions, captions; eliminates orphans without re-balancing line lengths
- [ ] Leave defaults on long blocks (10+ lines) — `balance` and `pretty` both cost extra layout work
- [ ] `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;` on the root layout — affects macOS only, safe to apply universally
- [ ] `font-variant-numeric: tabular-nums` on numbers that update (counters, timers, prices, table columns) to prevent layout shift; verify the font's tabular `1` still looks right (Inter widens and re-centers it)

## Common Mistakes

- Same border radius on parent and child — looks geometrically wrong even when both values are "nice"
- `transition: all` — animates colors/padding/shadow you didn't intend and blocks browser optimization
- Dramatic exit animations that fight the user's attention as it moves to the next thing
- `initial={true}` on `AnimatePresence` firing hero animations on every default-state element on first load
- Tinted near-black image outlines (`slate-900`, `zinc-900`) reading as dirt on the edge
- `tabular-nums` applied to static numbers (phone, zip, version) where wider digits aren't needed
- Adding a motion library purely to cross-fade icons — CSS transitions can do it
