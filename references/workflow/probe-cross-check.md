# The `-x` Cross-Check

The opt-in cross-vendor second pass the review skills accept. The probe contract and the merge contract are `./agent-fanout.md`; the engines and their launch recipes are `./probe-engines-cross-vendor.md`; the prompt is the citing skill's own shape (`./probe-shape-grounding.md` for a grounding pass, `./probe-shape-cold-review.md` for a cold review).

With `-x`, run probes on the **cross-vendor engine** (host Claude Code → `codex`; host Codex → `claude`), each an independent second pass over the skill's own object. `review-code` runs N probes for `-x N` and one for bare `-x`. `review-task` and `review-docs` take no count and always run exactly one. Off by default. Every other probe fan-out stays `native`.

What each probe checks, per skill:

- **`review-task`:** independent grounding of the plan's reality claims, verdict per claim.
- **`review-code`:** a cold second review of the resolved object, findings with severity.
- **`review-docs`:** independent grounding of the doc's verifiable claims, verdict per claim.

Shared mechanics:

- **Launch early, merge late.** Start each probe in the background as soon as its input is ready, and run the skill's primary pass while the probes run, inline or delegated (the reviewer launches no probe of its own, `./reviewer-contract.md` § *Posture*). Collect and merge per `./agent-fanout.md` § *Merge contract* before verdicts or findings are finalized; the probes supplement the primary pass, never replace it. No time cap bounds the wait (`./delegated-waiting.md` § *How to wait*); calling a stalled probe off is the user's call (`./agent-fanout.md` § *Probe contract (every engine)*).
- **Record the outcome.** The output carries exactly one `Cross-check:` line: `clean` (nothing new, nothing contested) · `merged: <what the probe added or contested, and how it settled>` · `merged: corroborated <file:line>` where the probe only re-found a finding the primary pass cites · `skipped (<reason>)` · `unattached (<n> findings; primary pass blocked)` where the probe completed but the primary pass ended blocked (`./reviewer-contract.md` § *Safety blocks*), its findings neither rendered nor adopted. With `-x` the line is mandatory; without the flag it does not appear. Bare `-x` and `-x 1` render these single-probe forms unchanged.
- **Report coverage above one probe.** With `-x N` above 1, the completed probes pool among themselves and merge as one answer (`./agent-fanout.md` § *Merge contract*). Read each form above with that pooled set as the probe. The line keeps its leading outcome word and ends with a coverage segment: `completed <c>/<N>`, then `probe <i> dropped (<reason>)` for each probe that did not complete, joined by `; `. In `skipped` and `unattached`, the segment follows their content inside their parentheses; `clean` and `merged:` gain a closing parenthetical that holds it. The line leads with `skipped` only when no probe completed. In `unattached`, `<n>` counts distinct claims after the probes pool:
  - `Cross-check: clean (completed 3/3)`
  - `Cross-check: merged: corroborated <file:line> (completed 2/3; probe 3 dropped (no return))`
  - `Cross-check: unattached (<n> findings; primary pass blocked; completed <c>/<N>; probe <i> dropped (<reason>); …)`
  - `Cross-check: skipped (completed 0/<N>; probe <i> dropped (<reason>); …)`
- **Name each drop's reason.** Give a probe that did not complete one reason. Use `no scratch directory: <reason>` when it never launched because its scratch directory is `none (<reason>)` (`./agent-scratch.md` § *Assignment*). Use `probe failed: <error>` when its command exited non-zero, keeping only the error code and message it reported. Use `no return` when it exited 0 and left its output file empty or missing. Use `stopped by user` when the user called it off. With one probe, that reason fills `skipped (<reason>)`.
- **A skip before launch keeps the single-probe form.** A skip decided for the whole cross-check before any probe launches, such as a fork PR or a missing engine, reads `skipped (<reason>)` at every N, as in `Cross-check: skipped (fork PR)`. Put no engine name and no `×<c>` count on the line; `/publish-pr-review` takes the engine from the host mapping above.
