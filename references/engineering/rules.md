# Engineering Rules

The **engineering domain pack's rules overlay** — loaded on top of the neutral `../../CORE_RULES.md` for any task with `**Domain:** engineering` (the default), and unconditionally by the engineering-only skills (`audit`, `review-commit`, `commit`, `review-pr`, `update-pr-description`, `publish-pr-review`, `review-docs`, `verify-issue`). See `../workflow/domain-packs.md` for how skills resolve and load a domain.

## Code & Git discipline

- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Don't commit, stage changes, or otherwise mutate Git state unless explicitly asked

## Before presenting changes

Before presenting results from any code change:

- Run typecheck and linter on changed files
- If tests exist for changed code, run them
- If changing exports or shared code, grep for all consumers and verify compatibility
- Remove debug artifacts (console.log, commented-out code, temporary variables)

## Dependencies

- Evaluate before adding: is it maintained? What's the bundle cost? Could you write it in <50 lines?
- Pin versions; use lockfiles
- One library per concern; don't install two solutions for the same thing

## Stack defaults (when no project convention exists)

- Package manager: pnpm
- Language: TypeScript (strict)
- Bundler: Vite
- Testing: Vitest
- Formatting: Prettier + ESLint

## Engineering pack contents

Beyond this rules overlay, the engineering pack provides the methodology bodies the neutral spine
loads by phase:

- `exploration.md` — how to explore a codebase before planning or reviewing (read code, trace callers/callees, map blast radius, check versions, ground in prior art)
- `planning.md` — engineering planning specifics: vertical slicing, step-size caps, checkpoint shape, when-to-plan heuristics
- `execution.md` — stack/version detection, authoritative doc-sourcing, the Prove-It bug pattern, health verification, `// UNVERIFIED:`, red flags
- `verification.md` — what "verify a step / criterion" means in code, and the engineering acceptance-gate recipe
- `review.md` — code-review lenses, complexity signals, severity calibration

Per-surface checklists — consult the ones a change touches:

- `accessibility.md` — Landmarks, ARIA, keyboard/focus, contrast, live regions, native dialogs, motion preferences, forms a11y
- `code-style.md` — Function shape, parameter limits, comment discipline (minimal, why-not-what, no duplication of code, comments self-sufficient — links only to official docs / long-lived public resources or in-repo pointers, never internal trackers/wikis/threads; behavioral narrative to tests, public-API JSDoc at the code)
- `css.md` — Layout, responsive, container queries, modern selectors (`:has()`, `@scope`), theming, modern color, cascade layers
- `forms.md` — Semantics, autocomplete tokens, validation timing (`:user-invalid`), tap sizing, AJAX, multi-page forms
- `html.md` — Document semantics, landmarks, native overlays (`<dialog>`, `[popover]`, `<details>`), resource prioritization, media
- `interactions.md` — Motion mechanics, enter/exit, icon transitions, tactile feedback, surfaces, typography polish
- `performance.md` — Core Web Vitals (LCP/INP/CLS), rendering, data fetching, containment, resource hints, bundle, memory
- `privacy.md` — Data minimization, transparency, storage choices (CHIPS), privacy headers, third-party embeds, fingerprinting
- `react.md` — Version-aware (<18 / 18 / 19+) components, hooks, context, effects, derived state
- `security.md` — Input/injection, authn/authz, data exposure, CSRF/cookies, browser security headers (CSP, Trusted Types, COOP/COEP), cross-origin comms
- `tanstack-query.md` — Version-aware (v4 / v5) custom hooks, `queryOptions`, query keys, mutation side effects
- `testing.md` — Behavior over implementation, mocking discipline, Arrange-Act-Assert, error-path coverage
- `typescript.md` — Strict types (no `any`), discriminated unions, narrowing, `satisfies`, `as const`, naming
