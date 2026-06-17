# Performance

## Rendering

Consult `react.md` for React-specific memoization patterns.

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

## Core Web Vitals

Three metrics that compose the user-visible perf story. Measure with the Chrome UX Report (CrUX) for real-user data, the Performance Insights panel locally, and Lighthouse / `web-vitals` JS library for synthetic.

### LCP — Largest Contentful Paint

- [ ] LCP element (usually the hero image or hero heading) is in the initial HTML response — not mounted by client-side JS
- [ ] Hero `<img>`: `fetchpriority="high"`, explicit `width`/`height`, `loading="eager"` (default)
- [ ] LCP `background-image`: `<link rel="preload" as="image" fetchpriority="high" type="image/…">`
- [ ] Never `loading="lazy"` on the LCP image — it defers the fetch and ruins LCP

### INP — Interaction to Next Paint

INP measures the slowest user interaction across the page lifecycle. Anything > 200ms feels sluggish.

- [ ] No single task > 50ms on the main thread during input handling — split with `scheduler.yield()` (fallback: `await new Promise(r => setTimeout(r, 0))`)
- [ ] Update the UI synchronously to acknowledge the input, then defer heavy work — never make the user wait on background processing they can't see
- [ ] Offload genuine heavy work (parsing, crypto, image processing) to a Web Worker
- [ ] Debounce/throttle `scroll`, `resize`, `pointermove`, `input` handlers

### CLS — Cumulative Layout Shift

- [ ] Every `<img>`, `<iframe>`, `<video>` has explicit `width` and `height` (or `aspect-ratio` in CSS)
- [ ] Web fonts: `font-display: optional` or `swap` plus a `size-adjust` fallback to keep substituted text the same size
- [ ] Reserve scrollbar space with `scrollbar-gutter: stable` on scroll containers that toggle scrollability
- [ ] Don't insert content above existing content after first paint (banners, ads, late-arriving headers)

## Main Thread Discipline

- [ ] Yield with `scheduler.yield()` (front-of-queue) — falls back to `setTimeout(r, 0)` in older browsers. Don't rely on `setTimeout(..., 0)` for continuous yielding; it goes to the back of the queue
- [ ] Batch DOM reads, then DOM writes — don't interleave (`offsetHeight` then `style.height` then `offsetHeight` is layout thrashing)
- [ ] Heavy synchronous work (parse, crypto, image transform) → Web Worker
- [ ] Long Animation Frames API and the Performance panel are your diagnostic tools — measure before optimizing

## Containment and Off-Screen

- [ ] `content-visibility: auto` on long lists of below-the-fold sections skips their layout + paint until they near the viewport
- [ ] Always pair `content-visibility: auto` with `contain-intrinsic-size: <axis> <size>` — without it, the scrollbar jumps as content streams in. Prefer content-derived units (`rem`, `lh`, `ch`) over pixels
- [ ] `contain: layout style paint` (or `inline-size`) on isolated widgets so internal updates don't reflow the page
- [ ] Don't apply `content-visibility: auto` to above-the-fold content — the containment engine still walks it
- [ ] `content-visibility: auto` keeps elements in the accessibility tree — that's usually right; manage `aria-hidden` only if the off-screen content shouldn't be announced at all

## Resource Hints

Pick by what you're hinting at:

- `preconnect` — DNS + TLS for a domain you'll fetch from immediately (API origin, font foundry)
- `dns-prefetch` — cheaper fallback for non-critical domains (analytics, ad fallbacks)
- `preload` — same-page resource needed before the parser discovers it (LCP image, render-blocking font)
- `prefetch` — resource needed on the *next* navigation (next-page bundle, detail view)

- [ ] Don't preconnect everything — it's a zero-sum budget; 3–4 origins max per page
- [ ] `crossorigin` attribute matches the resource's CORS mode (`anonymous` for fonts, even same-origin)
- [ ] Module scripts (`type="module"`) are deferred by default — no need to add `defer`
- [ ] Third-party scripts: `defer` and place at the end of `<body>`. Self-host critical ones to drop a DNS lookup

## Common Mistakes

- Premature memoization everywhere — measure first, optimize second
- Fetching all records then filtering client-side — filter server-side, paginate
- Adding a polyfill or dependency for something the platform provides natively
- Synchronous heavy computation on the main thread blocking user interaction
- `loading="lazy"` on the LCP image — defers the fetch precisely when you don't want it deferred
- `fetchpriority="high"` on multiple elements — prioritization is zero-sum; over-elevation cancels itself out
- `setTimeout(fn, 0)` to "yield" — places the continuation at the back of the queue; pending tasks still block input. Use `scheduler.yield()`
- `content-visibility: auto` without `contain-intrinsic-size` — scrollbar jumps as content materializes
- Service Worker caching opaque cross-origin responses without expiry — silently exhausts storage quota
