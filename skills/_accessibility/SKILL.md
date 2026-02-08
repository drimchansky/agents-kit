---
name: _accessibility
description: Accessible markup, ARIA patterns, keyboard navigation, and inclusive design. Apply when writing or reviewing UI code.
---

# Accessibility

## Semantic HTML

- Use the correct HTML element before reaching for ARIA — `<button>`, `<a>`, `<nav>`, `<main>`, `<dialog>`, `<form>`
- Use heading levels (`h1`–`h6`) in logical order to create a navigable document outline
- Use `<ul>`/`<ol>` for lists, `<table>` for tabular data — screen readers convey structure automatically
- Don't use `<div>` or `<span>` with click handlers when a `<button>` or `<a>` is appropriate

## ARIA

- First rule of ARIA: don't use ARIA if a native HTML element provides the semantics
- Every interactive custom widget needs a role, accessible name, and keyboard support
- Use `aria-label` or `aria-labelledby` to name elements that lack visible text
- Use `aria-live` regions for dynamic content updates that should be announced (toast notifications, status messages)
- Never use `aria-hidden="true"` on focusable elements

## Keyboard

- All interactive elements must be reachable and operable via keyboard
- Use native interactive elements (`<button>`, `<a>`, `<input>`) to get keyboard support for free
- Custom widgets must handle `Enter`, `Space`, `Escape`, and arrow keys as appropriate for their role
- Tab order should follow the visual reading order — avoid positive `tabindex` values
- Trap focus inside modal dialogs; restore focus to the trigger on close

## Visual

- Text must have at least 4.5:1 contrast ratio against its background (3:1 for large text)
- Don't rely on color alone to convey information — use icons, text, or patterns as well
- Respect `prefers-reduced-motion` — disable or reduce animations for users who request it
- Ensure touch targets are at least 44x44px
- UI must be usable at 200% browser zoom

## Forms

- Every input needs a visible, associated `<label>` — placeholder text is not a label
- Group related inputs with `<fieldset>` and `<legend>`
- Connect error messages to inputs with `aria-describedby`
- Use `aria-invalid` to indicate fields with validation errors
- Announce form submission results to screen readers
