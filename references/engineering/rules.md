# Engineering Rules

The engineering domain pack's rules overlay, loaded on top of `../../CORE_RULES.md` for any task with `**Domain:** engineering` (the default), and unconditionally by the engineering-only skills, each of which cites it. `commit` is the one engineering-contributed skill that does not load this overlay: it writes no code, so the Git-discipline line below applies directly and its own SKILL.md carries the staged-change check gate instead of the changed-code health-boundary protocol.

## Code & Git discipline

- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Don't commit, stage changes, or otherwise mutate Git state unless explicitly asked; `../workflow/task-delivery.md` owns the task lifecycle sanction and the checkpoint-commit sanction an explicit engineering full-plan request grants; `skills/fix-findings/SKILL.md` § *Batch commits* owns the batch-commit sanction its typed invocation grants

## Before presenting changes

- Have current integrated health for the final changed surface: the recipe `./verification.md` § *Two verification tiers* names, at the scope it resolves, at the consumer's declared health boundary (`../workflow/execution-loop.md` § *Health boundaries*) or, under no such consumer, at presentation itself. That scope is the final delta's closure where the boundary's reference carries a verdict and the whole surface where it does not, except where `./boundary-scope.md` § *Infra-bound commands* scopes an infra-bound command; never narrower.
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

Per-surface checklists, consulted for what a change touches:

- `accessibility.md`: landmarks, ARIA, keyboard/focus, contrast, live regions, native dialogs, motion, forms a11y
- `code-style.md`: function shape, parameter limits, comment discipline (non-obvious current invariants only; no narration or duplication; scoped validation; public-API docs excepted)
- `css.md`: layout, responsive, container queries, `:has()`, `@scope`, theming, color, cascade layers
- `design-to-code.md`: building UI from a design source (Figma node, mockup, prototype), with or without a design-context tool
- `forms.md`: semantics, autocomplete, validation timing, tap sizing, AJAX, multi-page forms
- `html.md`: document semantics, landmarks, native overlays, resource prioritization, media
- `interactions.md`: motion, enter/exit, icon transitions, tactile feedback, surfaces, typography
- `performance.md`: Core Web Vitals, rendering, data fetching, containment, resource hints, bundle, memory
- `privacy.md`: data minimization, transparency, storage choices, privacy headers, embeds, fingerprinting
- `react.md`: version-aware components, hooks, context, effects, derived state
- `security.md`: injection, authn/authz, data exposure, CSRF/cookies, security headers, cross-origin comms
- `tanstack-query.md`: version-aware hooks, `queryOptions`, query keys, mutation side effects
- `testing.md`: behavior over implementation, mocking discipline, Arrange-Act-Assert, error paths
- `typescript.md`: strict types, discriminated unions, narrowing, `satisfies`, `as const`, naming
