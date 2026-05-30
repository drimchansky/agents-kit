# Privacy

Privacy is an architectural decision, not a compliance checkbox. The cheapest data to protect is the data you never collected. See `security.md` for CSP, cookies, and headers and `forms.md` for credential handling.

## Data Minimization

- [ ] Collect the lowest granularity that satisfies the task — age bracket, not exact birth date; ZIP, not full address
- [ ] Offer guest checkout / unauthenticated reads when an account isn't required for the action
- [ ] Delete data when its original purpose is fulfilled; document retention windows per data class
- [ ] Don't reuse data collected for one purpose (security, support) for another (marketing, analytics) without fresh consent

## Transparency

- [ ] Inline "why we ask" explanations next to non-obvious fields; don't bury reasons in the privacy policy
- [ ] Explain *before* prompting for powerful permissions (camera, location, notifications) — never request on page load
- [ ] Account deletion as easy as account creation — same number of steps or fewer
- [ ] No dark patterns (pre-checked consent, asymmetric button styling on "Accept" vs "Reject", "Reject all" buried under "Manage preferences")

## Storage Choices

- [ ] Session tokens in cookies with `HttpOnly; Secure; SameSite=Lax` and a `__Host-` or `__Secure-` prefix. Never in `localStorage`
- [ ] Third-party iframe state: `SameSite=None; Secure; Partitioned` (CHIPS) — never unpartitioned `SameSite=None`
- [ ] On logout: `Clear-Site-Data: "cookies", "storage", "cache"` — avoid sending on a main navigation if `"cache"` would block render; trigger via a dedicated subresource
- [ ] Scrub PII from logs and analytics (emails, tokens, query strings containing secrets) at the edge, before they reach storage

## Headers

- [ ] `Permissions-Policy: camera=(), geolocation=(), microphone=(), accelerometer=()` — disable powerful features by default; re-enable per-iframe via the `allow` attribute when actually needed
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` (or stricter) — prevents leaking URL paths and query strings to third parties

## Third-Party Embeds

- [ ] Façade pattern for heavy embeds (YouTube, TikTok, maps): static thumbnail, lazy-load the real iframe on click
- [ ] Use privacy-preserving variants where available — `youtube-nocookie.com`, simple `https://x.com/intent/tweet?…` share links instead of share SDKs
- [ ] Don't load third-party scripts on pages handling sensitive data (checkout, health, account settings) unless strictly required
- [ ] Federated sign-in: FedCM (`navigator.credentials.get({ identity: … })`) — prevents the IdP from observing the relying party before user consent

## Fingerprinting

- [ ] Feature-detect APIs (`'IntersectionObserver' in window`) — never UA-string sniff
- [ ] If you truly need device hints, use UA Client Hints (`navigator.userAgentData.getHighEntropyValues(...)`), not the full `navigator.userAgent`
- [ ] Don't enumerate fonts, audio/video devices, or canvas-render fingerprints — these covertly identify users with no opt-out

## User Rights

- [ ] Path for users to export every piece of data tied to their account (machine-readable preferred)
- [ ] Self-serve deletion — don't gate it behind a support ticket if signup was automated
- [ ] Correction path for inaccurate identity data; no retaliation for opt-out (don't degrade unrelated service when a user exercises a privacy right)

## Common Mistakes

- JWTs in `localStorage` — readable by any XSS, no `HttpOnly` protection
- Loading Google Analytics / Segment / etc. on a checkout page without measuring whether the third-party origin actually needs that traffic
- "Reject all" buried two clicks deeper than "Accept all" — a dark pattern, and increasingly illegal under regional law
- Treating User-Agent sniffing as harmless when it covertly identifies clients — it's both unreliable AND a privacy harm
- Storing analytics events keyed by full query strings — they often contain tokens, search terms, or user identifiers
- `Clear-Site-Data` sent on the main document with `"cache"` — can block render on slow devices; send from a subresource instead
