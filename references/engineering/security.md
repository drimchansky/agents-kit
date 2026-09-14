# Security

## Input & Injection

- [ ] Validate/sanitize queries/commands/HTML/routes/redirects/fetch input.
- [ ] Parameterize queries; safe command APIs/templates; no input concatenation.
- [ ] Sanitize dangerouslySetInnerHTML; honor Trusted Types.
- [ ] Prefer textContent/innerText or supported Sanitizer API setHTML.
- [ ] Search innerHTML/outerHTML/document.write/eval/string timers/untrusted script.src.
- [ ] No user-controlled eval/new Function/dynamic import strings.
- [ ] Allowlist redirect targets.

## Authentication & Authorization

- [ ] Every protected route/API validates sessions/tokens/resource permissions server-side.
- [ ] Auth tokens: httpOnly cookies/secure storage; no localStorage.
- [ ] Invalidate sessions server-side on logout.

## Data Exposure

- [ ] Return needed fields only; hide production errors/stacks.
- [ ] Exclude PII, tokens, and passwords from logs/analytics.
- [ ] Credentials in environment variables; ignore .env/credential files.

## CSRF & Cookies

- [ ] Mutations require CSRF tokens or SameSite=Lax/Strict cookies.
- [ ] Sessions: __Host- cookies (Secure; Path=/; no Domain); subdomain sharing: __Secure-.
- [ ] Embedded cookies: SameSite=None; Secure; Partitioned (CHIPS); no unpartitioned SameSite=None.
- [ ] Validate request Content-Type before parsing.
- [ ] No Access-Control-Allow-Origin: * on authenticated endpoints or with Access-Control-Allow-Credentials: true.

## Browser Security Headers

Deploy companion headers first; stage other policies below.

### Companion headers (low risk, deploy first)

- [ ] Ramp verified HTTPS from HSTS max-age=300 to `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- [ ] X-Content-Type-Options: nosniff plus correct response Content-Type.
- [ ] Default Referrer-Policy: strict-origin-when-cross-origin (`privacy.md`).
- [ ] Default `Permissions-Policy: camera=(), geolocation=(), microphone=()`; iframe allow grants needed features (`privacy.md`).
- [ ] Block clickjacking: X-Frame-Options: SAMEORIGIN or CSP frame-ancestors 'self'.
- [ ] SRI only for immutable/versioned scripts: integrity="sha384-…" crossorigin="anonymous".

### Content Security Policy

- [ ] Baseline: `script-src 'nonce-{RANDOM}' 'strict-dynamic' 'report-sample'; object-src 'none'; base-uri 'none';`.
- [ ] Server nonces/static-HTML hashes; no URL allowlists.
- [ ] Monitor Reporting-Endpoints/report-to after enforcement too.
- [ ] Consider `form-action 'self'`, `upgrade-insecure-requests`, and `frame-ancestors 'self'`.
- [ ] Retrofits: Content-Security-Policy-Report-Only for days/weeks of traffic before enforcement.

### Trusted Types

- [ ] Content-Security-Policy: require-trusted-types-for 'script'.
- [ ] Route sinks through one named sanitizing/escaping policy.
- [ ] Check framework/widget TrustedHTML/TrustedScript compatibility; report-only, refactor sinks, enforce.

### Cross-Origin Isolation

- [ ] CORP: same-origin for authenticated/internal responses, same-site for subdomain assets, cross-origin for public embeds.
- [ ] COOP: same-origin-allow-popups for OAuth/payments; same-origin requires no window.opener dependencies.
- [ ] Before COOP+COEP+CORP for SharedArrayBuffer/WASM threads, audit every embed's CORP.
- [ ] Consider supported Document-Isolation-Policy: isolate-and-credentialless for lighter isolation.

## Cross-Origin Communication

- [ ] postMessage: exact allowlisted event.origin, no wildcard/substring/regex; validate payloads.
- [ ] Sensitive sends require non-wildcard targetOrigin.
- [ ] Untrusted iframes start empty-sandboxed; grant minimum capabilities.
- [ ] No combined allow-scripts/allow-same-origin on untrusted/same-origin embeds; isolate necessary combinations on distinct origins.
- [ ] Reject Sec-Fetch-Site: cross-site on non-navigational endpoints; emit Vary: Sec-Fetch-Site.

## Rollout Discipline

- [ ] Stage CSP/COOP/COEP/Document-Policy report-only; emit reporting endpoints immediately, including enforced policies.
- [ ] Include script `'report-sample'`; filter obscure-UA, extension, and low-volume report noise.
- [ ] Edge-mask PII/tokens/secret query strings before reporting.
- [ ] Logout: Clear-Site-Data: "cookies", "storage", "cache" (`privacy.md`).

## Dependencies

- [ ] Avoid unmaintained/suspiciously low-download packages.
- [ ] Commit/review lockfiles; npm audit/pnpm audit updates.

### Triaging audit findings

Assess severity/reachability/runtime placement/deployment exploitability:

- Critical/High, production-reachable: update, patch, or replace immediately.
- Critical/High, dev-only or unreachable: fix soon; not a release blocker.
- Critical/High, unpatched: workaround/replace or allowlist with review date.
- Moderate, production-reachable: next release; dev-only: backlog.
- Low: routine updates.

Record deferral reasons/review dates.

## Review Validation Boundaries

Continue other lenses. Permitted source/context reading is analysis; executing code/crafted inputs is active validation, including read-only invocations.

Validate only in authorized local environments and isolated scratch reproduction per `review.md` § *Verification Scripts*. Synthetic inputs, preset time/memory/input-size/count bounds; stop after capturing failure evidence. Never use real credentials/private data, destructive actions, production/external targets, persistence, broad discovery, or offensive tooling beyond reproducing the candidate.

Skip unsafe/unauthorized/policy-refused reproduction; no rerouting through executors, probes, tools, or targets. Static evidence alone proves neither reproduction nor practical exploitability. Report observations, skip reasons, uncertainty, and impact preconditions; distinguish inference from observed evidence.

Severity/file:line per `review.md` § *Findings output shape*. Include material class/preconditions/impact/fix/regression-test advice. Do not edit project code.

## Common Mistakes

- [ ] Server validation/authorization cannot depend on client checks.
