# Accessibility

Check every UI change for names and roles, keyboard operation, focus order and visibility, WCAG AA contrast, target size, 200% zoom, and reduced motion.

## Markup

- [ ] Prefer native semantics; custom widgets need roles, names, and keyboard support.
- [ ] Skip link targets focusable `<main id="content" tabindex="-1">`.
- [ ] Prefer `aria-labelledby` on visible text, then `aria-label`; omit role repetition.
- [ ] Restore CSS-stripped Safari list semantics with `role="list"`.
- [ ] Page titles lead with the unique part, e.g. Reports | Acme.

## Keyboard

- [ ] Custom buttons fire Enter on keydown, Space on keyup.
- [ ] Align DOM and visual order; no positive tabindex.

## Targets

- [ ] Touch targets: 44×44px default, 24×24 WCAG 2.5.8 AA floor; enforce minimum logical dimensions.

## Forms

- [ ] Apply `forms.md`; mirror visual validity to aria-invalid using the pattern below.

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

- [ ] Modals use dialog.showModal() for focus, backdrop, Escape, and inertness; exclude custom focus-trap libraries.
- [ ] Click menus and nonmodal flyouts use popover plus popovertarget.
- [ ] Toasts use showPopover(); announce them through § *Live Regions*.
- [ ] Disclosures use details/summary; a shared name makes accordions exclusive.
- [ ] Feature-detect newer attributes such as closedby and popover="hint"; retain a working fallback.
- [ ] Custom overlays make background sections inert.

## Live Regions

- [ ] Share one polite and one assertive region through one announcer.
- [ ] Reserve assertive/alert for critical time-sensitive updates; debounce updates; exclude inert DOM.

## Motion & User Preferences

- [ ] Reduce nonessential motion per animation under prefers-reduced-motion; exclude global 0.01ms !important overrides.
- [ ] Under forced-colors: active, replace meaningful backgrounds/shadows/border images with system colors.
