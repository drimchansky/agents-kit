# Accessibility

## Markup

- [ ] Sequential headings, landmarks, `<search>`, and native semantics (`html.md`); custom widgets need roles/names/keyboard support.
- [ ] Skip link targets focusable `<main id="content" tabindex="-1">`.
- [ ] Prefer `aria-labelledby` on visible text, then `aria-label`; omit role repetition.
- [ ] No ARIA-hidden focusable elements/ancestors or redundant ARIA; restore CSS-stripped Safari list semantics with `role="list"`.

## Keyboard

- [ ] Match role keys: Enter/Space/Escape/arrows. Custom buttons fire Enter on keydown, Space on keyup.
- [ ] Align DOM/visual order; no positive tabindex or conflicting CSS reordering.
- [ ] Preserve high-contrast focus-visible indication.
- [ ] Trap modal focus; restore trigger on close; prefer native dialog behavior.

## Visual

- [ ] Contrast: normal text 4.5:1; large text and controls/states/focus rings 3:1.
- [ ] Supplement color with text/icons/patterns.
- [ ] Touch targets: 44×44px default, 24×24 WCAG 2.5.8 AA floor; enforce minimum logical dimensions.
- [ ] Support 200% zoom; columns ~80 characters maximum; avoid justification.

## Forms

- [ ] Apply `forms.md` labels, grouping, hints, error links/styling, and announcements.
- [ ] Mirror visual validity to aria-invalid using the pattern below.

### Accessible Error Announcement

Synchronize interacted fields on blur/input:

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

## Native Dialogs & Overlays

- [ ] Use dialog.showModal() for modal focus/backdrop/Escape/inertness; exclude custom focus-trap libraries.
- [ ] Use popovers for nonmodal flyouts; custom overlays make background sections inert, visually indicated where visible.

## Live Regions

- [ ] Share one polite and one assertive region through one announcer.
- [ ] Reserve assertive/alert for critical time-sensitive updates; otherwise polite.
- [ ] Debounce updates; exclude inert DOM and uninformative loading interstitials.

## Motion & User Preferences

- [ ] Reduce nonessential motion per animation under prefers-reduced-motion; exclude global 0.01ms !important overrides.
- [ ] Honor prefers-color-scheme plus color-scheme; use prefers-contrast: more when accents need reinforcement.
- [ ] Under forced-colors: active, replace meaningful backgrounds/shadows/border images with system colors.

## Common Mistakes

- [ ] Hide decorative SVGs with aria-hidden="true".
