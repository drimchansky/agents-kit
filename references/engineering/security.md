# Security

## Input & Injection

- [ ] User input validated and sanitized before use in queries, commands, or HTML
- [ ] No string concatenation for SQL, shell commands, or HTML — use parameterized queries, safe APIs, or templating
- [ ] `dangerouslySetInnerHTML` only with sanitized content (DOMPurify or equivalent). Where Trusted Types is enforced (see Browser Security Headers below), route DOM-sink writes through a named policy
- [ ] Prefer `textContent`/`innerText` over `innerHTML`; use `setHTML` (Sanitizer API) where available
- [ ] Grep risky sinks: `innerHTML`, `outerHTML`, `document.write`, `eval`, `setTimeout(string, ...)`, `script.src` assigned from untrusted input
- [ ] URL parameters and path segments validated before use in routing, redirects, or fetches
- [ ] No `eval()`, `new Function()`, or dynamic `import()` with user-controlled strings
- [ ] Redirect targets validated against an allowlist — no open redirects

## Authentication & Authorization

- [ ] Auth checks on every protected route and API endpoint — not just UI hiding
- [ ] Token/session validation server-side; no client-only auth gates
- [ ] Role and permission checks at the resource level, not just the page level
- [ ] Auth tokens in `httpOnly` cookies or secure storage — not `localStorage`
- [ ] Logout invalidates session server-side, not just client state

## Data Exposure

- [ ] API responses contain only fields the client needs — no full database records
- [ ] Error messages and stack traces not exposed to end users in production
- [ ] Sensitive data (PII, tokens, passwords) not logged or included in analytics
- [ ] No secrets, API keys, or credentials in source code — use environment variables
- [ ] `.env` and credential files in `.gitignore`

## CSRF & Cookies

- [ ] State-changing requests use CSRF tokens or rely on `SameSite=Lax`/`Strict` cookies
- [ ] First-party session cookies named with the `__Host-` prefix (requires `Secure; Path=/`, no `Domain` attribute) — protects against same-site and network attackers
- [ ] When `__Host-` doesn't fit (subdomain sharing), use `__Secure-` prefix
- [ ] Third-party / embedded contexts: `SameSite=None; Secure; Partitioned` (CHIPS). Never unpartitioned `SameSite=None` — increasingly blocked for tracking
- [ ] `Content-Type` validated on API endpoints that parse request bodies
- [ ] CORS `Access-Control-Allow-Origin` not set to `*` for authenticated endpoints; never paired with `Access-Control-Allow-Credentials: true`

## Browser Security Headers

A layered baseline. Companion headers (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, SRI) are low-risk and can ship immediately; CSP, Trusted Types, and cross-origin isolation are the high-leverage, higher-effort rollouts.

### Companion headers (low risk, deploy first)

- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` — start with short `max-age` (e.g., 300s), ramp to 1 year. A long misconfigured HSTS can lock users out
- [ ] `X-Content-Type-Options: nosniff` paired with correct server `Content-Type` for every response
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` as a safe default (see `privacy.md`)
- [ ] `Permissions-Policy: camera=(), geolocation=(), microphone=()` — disable powerful features by default, delegate via iframe `allow=` only where needed (see `privacy.md`)
- [ ] `X-Frame-Options: SAMEORIGIN` (or CSP `frame-ancestors 'self'`) to block clickjacking
- [ ] Subresource Integrity on immutable, versioned third-party scripts: `<script src="…" integrity="sha384-…" crossorigin="anonymous">`. Never on dynamic/unversioned assets — silent updates break execution

### Content Security Policy

- [ ] Mainline directive: `script-src 'nonce-{RANDOM}' 'strict-dynamic' 'report-sample'; object-src 'none'; base-uri 'none';`
- [ ] Use nonces (server-rendered) or hashes (static SPA HTML) — not URL allowlists, which are bypassable via open redirects, JSONP, and dependency injection on the allowed origin
- [ ] Wire `Reporting-Endpoints` + `report-to` and watch for violations even after enforcing
- [ ] Optional but useful: `form-action 'self'`, `upgrade-insecure-requests`, `frame-ancestors 'self'`
- [ ] On retrofits, deploy `Content-Security-Policy-Report-Only` first and let it run for days/weeks across real traffic before enforcing

### Trusted Types

- [ ] `Content-Security-Policy: require-trusted-types-for 'script'` — blocks string assignment to dangerous DOM sinks at runtime
- [ ] Define one named policy per app that performs sanitization/escaping; route all sink writes through it
- [ ] Prerequisite: framework + third-party widgets emit `TrustedHTML`/`TrustedScript` values, or the policy will break them. Stage with report-only, refactor sinks, then enforce

### Cross-Origin Isolation

Set CORP on every response based on whether it should be embeddable.

- [ ] `Cross-Origin-Resource-Policy: same-origin` for authenticated data, session JSON, internal scripts
- [ ] `same-site` for shared assets across subdomains of one eTLD+1
- [ ] `cross-origin` only on resources intended for generic embedding (public CDN assets)
- [ ] `Cross-Origin-Opener-Policy: same-origin-allow-popups` for most apps — blocks XS-leaks attacks from openers while leaving OAuth/payment popups working. Move to `same-origin` only when no integrations rely on `window.opener` access
- [ ] Full COOP+COEP+CORP isolation (required for `SharedArrayBuffer`/WASM threads) is high-breakage — audit every embedded subresource for explicit CORP first. Chrome 142+: `Document-Isolation-Policy: isolate-and-credentialless` is a lighter alternative

## Cross-Origin Communication

- [ ] `window.postMessage` receivers: strict equality check on `event.origin` against an allowlist — never `*` and never substring/regex matching
- [ ] Senders: pass a specific `targetOrigin` (not `*`) when the payload is sensitive
- [ ] Validate the payload shape before using it; treat it as untrusted input even from "known" origins
- [ ] Iframes embedding untrusted content: start from an empty `<iframe sandbox>` (no flags = zero capabilities) and add only the tokens the embed actually needs. **Don't combine `allow-scripts` with `allow-same-origin`** on untrusted or same-origin embeds — together they let the frame script away its own sandbox. If the embed needs scripting and same-origin access, host it on a distinct origin so `allow-same-origin` doesn't apply to your own context
- [ ] Fetch Metadata (server-side): reject `Sec-Fetch-Site: cross-site` on non-navigational endpoints; `Vary: Sec-Fetch-Site` so CDN caches don't serve poisoned responses

## Rollout Discipline

- [ ] Use `*-Report-Only` headers first (CSP, COOP, COEP, Document-Policy); ship `Reporting-Endpoints` from day one even on enforced policies
- [ ] Include `'report-sample'` in `script-src` so violation reports carry the first 40 chars of the offending source — essential for debugging
- [ ] Filter report noise: ignore reports from obscure UAs, browser-extension-injected markup, and low-volume one-offs
- [ ] Never include PII, auth tokens, or query strings with secrets in reports — mask at the edge
- [ ] On logout: `Clear-Site-Data: "cookies", "storage", "cache"` (see `privacy.md`)

## Dependencies

- [ ] No `npm install` of unmaintained or suspiciously low-download packages
- [ ] `package-lock.json` / `pnpm-lock.yaml` committed and reviewed for unexpected changes
- [ ] Dependency updates checked for known vulnerabilities (`npm audit` / `pnpm audit`)

### Triaging audit findings

Severity alone is not the decision. Triage on **severity × reachability × runtime-vs-dev**:

- **Critical / High, reachable in production code path** — fix immediately (update, patch, or replace the dependency)
- **Critical / High, dev-only or unreachable code path** — fix soon, but not a release blocker
- **Critical / High, no patched version available** — evaluate workarounds, consider replacing the dependency, or allowlist with a documented review date
- **Moderate, reachable in production** — fix in the next release cycle
- **Moderate, dev-only** — track in backlog, fix when convenient
- **Low** — fold into routine dependency updates

Key questions: is the vulnerable function actually called in your code path? Is the dependency runtime or dev-only? Is the vulnerability exploitable in your deployment context (e.g., a server-side flaw in a client-only app)? When deferring, document the reason and a review date.

## Common Mistakes

- Trusting client-side validation as a security boundary — always validate server-side
- Storing JWTs in `localStorage` — vulnerable to XSS; prefer `httpOnly` cookies
- Checking permissions in the UI but not in the API — UI is not a security layer
- Logging request bodies that contain passwords or tokens
- URL allowlists in CSP `script-src` — bypassable via open redirects, JSONP, and dependency injection; use nonces + `'strict-dynamic'`
- `Access-Control-Allow-Origin: *` on authenticated endpoints — leaks data to any origin; reflect a validated `Origin` instead
- `postMessage` receivers without strict `event.origin` check — any opener/iframe can send a payload
- Long `Strict-Transport-Security` `max-age` shipped before HTTPS is fully working — locks every cached browser out for a year
- Iframe with `sandbox="allow-scripts allow-same-origin"` on untrusted content — that combo lets the frame remove its own sandbox
