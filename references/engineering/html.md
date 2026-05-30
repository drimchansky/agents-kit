# HTML

Semantic structure, native overlays, and document metadata. See `accessibility.md` for ARIA/keyboard depth, `forms.md` for form-specific HTML, and `performance.md` for asset-loading details.

## Document

- [ ] `<!DOCTYPE html>`, `<html lang="...">`, `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- [ ] One `<h1>` per page (or per top-level dialog); headings descend sequentially, no skips from `<h2>` to `<h4>`
- [ ] Wrap content in landmarks: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`; `<search>` for site/page search
- [ ] Unique `<title>` per page with the unique part first: `"Reports | Acme"` not `"Acme | Reports"`

## Semantic Elements

- [ ] `<button>` for actions (toggles, JS triggers, form submits); `<a>` only when the action is "navigate to a URL"
- [ ] `<ul>`/`<ol>`/`<dl>` for list-shaped content — assistive tech reads the count upfront and lets users skip the group
- [ ] `<blockquote cite="…">` for extended quotes; `<cite>` is the **work title**, not the author
- [ ] `<figure>`/`<figcaption>` for self-contained referenced content (a code block, diagram, callout image)
- [ ] `<code>` inline; `<pre><code>` for blocks; `<pre tabindex="0">` if the block can horizontally scroll
- [ ] Prefer native semantics over ARIA — `<button>` already announces as a button; `<nav>` is already a navigation landmark. Don't add `role="list"` to a `<ul>` unless Safari has stripped list semantics via `list-style: none`/`display: flex|grid`

## Native Overlays

- [ ] Modals: `<dialog>` + `dialog.showModal()` — free focus trap, backdrop, Esc-to-close, no JS focus-trap library needed
- [ ] Click-invoked menus / disclosure panels: `[popover]` + `popovertarget` — top-layer, light-dismiss, no JS toggle needed
- [ ] Hover/focus tooltips: `[popover]` (consider `popover="hint"` for non-interactive hints) — still needs JS event handlers (`pointerenter`/`focus`/`pointerleave`/`blur`) since there's no native hover trigger. Keep keyboard parity (`focus` mirrors `pointerenter`)
- [ ] Toasts / status messages: imperatively shown via `element.showPopover()`; pair with a live region (`role="status"`, `role="alert"`, or `aria-live`) so screen readers actually announce them — see `accessibility.md`
- [ ] Native light-dismiss for `<dialog>`: `<dialog closedby="any">` — Chrome 134+ only at writing; not yet in Firefox/Safari. Feature-detect (`'closedBy' in HTMLDialogElement.prototype`) and fall back to a manual `click` handler on the `<dialog>` that checks if the click landed on the backdrop
- [ ] Close + return value without JS: `<form method="dialog">` with `<button value="confirm">`; read `dialog.returnValue` on the `close` event
- [ ] Disclosures: `<details>`/`<summary>` for accordions; add `name="group"` on siblings to make the set exclusive (opens one, closes others)
- [ ] Style `<dialog>` backdrop via `::backdrop`; style `<details>` content via `details::details-content`
- [ ] Don't nest interactive elements inside `<summary>` — `<summary>` is itself a button and breaks focus order
- [ ] Don't call `.showModal()` on an element with a `popover` attribute (mutually exclusive runtime states). Exception: `<dialog popover="auto">` declarative combo is valid

## Resource Prioritization

- [ ] LCP image rendered as `<img>` in the initial HTML (not mounted by JS) with `fetchpriority="high"`, explicit `width`/`height`
- [ ] CSS background-image acting as LCP: `<link rel="preload" as="image" href="…" fetchpriority="high" type="image/…">`
- [ ] `loading="lazy"` on below-the-fold `<img>` and `<iframe>` — never on the LCP image (it delays the fetch)
- [ ] `<picture>` with multiple `<source type="image/avif|webp">` for format negotiation; `srcset`+`sizes` for resolution switching
- [ ] `fetchpriority="low"` to demote above-the-fold non-LCP elements (carousel slides 2–N, decorative images)
- [ ] `<link rel="preconnect">` for known third-party origins you'll fetch from soon; `rel="dns-prefetch"` is a lighter fallback. Don't preconnect everything — it's a zero-sum budget

## Focus Boundaries

- [ ] `inert` on entire offscreen sections (drawer-closed background, hidden wizard steps) — removes them from tab order AND the accessibility tree
- [ ] Pair `[inert]` with a visual cue (`opacity: 0.5`, `cursor: default`) so the inertness is apparent
- [ ] `tabindex="0"` to add a non-interactive element to tab order; `tabindex="-1"` for programmatic-focus targets (skip-link targets, focus management). Never positive `tabindex` values
- [ ] Don't override visual order with CSS (`flex-direction: *-reverse`, `order`, `grid-auto-flow: dense`) without realigning DOM order — keyboard tab flow follows DOM, not paint

## Forms-Related HTML

See `forms.md` for the full reference. HTML-level features worth knowing:

- [ ] `form="form-id"` attribute on an input lets it associate with a form anywhere in the document, not just an ancestor `<form>`
- [ ] `<input list="id">` + `<datalist>` for lightweight autosuggest — note: limited styling, some screen-reader quirks

## Media

- [ ] `<video>` and `<audio>` declare explicit `width`/`height` and a `poster` to prevent CLS
- [ ] `preload="none"` on non-critical videos so the poster + metadata don't auto-download
- [ ] Captions/subtitles via `<track kind="captions" srclang="en" src="*.vtt">`
- [ ] Background videos: `muted`, `autoplay`, `playsinline`, **omit** `controls` (so the element is non-focusable). Only then is `aria-hidden="true"` safe
- [ ] Don't `aria-hidden` an `<iframe>` or any element that remains keyboard-focusable — focus lands somewhere unannounced

## Dynamic Styling

- [ ] Pass data into CSS via `style="--var: value"` setting custom properties — keep style logic in the stylesheet
- [ ] No inline event handlers (`onclick=`, `onmouseover=`) — use `addEventListener`; CSP often forbids them anyway

## Common Mistakes

- `<a href="#">` with a click handler used as a button — keyboard, screen reader, and "Open in new tab" all mismatch the actual behavior
- `<div onclick>` interactive widgets — no native focus, no Enter/Space, no role
- Missing `width`/`height` on images and media — every below-the-fold load shifts layout
- Hand-rolled focus traps on a custom modal — `<dialog>` does it natively and correctly
- Decorative SVG without `aria-hidden="true"` — read out as "image" with no useful name
- Skipped heading levels (`<h2>` to `<h4>`) — screen-reader outline navigation breaks
- `autocomplete="off"` on credential or address forms — browsers ignore it; you only lose user help (see `forms.md`)
