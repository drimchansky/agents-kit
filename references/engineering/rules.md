# Engineering Rules

Rules layered over `../../CORE_RULES.md` for engineering tasks and the engineering-only skills.

## Code & Git discipline

- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Don't commit, stage changes, or otherwise mutate Git state unless explicitly asked; `../workflow/task-delivery.md` owns the task lifecycle sanction and the checkpoint-commit sanction an explicit engineering implementation request grants; `skills/fix-findings/SKILL.md` § *Batch commits* owns the batch-commit sanction its invocation grants

## Before presenting changes

- Have current integrated health for the final changed surface: run `./verification.md` § *Two verification tiers* at the consumer's declared health boundary (`../workflow/execution-loop.md` § *Health boundaries*), or at presentation itself under no such consumer. That file sets the scope; never run narrower.
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

Methodology bodies the neutral spine loads by phase:

- `exploration.md`: exploring a codebase before planning or reviewing
- `planning.md`: vertical slicing, step-size caps, checkpoint shape, when to plan
- `execution.md`: stack detection, doc sourcing, the Prove-It bug pattern, the verification cadence
- `verification.md`: the unit-outcome and integrated-health tiers, with the satellites `boundary-scope.md`, `acceptance-gate.md`, and `batched-fixes.md`
- `review.md`: code-review lenses, complexity signals, severity calibration

Git-operation reference:

- `git-hardware-signing.md`: signer discovery, touch warnings, and device access for signed commits and rebases

Per-surface checklists, consulted for what a change touches:

- `accessibility.md`: semantics, keyboard, targets, error announcement, native dialogs and overlays, live regions, motion
- `code-style.md`: function shape, parameter limits, comment discipline (non-obvious current invariants only; no narration or duplication; scoped validation; public-API docs excepted)
- `css.md`: native-first features, responsive floor, Tailwind, tokens, cascade layers, color
- `design-to-code.md`: building UI from a design source (Figma node, mockup, prototype), with or without a design-context tool
- `forms.md`: control choice, hints, autocomplete, validation timing, tap sizing, submission
- `interactions.md`: motion, enter/exit, icon transitions, tactile feedback, surfaces, typography
- `performance.md`: measuring first, main-thread yielding, LCP, CLS
- `privacy.md`: data minimization, transparency, embeds, fingerprinting, user rights
- `react.md`: version-aware components, hooks, context, derived state
- `security.md`: injection, authn/authz, data exposure, CSRF/cookies, postMessage/iframes, security headers, audit triage, review validation boundaries
- `tanstack-query.md`: version-aware hooks, `queryOptions`, query keys, mutation side effects
- `testing.md`: behavior over implementation, mocking discipline, Arrange-Act-Assert, error paths
- `typescript.md`: strict types, discriminated unions, narrowing, `satisfies`, `as const`, naming
