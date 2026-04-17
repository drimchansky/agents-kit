# Security

## Input & Injection

- [ ] User input validated and sanitized before use in queries, commands, or HTML
- [ ] No string concatenation for SQL, shell commands, or HTML — use parameterized queries, safe APIs, or templating
- [ ] `dangerouslySetInnerHTML` only with sanitized content (DOMPurify or equivalent)
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

## CSRF & Headers

- [ ] State-changing requests use CSRF tokens or `SameSite` cookie attribute
- [ ] `Content-Type` validated on API endpoints that parse request bodies
- [ ] CORS `Access-Control-Allow-Origin` not set to `*` for authenticated endpoints

## Dependencies

- [ ] No `npm install` of unmaintained or suspiciously low-download packages
- [ ] `package-lock.json` / `pnpm-lock.yaml` committed and reviewed for unexpected changes
- [ ] Dependency updates checked for known vulnerabilities (`npm audit`)

## Common Mistakes

- Trusting client-side validation as a security boundary — always validate server-side
- Storing JWTs in `localStorage` — vulnerable to XSS; prefer `httpOnly` cookies
- Checking permissions in the UI but not in the API — UI is not a security layer
- Logging request bodies that contain passwords or tokens
