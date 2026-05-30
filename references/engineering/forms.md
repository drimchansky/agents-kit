# Forms

Server-side validation is for security; client-side validation is for UX. Never substitute one for the other. See `accessibility.md` for form a11y / error announcement and `security.md` for CSRF and credential handling.

## Semantics

- [ ] `<form>` with explicit `method` and `action`; `name` on every control
- [ ] `<button type="submit">` for primary submission; `type="button"` for non-submitters inside a form
- [ ] `<fieldset>` + `<legend>` to group related controls (radio groups, address blocks)
- [ ] `POST` for sensitive or mutating actions; `GET` only for idempotent reads (search) — never for state changes

## Selection Controls

Pick by option count and exclusivity:

- 1–5 exclusive options: `<input type="radio">` — zero-click scan
- 6+ exclusive: `<select>` — saves vertical space
- 10+ / dynamic: `<input list="id">` + `<datalist>` — fuzzy match
- Multi-select: `<input type="checkbox">`

## Labels and Hints

- [ ] Every input has `<label for="id">` linked to `<input id="id">` — placeholder is not a label
- [ ] Hint text linked via `aria-describedby` and placed **above** the input so autofill popovers don't cover it during editing
- [ ] Don't pack instructions or error text into the label — those belong in `aria-describedby`/`aria-errormessage`
- [ ] Don't disable focus outlines without a high-contrast replacement

## Autofill and Keyboards

- [ ] Specific `autocomplete` tokens — `email`, `tel`, `street-address`, `cc-number`, `current-password`, `new-password`. Browsers ignore `autocomplete="off"` on credentials/address/payment/contact fields anyway
- [ ] Distinguish `autocomplete="current-password"` (sign-in) from `"new-password"` (sign-up, password change) so password managers offer the right action
- [ ] Reinforce intent across attributes: `type="email"` + `inputmode="email"` + `autocomplete="email"` — they control validation, keyboard, and autofill respectively
- [ ] `inputmode="numeric"` for PINs, postal codes, OTPs — not `type="number"` (drops leading zeros, shows spinners, scroll-changes value)
- [ ] `enterkeyhint` to label the Enter key on mobile: `next`, `done`, `previous`, `send`

## Validation

- [ ] Native constraints first: `required`, `minlength`, `maxlength`, `pattern`, `type="email"`/`"url"`/`"tel"`
- [ ] Style with `:user-invalid` / `:user-valid` — NOT `:invalid` / `:valid` (those flag required-empty fields on page load before the user has touched anything)
- [ ] Validate on `blur`; clear errors on `input`; final gate on `submit` and route focus to the first error
- [ ] Don't disable the submit button to "block" invalid forms — let users submit and surface errors. DO disable after a successful click to prevent double-post
- [ ] Custom messages via `setCustomValidity()`; reset to `""` on `input` so the field can validate again
- [ ] Mirror `aria-invalid` to `:user-invalid` so screen-reader state matches visual state — see the accessible-error-announcement pattern in `accessibility.md`

## Sizing and Tap Targets

See `accessibility.md` for the canonical touch-target baseline (44×44px default; 24×24 WCAG floor).

- [ ] Input `font-size` ≥ 16px (`1rem`) — iOS zooms in on focus below that
- [ ] On coarse pointers, bump form controls to ≥ 48px — typing pressure and rapid sequential taps on form fields are more error-prone than ordinary buttons, so the baseline gets a form-specific raise. Enforce with `min-block-size`/`min-inline-size`, not `height`/`width`
- [ ] `field-sizing: content` for inputs that should hug their content, bounded by `min-`/`max-inline-size`

## Styling

- [ ] `accent-color` for native checkboxes, radios, range sliders, progress — cheap brand alignment without losing semantics
- [ ] Visually hide controls with the canonical recipe (`position: absolute; clip-path: inset(50%); width: 1px; height: 1px; …`) — never `display: none`, which removes them from the accessibility tree
- [ ] Where supported (Chrome 135+; not yet in Firefox/Safari at writing), style `<select>` with `appearance: base-select` + `::picker(select)` rather than rebuilding a custom dropdown that loses keyboard, IME, and mobile native picker. Feature-detect via `@supports (appearance: base-select)` and keep the native `<select>` as the fallback

## Auth-Specific

- [ ] Allow paste into password fields; provide a show/hide toggle with an accessible name and `aria-pressed`
- [ ] HTTPS-only on any page that submits credentials or PII
- [ ] CSRF token (or `SameSite` cookie) on every state-changing request — see `security.md`
- [ ] Single full-name field; don't split into "First"/"Last" for a global audience. Don't enforce Latin-only characters on names or usernames

## AJAX Submission

- [ ] `e.preventDefault()` on the submit event before fetching; keep a server-side fallback for when JS fails
- [ ] Serialize with `FormData(form)` — preserves file inputs and matches multipart semantics
- [ ] Manage focus and announce status (`role="status"` for success, `role="alert"` for failure) — see `accessibility.md` live regions

## Multi-Page Forms

- [ ] Visible progress indicator with `aria-current="step"` on the active step
- [ ] Backward navigation never discards entered data
- [ ] `enterkeyhint="previous"`/`"next"` on nav buttons; keep them above the on-screen keyboard fold

## Common Mistakes

- `autocomplete="off"` on a password field — browsers and managers ignore it; you just lose autofill help
- `type="number"` for credit cards, ZIPs, OTPs — drops leading zeros, exposes spinners, and changes value on scroll
- Disabling the submit button as the validation gate — keyboard users can't tell why; route focus to the error instead
- Placeholder as the only label — disappears when the field has content, and several screen readers don't announce it
- Custom selects that abandon `<select>` semantics — keyboard, IME, screen reader, and the mobile native picker all lose
- Trusting client-side `required`/`pattern` as security — they're UX, not authorization
