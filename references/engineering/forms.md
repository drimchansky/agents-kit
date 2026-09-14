# Forms

Keep server security validation and client UX validation (`security.md`, `accessibility.md`).

## Semantics

- [ ] Declare method/action/control names; primary buttons submit, others use type="button"; group with fieldset/legend.
- [ ] POST for sensitive/mutating actions; GET only for idempotent reads.

## Selection Controls

- [ ] Exclusive: radios for 1–5, select for 6+, input/datalist for 10+/dynamic suggestions. Multiple: checkboxes.

## Labels and Hints

- [ ] Visible labels connect through for/id; placeholders cannot replace them.
- [ ] Hints sit above inputs via aria-describedby; instructions/errors stay outside labels. Prefer aria-errormessage for errors, then aria-describedby.
- [ ] Preserve high-contrast focus indication.

## Autofill and Keyboards

- [ ] Set specific autocomplete tokens, distinguishing current-password/new-password; retain credential/address/payment/contact autofill.
- [ ] Match type/inputmode/autocomplete to validation/keyboard/autofill intent.
- [ ] Numeric inputmode for PIN/postal/OTP, excluding number type; enterkeyhint labels mobile Enter.

## Validation

- [ ] Prefer native required/length/pattern/type constraints; style :user-invalid/:user-valid, excluding immediate validity styling with :invalid/:valid.
- [ ] Validate on blur, clear on input, gate submit, focus first error; permit invalid-form submission to reveal errors.
- [ ] Disable after successful click against duplicate posts; reset setCustomValidity() to empty on input.
- [ ] Mirror aria-invalid to visual validity (`accessibility.md` Accessible Error Announcement).

## Sizing and Tap Targets

- [ ] Follow `accessibility.md` targets; inputs ≥16px font; coarse-pointer controls ≥48px minimum logical dimensions.
- [ ] Bound field-sizing: content with minimum/maximum inline sizes.

## Styling

- [ ] Accent-color brands native widgets; visually hide controls with `position: absolute; clip-path: inset(50%); width: 1px; height: 1px; overflow: hidden; white-space: nowrap;`, excluding display:none.
- [ ] Detect appearance: base-select before ::picker(select); preserve native fallback/keyboard/IME/mobile behavior.

## Auth-Specific

- [ ] Allow password paste; named show/hide toggle with aria-pressed; HTTPS for credentials/PII; CSRF protection (`security.md`).
- [ ] Single full-name field globally; allow non-Latin names/usernames.

## AJAX Submission

- [ ] Prevent default before fetching; retain server fallback; serialize FormData(form).
- [ ] Manage focus; announce success/status or failure/alert (`accessibility.md` Live Regions).

## Multi-Page Forms

- [ ] Show progress/aria-current="step"; backward navigation preserves data; previous/next enterkeyhint; navigation above keyboard fold.

## Common Mistakes

Check [Labels and Hints](#labels-and-hints), [Autofill and Keyboards](#autofill-and-keyboards), [Validation](#validation), and [Styling](#styling).
