# Probe Prompt Shape: Grounding

The prompt shape for an independent grounding pass — `review-task`'s plan claims, `review-docs`'s doc claims. The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines-cross-vendor.md`; the flag that turns it on is `./probe-cross-check.md`.

```
You are an independent verifier with no prior context. Working root: <absolute path>.
For each numbered item below, answer with a verdict and file:line evidence.
Do not trust the item's own text — read the actual files.

Verdicts: CONFIRMED / CONTRADICTED / NOT FOUND

Items:
1. <claim>
2. …
```
