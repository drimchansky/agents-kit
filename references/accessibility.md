# Accessibility

## Markup

- [ ] Heading levels (`h1`–`h6`) in logical order
- [ ] Native HTML elements over ARIA — custom widgets need role, accessible name, keyboard support
- [ ] `aria-label` or `aria-labelledby` for elements without visible text
- [ ] `aria-live` regions for dynamic content (toasts, status messages)
- [ ] No `aria-hidden="true"` on focusable elements

## Keyboard

- [ ] Custom widgets handle `Enter`, `Space`, `Escape`, arrow keys per role
- [ ] Tab order follows visual reading order — no positive `tabindex`
- [ ] Focus trapped inside modals; restored to trigger on close

## Visual

- [ ] 4.5:1 contrast ratio for text (3:1 for large text)
- [ ] Color never sole information carrier — add icons, text, or patterns
- [ ] `prefers-reduced-motion` respected
- [ ] Touch targets at least 44x44px
- [ ] Usable at 200% browser zoom

## Forms

- [ ] Every input has a visible, associated `<label>`
- [ ] Related inputs grouped with `<fieldset>` and `<legend>`
- [ ] Error messages connected via `aria-describedby`
- [ ] `aria-invalid` on fields with validation errors
- [ ] Form submission results announced to screen readers
