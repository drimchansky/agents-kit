# Security

## Triggers

Check each one the change touches:

- [ ] Injection: parameterize queries; safe command APIs; no input concatenation, eval, new Function, or user-controlled dynamic imports.
- [ ] HTML sinks: prefer textContent; sanitize dangerouslySetInnerHTML/innerHTML; honor Trusted Types.
- [ ] Redirects: allowlist targets.
- [ ] Authorization: every protected route/API validates sessions and resource permissions server-side, never through client checks.
- [ ] Tokens: httpOnly cookies or secure storage, no localStorage; invalidate sessions server-side on logout.
- [ ] Exposure: return needed fields only; hide production errors/stacks; exclude PII, tokens, and passwords from logs/analytics; scrub PII, tokens, and secret query strings at the edge before logs, analytics, or reports.
- [ ] Secrets: environment variables; ignore .env/credential files.
- [ ] CSRF: mutations require CSRF tokens or SameSite=Lax/Strict cookies.
- [ ] CORS: no Access-Control-Allow-Origin: * on authenticated endpoints or with credentials.
- [ ] postMessage: exact allowlisted event.origin and non-wildcard targetOrigin; validate payloads.
- [ ] Untrusted iframes: sandboxed with minimum capabilities; no combined allow-scripts/allow-same-origin.

## Cookies and Headers

- [ ] Sessions: __Host- cookies (Secure; Path=/; no Domain) with SameSite=Lax. Embedded cookies: SameSite=None; Secure; Partitioned.
- [ ] CSP: nonces or hashes with 'strict-dynamic'; object-src 'none'; base-uri 'none'; no URL allowlists.
- [ ] Stage CSP/COOP/COEP report-only with reporting endpoints before enforcement; ramp HSTS from a short max-age.
- [ ] Defaults: nosniff, Referrer-Policy: strict-origin-when-cross-origin, a restrictive Permissions-Policy, and frame-ancestors 'self'.
- [ ] Logout: Clear-Site-Data: "cookies", "storage", "cache"; send it from a subresource when cache clearing would block navigation rendering.

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
