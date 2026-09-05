# Probe Prompt Shape: Cold Review

The prompt shape for a cold second review of a change — `review-pr`'s branch diff — and the base the lens-review shape builds each of its fleet's prompts on (`./probe-shape-lens-review.md`). The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines-cross-vendor.md`; the flag that turns it on is `./probe-cross-check.md`.

Take the grounding shape's skeleton (`./probe-shape-grounding.md`) and replace the numbered items with the review object — "review the diff `<base>...HEAD`" — and demand findings, each with a severity, `file:line`, and the concrete failure it causes.
