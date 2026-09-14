# React

Check installed-major docs (`./execution.md` § *Detect stack and sources*):

- Before 18: no concurrency/useId/automatic batching outside handlers.
- 18: standard hooks below.
- 19+: Compiler needs opt-in babel-plugin-react-compiler build wiring; otherwise memoize manually. Check use/useActionState/useOptimistic before older patterns.

## Components

- [ ] Compose instead of prop drilling; focus concerns; minimize state lifting; derive state without effect synchronization.
- [ ] Colocate styles/types/helpers; named exports and matching filenames.
- [ ] One public component/file; private components need state/hooks/lifecycle/concern boundaries. Inline one-off presentation without such boundaries.

## Render body

- [ ] Name handlers/boolean conditions in component bodies; JSX uses names/references, excluding inline handlers/tests.

## Hooks

- [ ] Extract reused/complex logic; accurate dependencies without exhaustive-deps suppression.
- [ ] Refs for non-rendering values; reducers for previous-state transitions; compute during render instead of effects where possible.

## Context and Providers

- [ ] Providers/router utilities own navigation; providers own defaults/implicit state; hooks/providers own app-context work.

## Performance

- [ ] Measure with DevTools Profiler; memo only expensive same-prop renders.
- [ ] useMemo/useCallback only for memoized children/expensive computation; static objects/arrays outside components.

## Patterns

- [ ] Error boundaries; controlled forms except ref-based non-React integration.
- [ ] Children before render props/compound components; prop spreads only in thin wrappers.
