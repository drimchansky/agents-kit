# React

Check the project's installed React version — APIs change between major versions.

- **React <18** — No concurrent features, no `useId`, no automatic batching outside event handlers
- **React 18** — Standard hooks patterns apply as written below
- **React 19+** — The React Compiler (auto-memoization) is a separate opt-in build plugin (`babel-plugin-react-compiler`), not enabled by installing React 19; unless the project wires it into the build, hand-write `memo`/`useMemo`/`useCallback` as usual (see Performance), and only skip them when the compiler is enabled. Check for new APIs (`use`, `useActionState`, `useOptimistic`) before reaching for older patterns

Which of the three the project is on decides every pattern below, so settle a React API's availability against that major's official docs before writing it — the sourcing rule is `./execution.md` § *Detect stack and sources*.

## Components

- [ ] Composition over prop drilling — use children, render props, or context
- [ ] Focused components — split if handling multiple concerns
- [ ] Colocate related code (styles, types, helpers) with the component
- [ ] Named exports; filename matches component name
- [ ] One public component per file — a small single-use sub-component may be defined privately in the same file when it owns a meaningful boundary (its own state, hooks, lifecycle, or a distinct concern); helpers, types, and styles colocate too
- [ ] Derive state from props/other state instead of syncing with effects
- [ ] Lift state only as high as needed
- [ ] Don't extract a component just to name a one-off chunk of presentational markup — inline that as JSX; extract only when the unit owns a meaningful boundary (its own state, hooks, lifecycle, or a distinct concern)

## Render body

- [ ] No inline event handlers in JSX — define each handler in the component body with a descriptive name (e.g. `handleSubmit`) and pass it by reference (`onClick={handleSubmit}`)
- [ ] No inline conditions in JSX — hoist the test into a named boolean in the component body (e.g. `const canSubmit = …`) and render against the name; returned markup should read as structure, not logic

## Hooks

- [ ] Extract custom hooks when logic is reused or complex
- [ ] Accurate dependency arrays — never suppress exhaustive-deps lint
- [ ] `useRef` for values that shouldn't trigger re-renders
- [ ] `useReducer` over `useState` when transitions depend on previous state
- [ ] No `useEffect` for things computable during render

## Context and Providers

- [ ] Navigation/redirect logic in providers or router utilities, not leaf components
- [ ] Compute defaults and infer implicit state inside the owning provider
- [ ] Work requiring app context belongs in hooks/providers, not inline in components

## Performance

- [ ] Measure before optimizing (React DevTools Profiler)
- [ ] `memo` only for expensive re-renders with same props
- [ ] `useMemo`/`useCallback` only for memoized children or expensive computation
- [ ] Static objects/arrays outside the component

## Patterns

- [ ] Error boundaries for render errors
- [ ] Controlled components for forms; uncontrolled with `useRef` only for non-React integration
- [ ] `children` as default composition before render props or compound components
- [ ] No prop spreading except on thin wrappers
