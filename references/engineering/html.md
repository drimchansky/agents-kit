# HTML

## Document

- [ ] HTML doctype, lang, viewport width=device-width/initial-scale=1.0; one h1 per page/top-level dialog.
- [ ] Apply `accessibility.md` headings/landmarks; unique-first titles, e.g. Reports | Acme.

## Semantic Elements

- [ ] Buttons act; anchors navigate. Prefer native semantics (`accessibility.md`).
- [ ] Lists use ul/ol/dl; role="list" only restores CSS-stripped Safari semantics.
- [ ] Extended quotes use blockquote/cite; cite names the work, excluding author.
- [ ] Figure/figcaption for referenced content; code/pre for inline/block code; tabindex="0" on horizontally scrolling pre.

## Native Overlays

- [ ] Modals: dialog.showModal(); click menus/disclosures: popover plus popovertarget (`accessibility.md` for focus behavior).
- [ ] Hover hints: optional popover="hint" plus pointerenter/leave and matching focus/blur handlers.
- [ ] Toasts use showPopover() with announcing live regions.
- [ ] Detect `'closedBy' in HTMLDialogElement.prototype`; use closedby="any" or backdrop-click fallback.
- [ ] Form method="dialog" with button value closes/returns; read returnValue on close.
- [ ] Details/summary for disclosures; shared name makes accordions exclusive; exclude interactive summary children.
- [ ] Style ::backdrop and details::details-content; anchor to invokers (`css.md` → Anchor Positioning).
- [ ] No showModal() on elements with popover; declarative dialog popover="auto" remains valid.

## Resource Prioritization

- [ ] Apply `performance.md` LCP, hints, and dimension checks; lazy-load below-fold images/iframes only.
- [ ] Picture/source negotiates AVIF/WebP; srcset/sizes selects resolution; fetchpriority="low" demotes non-LCP images.

## Focus Boundaries

- [ ] Apply `accessibility.md` inertness/visual-cue/order checks; tabindex 0 adds tab stops, -1 allows programmatic focus.

## Forms-Related HTML

- [ ] Link distant controls through form="form-id" (`forms.md`).
- [ ] Input list/datalist suggestions have styling/screen-reader limitations.

## Media

- [ ] Reserve dimensions/posters; noncritical videos use preload="none"; supply track kind="captions", srclang, and VTT src.
- [ ] Background videos use muted/autoplay/playsinline without controls before ARIA hiding; exclude ARIA-hidden focusable elements/iframes.

## Dynamic Styling

- [ ] Pass data through inline CSS variables; keep styling in stylesheets and events in addEventListener.

## Common Mistakes

- [ ] Hide decorative SVGs; retain credential/address autocomplete (`forms.md`).
