# Engineering Execution: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contract — `./execution.md` — is the sole source of truth for behavior. Where behavior and these notes disagree, the contract wins. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why the stack gets detected before any code is written

`./execution.md` § *Detect stack and sources*, the opening line. Writing code is the one place hallucinated APIs do real damage.

## Why risk-first is one of the ways to split a step

`./execution.md` § *Splitting a step that's too big*, the risk-first option. If it fails, you discover it before investing in the rest.
