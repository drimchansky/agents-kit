# Accessibility

See `html.md` for native semantics and `forms.md` for form a11y depth.

## Markup

- [ ] Heading levels (`h1`–`h6`) in logical order, no skips
- [ ] Native HTML elements over ARIA — custom widgets need role, accessible name, keyboard support
- [ ] Place all content within landmarks (`<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`); `<search>` for site/page search
- [ ] Skip link at the top of the page targeting a focusable element: `<main id="content" tabindex="-1">`
- [ ] `aria-label` or `aria-labelledby` for elements without visible text — prefer `aria-labelledby` referencing existing visible text over duplicated `aria-label`
- [ ] No `aria-hidden="true"` on focusable elements (or their ancestors)
- [ ] Don't repeat the role in the name — `<nav aria-label="Primary navigation">` reads "Primary navigation navigation"
- [ ] Don't redundantly add what HTML already provides — `<ul role="list">`, `<input required aria-required="true">`. Exception: Safari strips `<ul>` list semantics when `list-style: none`/`display: flex|grid` is set; `role="list"` restores them

## Keyboard

- [ ] Custom widgets handle `Enter`, `Space`, `Escape`, arrow keys per role. For button-like custom elements, `Enter` fires on `keydown`, `Space` on `keyup` — matches native `<button>`
- [ ] Tab order follows visual reading order — no positive `tabindex`. Don't reorder with `flex-direction: *-reverse`, `order`, or `grid-auto-flow: dense` without aligning the DOM
- [ ] `:focus-visible` outlines preserved with high contrast — never `outline: none` without a replacement
- [ ] Focus trapped inside modals; restored to the trigger on close. For `<dialog>` + `.showModal()` the browser does this for free — don't write a focus-trap library

## Visual

- [ ] 4.5:1 contrast ratio for normal text, 3:1 for large text
- [ ] 3:1 for non-text components — input borders, icon-only controls, focus rings, active states (checkmarks, switch thumbs)
- [ ] Color never sole information carrier — add icons, text, or patterns
- [ ] Touch targets ≥ 44×44px (or 24×24 minimum per WCAG 2.5.8 AA, but 44 matches platform defaults). Enforce with `min-block-size`/`min-inline-size`, not fixed dimensions
- [ ] Usable at 200% browser zoom; cap text columns around 80 characters for readability
- [ ] Don't use `text-align: justify` — uneven word spacing hurts readers with cognitive disabilities

## Forms

See `forms.md` for the full reference.

- [ ] Every input has a visible, associated `<label>` — `<label for="id">` linked to `<input id="id">`. Placeholder is not a label
- [ ] Related inputs grouped with `<fieldset>` and `<legend>`
- [ ] Hint text linked via `aria-describedby`, **above** the input so autofill popovers don't cover it
- [ ] Errors connected via `aria-errormessage` (preferred) or `aria-describedby`; trigger error styling with `:user-invalid`, not `:invalid` (which fires on page load for empty required fields)
- [ ] `aria-invalid="true"` mirrored to `:user-invalid` state via blur/input listeners so screen-reader state matches visual — see the accessible-error-announcement pattern below
- [ ] Form submission results announced via live regions (see Live Regions)

### Accessible Error Announcement

Bridge `:user-invalid` (visual) with `aria-invalid` (programmatic) using event listeners:

```js
const updateAriaState = (event) => {
  const el = event.target;
  if (!el.matches?.('input, textarea, select')) return;
  if (el.matches(':user-invalid')) el.setAttribute('aria-invalid', 'true');
  else el.removeAttribute('aria-invalid');
};
document.addEventListener('blur', updateAriaState, true);  // capture: blur doesn't bubble
document.addEventListener('input', (e) => {
  if (e.target.getAttribute?.('aria-invalid') === 'true') updateAriaState(e);
});
```

This avoids announcing errors before the user has interacted with the field while keeping ARIA state in lockstep with the visual one.

## Native Dialogs & Overlays

- [ ] Modals: `<dialog>` + `.showModal()` — browser handles focus trap, backdrop, Esc-to-close, and outside-content inertness for free. Don't ship a focus-trap library
- [ ] Non-modal flyouts: `[popover]` — top layer, light-dismiss, no JS toggle
- [ ] Custom overlay you can't replace with `<dialog>`? Apply `inert` to siblings/background sections so they leave the tab order AND the accessibility tree
- [ ] Pair `inert` with a visual cue (`opacity: 0.5`, `cursor: default`) so the inert state is visible
- [ ] Don't `aria-hidden` an element that's still focusable — focus lands on something the screen reader won't announce

## Live Regions

Live regions let assistive tech announce updates without focus changes. Easy to overuse.

- [ ] One `polite` region and one `assertive` region per page, used through a single announcer abstraction (most frameworks ship one) — keeps announcements consistent and debounceable
- [ ] `aria-live="assertive"` (or `role="alert"`) only for critical/time-sensitive updates (session timeout, data-loss warning). Everything else: `polite`
- [ ] Debounce frequently-changing regions (combobox result counts as the user types) — otherwise it spams the screen-reader queue
- [ ] Don't queue announcements into newly-inert DOM (open dialog, hidden section) — they get unannounced or read from unreachable content
- [ ] Don't announce trivial interstitials ("Loading…", "Updating…") unless they carry information

## Motion & User Preferences

- [ ] `@media (prefers-reduced-motion: reduce)` — disable or shorten non-essential motion (auto-playing carousels, scroll-driven animations, large transitions)
- [ ] Honor `@media (prefers-color-scheme: ...)` together with the `color-scheme` CSS property so UA-rendered controls (scrollbars, form widgets) match
- [ ] Reach for `@media (prefers-contrast: more)` only when the design uses low-contrast accents that need reinforcement; skip if the baseline already meets WCAG
- [ ] Don't `animation-duration: 0.01ms !important` globally for reduced motion — it makes certain animations more jarring. Apply reduced-motion variants per-animation
- [ ] Forced Colors Mode (Windows High Contrast) strips `background-image`, `box-shadow`, and `border-image`. If those carry information (focus, dividers, state), provide a `forced-colors: active` fallback using system color keywords (`CanvasText`, `LinkText`, `Highlight`, `GrayText`)

## Common Mistakes

- `placeholder` used as the only label — disappears when the field is filled and several screen readers don't announce it
- Hand-rolled focus trap on a custom modal — `<dialog>.showModal()` does this natively and correctly
- `aria-label` duplicated when visible text exists — translation tools see the visible text but not the label, so they diverge
- Skipping heading levels (`<h2>` → `<h4>`) — breaks screen-reader outline navigation
- Decorative SVG without `aria-hidden="true"` — announced as "image" with no useful name
- Positive `tabindex` values to "fix" tab order — only mask the real layout issue and create unreachable elements
