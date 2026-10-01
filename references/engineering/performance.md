# Performance

- [ ] Measure before optimizing: CrUX, Lighthouse/web-vitals, the Performance panel, or the Long Animation Frames API. Memoization follows `react.md`.
- [ ] Prefer native capabilities over added polyfills or dependencies.
- [ ] Yield long tasks with scheduler.yield(); unsupported browsers use `await new Promise(r => setTimeout(r, 0))`.
- [ ] Below-fold content-visibility: auto requires contain-intrinsic-size; exclude above-fold content.

## LCP

- [ ] Initial HTML contains the LCP element; never lazy-load it.
- [ ] Hero images use fetchpriority="high"; avoid competing high priorities.

## CLS

- [ ] Reserve image/iframe/video dimensions or aspect ratio; no post-paint insertion above existing content.
