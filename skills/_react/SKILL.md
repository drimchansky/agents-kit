---
name: _react
description: React component patterns, hooks rules, performance, and state management. Apply when writing or reviewing React code.
---

# React

Before applying these patterns, read the project's `package.json` for the installed React version.

- **React <18** — No concurrent features, no `useId`, no automatic batching outside event handlers
- **React 18** — Standard hooks patterns apply as written below
- **React 19+** — Compiler handles memoization automatically; avoid manual `memo`/`useMemo`/`useCallback` unless the compiler is explicitly disabled. Check for new APIs (`use`, `useActionState`, `useOptimistic`) before reaching for older patterns.

When uncertain about version-specific API availability, verify against the official docs online.

## Components

- Prefer composition over prop drilling — use children, render props, or context to pass behavior
- Keep components focused — if a component handles multiple concerns, split it
- Colocate related code (styles, types, helpers) with the component that uses them
- Use named exports for components; match filename to component name
- Derive state from props/other state instead of syncing with effects
- Lift state only as high as needed — not higher
- Don't extract components or helper abstractions for a single use site — inline until a second or third consumer proves the abstraction

## Hooks

- Extract custom hooks when logic is reused or when a component's hook logic gets complex
- Keep dependency arrays accurate — never suppress the exhaustive-deps lint
- Use `useRef` for values that shouldn't trigger re-renders (timers, DOM refs, previous values)
- Prefer `useReducer` over `useState` when state transitions depend on previous state or involve multiple related values
- Avoid `useEffect` for things that can be computed during render — effects are for synchronization with external systems

## Context and Providers

- Keep navigation/redirect logic inside context providers or router utilities, not inside components or leaf components that happen to trigger it
- Compute default values and infer implicit state (e.g., the initial form value from URL params) inside the provider that owns that state — components should receive ready-to-use values, not compute them
- If a component is doing work that requires knowing about broader application context (routing, active chain, current user), that work belongs in a hook or provider, not inline in the component

## Performance

- Don't optimize prematurely — measure first with React DevTools Profiler
- Use `memo` only when a component re-renders often with the same props and rendering is expensive
- Use `useMemo`/`useCallback` only when passing values to memoized children or when computation is genuinely expensive
- Move static objects and arrays outside the component to avoid re-creating them on every render

## Patterns

- Use error boundaries to catch and handle render errors gracefully
- Prefer controlled components for forms; use uncontrolled with `useRef` only when integrating with non-React code
- Use `children` as the default composition mechanism before reaching for render props or compound components
- Avoid prop spreading (`{...props}`) except on thin wrapper components where it's intentional
