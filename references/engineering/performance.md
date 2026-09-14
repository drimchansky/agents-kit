# Performance

## Rendering

- [ ] Virtualize large lists; cache expensive derivations (`react.md` for memoization).

## Data Fetching

- [ ] Batch/join N+1 queries; parallelize independent fetches; paginate/limit datasets.
- [ ] Serve cache while revalidating; match keys to data identity.

## Bundle Size

- [ ] Replace heavy dependencies/use tree-shakeable subpaths; split routes with lazy/dynamic imports; optimize/size assets.

## Memory

- [ ] Clean listeners/subscriptions/timers; bound caches/collections; avoid stale/large callback captures; abort abandoned fetches.

## Algorithmic

- [ ] Avoid quadratic hot paths; index frequent lookups.
- [ ] Debounce/throttle scroll/resize/input/pointermove.

## Core Web Vitals

Measure with CrUX, Performance Insights, and Lighthouse/web-vitals.

### LCP — Largest Contentful Paint

- [ ] Initial HTML contains LCP; hero images use fetchpriority="high", dimensions, and eager loading. Never lazy-load LCP.
- [ ] Preload LCP backgrounds with as="image", href, high priority, and image type.

### INP — Interaction to Next Paint

- [ ] Target INP ≤200ms. Keep input tasks <50ms; acknowledge input before heavy work; follow Main Thread Discipline.

### CLS — Cumulative Layout Shift

- [ ] Reserve image/iframe/video dimensions or aspect ratio.
- [ ] Font-display optional/swap plus size-adjust fallbacks; scrollbar-gutter stable; no post-paint insertion above existing content.

## Main Thread Discipline

- [ ] Yield with scheduler.yield(); unsupported browsers use `await new Promise(r => setTimeout(r, 0))`, excluding continuous timer yielding.
- [ ] Batch DOM reads before writes; offload heavy synchronous work to workers.
- [ ] Measure with Long Animation Frames API/Performance panel before optimizing.

## Containment and Off-Screen

- [ ] Below-fold content-visibility: auto requires contain-intrinsic-size; prefer rem/lh/ch sizing. Exclude above-fold content.
- [ ] Isolate widgets with contain: layout style paint or inline-size.
- [ ] Offscreen content stays accessible unless intentionally ARIA-hidden.

## Resource Hints

- [ ] Preconnect imminent origins; DNS-prefetch noncritical ones; preload undiscovered same-page resources; prefetch next-navigation resources.
- [ ] Limit preconnects to 3–4 origins; match crossorigin to CORS mode, including anonymous same-origin fonts.
- [ ] Modules defer automatically; defer third-party scripts at body's end; self-host critical ones.

## Common Mistakes

- [ ] Filter/paginate server-side; measure before memoizing; prefer native capabilities over added polyfills/dependencies.
- [ ] Avoid competing high fetch priorities; expire opaque cross-origin service-worker caches.
