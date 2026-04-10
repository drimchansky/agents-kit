# TanStack Query

Check the project's installed `@tanstack/react-query` version — APIs change between major versions.

- **v4** — `useQuery({ queryKey, queryFn })` object syntax; `cacheTime` for GC; `onSuccess`/`onError`/`onSettled` callbacks on `useQuery` are supported
- **v5** — `cacheTime` renamed to `gcTime`; `useQuery` callbacks (`onSuccess`/`onError`/`onSettled`) removed — use `useEffect` or mutation callbacks instead; `queryOptions()` factory fully supported

When uncertain about version-specific API availability, verify against the official docs online.

## Custom Hooks

- [ ] Return raw `useQuery`/`useMutation` results — don't wrap in custom types that discard fields
- [ ] No wrapper types like `{ data: T; isLoading: boolean }` — consumers lose metadata
- [ ] Hook adds value beyond what `useQuery(options)` already provides

## Query Options

- [ ] `queryOptions()` factory for reusable configs
- [ ] `select` for different views of the same data
- [ ] Colocate `queryOptions` with data-fetching logic, not with consumers

## Query Keys

- [ ] `queryKeys` factory to centralize key construction
- [ ] Invalidation matches key structure exactly

## Side Effects

- [ ] Mutation callbacks (`onError`/`onSuccess`/`onSettled`) over `useEffect` on mutation state
- [ ] `throwOnError` for error boundary propagation

## Mutations

- [ ] `useMutation` for writes, not manual `useState` tracking
- [ ] `onSuccess` to invalidate related queries or update cache
- [ ] `mutateAsync` when awaiting; `mutate` with callbacks for fire-and-forget
- [ ] Separate hooks for read (polling) and write (mutation) concerns
- [ ] `mutation.variables` over mirrored `useState` for in-flight item

## Common Mistakes

- Wrapping/discarding query result fields
- Duplicate queries with different key strings for same endpoint
- Missing key parameters (e.g., `['user']` instead of `['user', userId]`)
- Invalidation key mismatches
- Mirrored mutating-item state via `useState`
