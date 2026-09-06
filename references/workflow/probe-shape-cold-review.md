# Probe Prompt Shape: Cold Review

The prompt shape for a cold second review of a change — `review-code`'s review object, whatever kind it resolved to. The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines-cross-vendor.md`; the flag that turns it on is `./probe-cross-check.md`.

Take the grounding shape's skeleton (`./probe-shape-grounding.md`) and replace the numbered items with the review object, named per kind, then demand findings, each with a severity, `file:line`, and the concrete failure it causes. The object phrase:

- **A branch** — "review the diff `<base>...HEAD`".
- **A range** — "review the diff `<merge-base>...<b>`".
- **A path set** — "review the files `<paths>` as commit `<head-sha>` has them". Naming the SHA is what holds the probe to the object reviewed rather than to whatever the working tree carries when it starts.
