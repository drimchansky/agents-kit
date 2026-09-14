# Agent Fan-Out: Probes

How a skill delegates read-only work to other agents as **probes**. The probe contract and the merge contract below govern every engine and every prompt shape. Engines: `./probe-engines.md` and `./probe-engines-cross-vendor.md`; the `-x` cross-check: `./probe-cross-check.md`; prompt shapes: `./probe-shape-*.md`. A delegated reviewer's returns (`./reviewer-contract.md`) pool under the merge contract here.

## What a probe is

A **probe** is one self-contained, read-only question posed to a separate agent, whose answer comes back as text evidence. It sees only what its prompt carries: no session context, no accumulated assumptions, no stake in the answer.

## Probe contract (every engine)

- **Self-contained prompt.** Paste in everything the probe must judge: the claims under check, the diff scope or doc paths, absolute paths to the artifacts. The probe cannot see the session.
- **One concern per probe.** A claim list for one check is one probe with one merged answer, not a per-claim swarm.
- **Read-only, promised always, enforced where the engine can.** Probes verify by reading, never by mutating and never by running the project's build or suite. Never pass an engine's sandbox-bypass flags.
- **Demand cited verdicts.** Require a locator with each verdict: `file:line` for file-backed claims, a stable source or record locator for external facts. A verdict that no evidence bears lists the sources and locations searched instead. An uncited answer is an opinion, not evidence.
- **Evidence, not authority.** Weigh the answer and spot-check it where surprising. It assigns no verdict and overrides no session pass; the invoking skill owns its verdicts.
- **Degrade gracefully.** Report a missing engine, failed login, or dead probe as `Cross-check: skipped (<reason>)` and proceed on the session's own pass. A probe never blocks a skill, but slowness alone is not failure: wait on a probe still making progress per `./delegated-waiting.md` § *How to wait*. Skipping it is the user's call.
- **Content leaves the machine.** A probe ships its prompt to the engine's vendor. Run a cross-vendor probe only on work the user already uses that vendor's CLI on; when in doubt, ask first.
- **Scratch, not record.** Probe output lands in the host's scratch area, never in the task folder. Result files record the merged outcome, not probe transcripts.

## Merge contract

Compare the probe's answer against the session's own pass:

- **Agreement** strengthens the evidence: cite it and move on.
- **Contradiction is never silently dropped.** Re-check the spot before assigning the verdict; a confirmed contradiction becomes a finding. In `review-task`, a `CONTRADICTED` claim is evidence toward `conflicts with what exists` / `infeasible as stated`, and a `NOT FOUND` on a load-bearing reference is a gap.
- **Novel probe findings are candidates, not findings.** Verify each against the artifact under the session's own severity calibration before adopting it. A reproducible failure mode is settled by its reproduction; for code, the bar is `../engineering/review.md` § *Verification Scripts*.
- **Pool candidates by location before adopting any.** With more than one reviewer or probe (`review-code`'s `-n N` above 1), group candidates by `file:line` or enclosing block so corroboration and contradiction surface together. A location group holds as many candidates as it has distinct claims: dedupe by semantic equivalence, not by location. Then walk the other branches of each function a pooled candidate lands in, in the session's own read.
- **The outcome line closes the loop.** For the `-x` shapes, the `Cross-check:` line states `clean`, `merged: …`, `skipped (<reason>)`, or `unattached (…)` per `./probe-cross-check.md`. The verify shape closes on its consuming skill's mandatory **Verified** line; the options-research shape on its consumer's `Question research:` line, rendered only when the review surfaced candidate questions (`./probe-shape-options-research.md`).
