---
name: _react
description: React component patterns, hooks rules, performance, and state management. Apply when writing or reviewing React code.
---

# React

## Components

- Prefer composition over prop drilling — use children, render props, or context to pass behavior
- Keep components focused — if a component handles multiple concerns, split it
- Colocate related code (styles, types, helpers) with the component that uses them
- Use named exports for components; match filename to component name
- Derive state from props/other state instead of syncing with effects
- Lift state only as high as needed — not higher

## Hooks

- Follow the Rules of Hooks: only call at the top level, only call from React functions
- Extract custom hooks when logic is reused or when a component's hook logic gets complex
- Keep dependency arrays accurate — never suppress the exhaustive-deps lint
- Use `useRef` for values that shouldn't trigger re-renders (timers, DOM refs, previous values)
- Prefer `useReducer` over `useState` when state transitions depend on previous state or involve multiple related values
- Avoid `useEffect` for things that can be computed during render — effects are for synchronization with external systems

## Performance

- Don't optimize prematurely — measure first with React DevTools Profiler
- Use `memo` only when a component re-renders often with the same props and rendering is expensive
- Use `useMemo`/`useCallback` only when passing values to memoized children or when computation is genuinely expensive
- Move static objects and arrays outside the component to avoid re-creating them on every render
- Use `key` to reset component state intentionally; use stable, unique keys for lists (not array index)

## Patterns

- Handle loading, error, and empty states explicitly — don't assume the happy path
- Use error boundaries to catch and handle render errors gracefully
- Prefer controlled components for forms; use uncontrolled with `useRef` only when integrating with non-React code
- Use `children` as the default composition mechanism before reaching for render props or compound components
- Avoid prop spreading (`{...props}`) except on thin wrapper components where it's intentional
