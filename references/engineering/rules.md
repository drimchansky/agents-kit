# Engineering Rules

Apply with `../../CORE_RULES.md` for engineering tasks and engineering-only skills.

## Code & Git discipline

- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Mutate Git only on explicit request, including staging and commits. Task lifecycle and implementation-commit sanctions: `../workflow/task-delivery.md`; fix batch commits: `skills/fix-findings/SKILL.md` § *Batch commits*.

## Before presenting changes

- Prove current health for the final changed surface under `./verification.md` § *Two verification tiers*. Run at declared boundaries (`../workflow/execution-loop.md` § *Health boundaries*), or presentation when no consumer declares them. Never narrow that file's scope.
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

Load the phase recipe:

- `exploration.md`: codebase exploration before planning/review.
- `planning.md`: planning triggers, vertical slices, size caps, checkpoints.
- `execution.md`: stack/docs, bug reproduction, verification cadence.
- `verification.md`: outcome/health tiers; scope, acceptance, and batched fixes in `boundary-scope.md`, `acceptance-gate.md`, and `batched-fixes.md`.
- `review.md`: review lenses, complexity, severity; risk, evidence, and sign-off in `review-evidence.md`.

For signed commits/rebases, use `git-hardware-signing.md` for signer discovery, touch warnings, and device access.

Select checklists for the changed surface:

- `accessibility.md`: semantics, keyboard, targets, error announcement, native dialogs and overlays, live regions, motion
- `code-style.md`: functions, parameter limits, comments, scoped validation, public-API docs.
- `css.md`: native-first features, responsive floor, Tailwind, tokens, cascade layers, color
- `design-to-code.md`: UI from Figma nodes, mockups, or prototypes, with or without design tools.
- `forms.md`: control choice, hints, autocomplete, validation timing, tap sizing, submission
- `interactions.md`: motion, enter/exit, icon transitions, tactile feedback, surfaces, typography
- `performance.md`: measuring first, main-thread yielding, LCP, CLS
- `privacy.md`: data minimization, transparency, embeds, fingerprinting, user rights
- `react.md`: version-aware components, hooks, context, derived state
- `security.md`: injection, authn/authz, exposure, CSRF/cookies, postMessage/iframes, headers, audits, review validation.
- `tanstack-query.md`: version-aware hooks, `queryOptions`, query keys, mutation side effects
- `testing.md`: behavior over implementation, mocking discipline, Arrange-Act-Assert, error paths
- `typescript.md`: strict types, discriminated unions, narrowing, `satisfies`, `as const`, naming
