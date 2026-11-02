---
description: Propose the whole fix run, with concrete diffs for the ask-routed finding, before editing anything.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Please work through these verified review findings and fix them in this repository.

- 🟡 Major `src/cart.js:6`: `applyDiscount` multiplies by the whole-number percent, so `applyDiscount(200, 10)` returns `-1800` instead of `180`. Confirmed: callers pass whole percentages from 0 to 100, but the function computes `amount * percent`. Fix: return `amount - (amount * percent) / 100`.
- 🟡 Major `src/cart.js:10`: `parseQuantity` returns `NaN` for input such as `"abc"`, and `subtotal` then returns `NaN` for the whole cart. Confirmed: `Number.parseInt` yields `NaN` and nothing checks it. Fix options: (a) throw a `RangeError` for input that is not a non-negative integer, so every caller must handle bad input; (b) return `0` for such input, so the line silently drops out of the subtotal.
- 🟢 Minor `src/format.js:2`: `formatPrice` drops the cents for whole amounts. Withdrawn: `formatPrice(5)` returns `$5.00`, because `toFixed(2)` always keeps two decimals.

Before your final response, run `node tools/state-report.mjs` from the repository root to record the repository state.
