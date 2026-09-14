# Interactions

[Interface details](https://github.com/jakubkrehel/make-interfaces-feel-better); motion properties: `css.md`; touch targets: `accessibility.md`.

## Motion Mechanics

- [ ] Transitions for interaction; keyframes for one-shot sequences.
- [ ] List transition properties; no `all` or bare Tailwind `transition`.
- [ ] `will-change` only for observed stutter on transform/opacity/filter/clip-path; no `all`.
- [ ] Exit faster: 150ms versus 300ms entry.

## Enter and Exit

- [ ] Stagger semantic groups ~100ms, split-heading words ~80ms.
- [ ] Enter: opacity/translateY(12px)/blur(4px); exit: fixed translateY(-12px), excluding full height.
- [ ] `AnimatePresence initial={false}` for settled elements; omit for featured entrances.

## Contextual Icon Transitions

- [ ] Exact scale 0.25→1, opacity 0→1, blur 4px→0px.
- [ ] Motion/framer-motion: `transition: { type: "spring", duration: 0.3, bounce: 0 }`.
- [ ] CSS: both icons, one absolute; crossfade `cubic-bezier(0.2, 0, 0, 1)`.
- [ ] Animate state/hover/loading/success, excluding static icons; no crossfade-only library.

## Tactile Feedback

- [ ] Press scale 0.96, floor 0.95; static opt-out.
- [ ] Hover transitions box-shadow, excluding layout.

## Hit Areas

- [ ] Expand targets with centered `::after` to `accessibility.md` sizes without overlap.

## Surfaces

- [ ] Radii: outer = inner + padding; independent above 24px padding.
- [ ] Optical alignment: icon padding = text padding −2px; play triangles ~2px right; fix asymmetric viewBoxes.
- [ ] Depth: transparent 1px ring +1–2 soft shadows; solid borders for dividers/cells/inputs.
- [ ] Image outlines: 1px solid, offset -1px; 10% pure black/light, white/dark. No tint.

## Typography Polish

- [ ] Balance headings; pretty-wrap body; defaults for 10+ lines.
- [ ] Root smoothing: `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`.
- [ ] Tabular numerals for updating/aligned numbers; inspect tabular 1.

## Common Mistakes

- [ ] Exclude static phone/ZIP/version numbers from tabular numerals.
