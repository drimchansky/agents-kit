---
name: _tanstack-query
description: TanStack Query (React Query) patterns for data fetching, caching, mutations, and async state. Apply when writing or reviewing code that uses @tanstack/react-query.
---

# TanStack Query

Before applying these patterns, check the project's installed TanStack Query version and verify API availability against the official docs online — APIs change between major versions.

## Custom Hooks

- Return raw `useQuery` / `useMutation` results — don't wrap them in custom types that discard fields. Consumers benefit from the full async state (`isLoading`, `error`, `data`, `isFetching`, `status`, etc.)
- Don't create wrapper types like `{ data: T; isLoading: boolean }` that shadow the query result — they lose metadata (`isFetching`, `isStale`, `errorUpdateCount`) that consumers may need
- A custom hook should add value beyond what `useQuery(options)` already provides — if it's just forwarding options, inline the query instead

## Query Options

- Use `queryOptions()` factory to define reusable query configurations — this is the primary composition primitive
- Share the same `queryOptions` across hooks that need different views of the same data, using `select` to derive each view
- Prefer `select` over creating a separate hook that fetches the same data with a different return shape
- Colocate `queryOptions` with the data-fetching logic, not with the component that consumes it

## Query Keys

- Keys must include all parameters that affect the query result — missing a parameter causes stale data across different inputs
- Use a `queryKeys` factory or helper to centralize key construction and avoid typos or drift between query and invalidation sites
- When invalidating, match the key structure exactly — partial key matches with `queryClient.invalidateQueries` affect all queries that start with that prefix

## Side Effects

- Use mutation callbacks (`onError` / `onSuccess` / `onSettled`) for side effects (toasts, redirects, analytics) instead of `useEffect` watching mutation state
- Use `throwOnError` when the error should propagate to an error boundary instead of being handled inline

## Mutations

- Use `useMutation` for form submissions and other async write operations instead of manual `useState` for status/error/loading tracking
- Use `onSuccess` to invalidate related queries, update the cache optimistically, or trigger navigation
- Prefer `mutateAsync` when you need to await the result in a handler; use `mutate` with callbacks for fire-and-forget patterns
- Don't mix read (polling) and write (mutation) concerns in the same hook — if a mutation needs to track an async process after it completes, use a separate `useQuery` with `refetchInterval` to observe that state
- Access the currently-mutating item via `mutation.variables` instead of mirroring it with a separate `useState` — `variables` is always in sync with the in-flight mutation and clears automatically when the mutation settles

## Common Mistakes

- **Wrapping and discarding** — Creating `useUserData()` that returns `{ user, loading }` instead of the full query result. When a consumer later needs `isFetching` or `refetch`, the hook must be modified.
- **Duplicate queries** — Two hooks that call the same endpoint with different `queryKey` strings. Use `queryOptions` to share the config and `select` to differentiate.
- **Missing key parameters** — `queryKey: ['user']` when the query fetches by ID. Should be `queryKey: ['user', userId]`.
- **Invalidation mismatches** — Invalidating `['users']` but the query key is `['user', 'list']`. Centralize keys to prevent this.
- **Mirrored mutating-item state** — `const [pendingId, setPendingId] = useState()` set in `onMutate` and cleared in `onSettled`. Read `mutation.variables` directly; it holds the in-flight call arguments with no manual sync required.
