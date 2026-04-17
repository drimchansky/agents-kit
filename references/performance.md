# Performance

## Rendering

Consult `references/react.md` for React-specific memoization patterns.

- [ ] Large lists use virtualization (`react-window`, `@tanstack/virtual`) — not raw `.map()` over hundreds of items
- [ ] Expensive derivations computed once and cached, not recomputed every render cycle

## Data Fetching

- [ ] No N+1 queries — batch or join related data server-side
- [ ] No request waterfalls — parallelize independent fetches (`Promise.all`, loader patterns)
- [ ] Paginate or limit large data sets — no unbounded fetches
- [ ] Stale data served from cache while revalidating, not blocked on fresh fetch
- [ ] No redundant re-fetches — cache keys match data identity

## Bundle Size

- [ ] Heavy dependencies (`moment`, `lodash`) replaced with lighter alternatives or tree-shakeable imports
- [ ] Route-level code splitting with `lazy()` / dynamic `import()`
- [ ] No full library imports when only a few functions are used — use subpath imports
- [ ] Images and static assets optimized and appropriately sized

## Memory

- [ ] Event listeners, subscriptions, and timers cleaned up on unmount
- [ ] No unbounded caches, arrays, or maps that grow without eviction
- [ ] Closures in long-lived callbacks don't capture stale or large scopes
- [ ] `AbortController` used to cancel abandoned fetches

## Algorithmic

- [ ] No O(n²) or worse in hot paths — nested loops, repeated `find`/`filter` on same array
- [ ] Frequent lookups use `Map`/`Set`/object index, not linear array search
- [ ] Debounce or throttle high-frequency event handlers (scroll, resize, input)

## Common Mistakes

- Premature memoization everywhere — measure first, optimize second
- Fetching all records then filtering client-side — filter server-side, paginate
- Adding a polyfill or dependency for something the platform provides natively
- Synchronous heavy computation on the main thread blocking user interaction
