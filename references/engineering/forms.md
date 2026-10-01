# Forms

Keep server security validation and client UX validation (`security.md`, `accessibility.md`).

## Controls

- [ ] Exclusive: radios for 1–5, select for 6+, input/datalist for 10+/dynamic suggestions. Multiple: checkboxes.
- [ ] Primary buttons submit; others use type="button".
- [ ] Single full-name field; allow non-Latin names/usernames and password paste.

## Labels and Hints

- [ ] Hints sit above inputs via aria-describedby; instructions/errors stay outside labels.
- [ ] Prefer aria-errormessage for errors, then aria-describedby.

## Autofill and Keyboards

- [ ] Set specific autocomplete tokens, distinguishing current-password/new-password.
- [ ] Numeric inputmode for PIN/postal/OTP, excluding number type; enterkeyhint labels mobile Enter.

## Validation

- [ ] Prefer native constraints; style :user-invalid/:user-valid, excluding immediate validity styling with :invalid/:valid.
- [ ] Validate on blur, clear on input, focus first error; permit invalid-form submission to reveal errors.
- [ ] Disable submit after a successful click against duplicate posts.
- [ ] Mirror aria-invalid to visual validity (`accessibility.md` § *Accessible Error Announcement*).

## Sizing

- [ ] Follow `accessibility.md` § *Targets*; inputs ≥16px font; coarse-pointer controls ≥48px minimum logical dimensions.

## Submission

- [ ] AJAX forms retain a server fallback and serialize FormData(form).
- [ ] Manage focus; announce success or failure (`accessibility.md` § *Live Regions*).
- [ ] Multi-page forms preserve data on backward navigation and show progress with aria-current="step".
