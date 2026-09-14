# The `-x` Cross-Check

The opt-in cross-vendor second pass the review skills accept. The probe contract and the merge contract are `./agent-fanout.md`; the engines and their launch recipes are `./probe-engines-cross-vendor.md`; the prompt is the citing skill's own shape (`./probe-shape-grounding.md` for a grounding pass, `./probe-shape-cold-review.md` for a cold review).

With `-x`, run one probe on the **cross-vendor engine** (host Claude Code → `codex`; host Codex → `claude`) as an independent second pass over the skill's own object. Off by default. Every other probe fan-out stays `native`.

What the probe checks, per skill:

- **`review-task`:** independent grounding of the plan's reality claims, verdict per claim.
- **`review-code`:** a cold second review of the resolved object, findings with severity.
- **`review-docs`:** independent grounding of the doc's verifiable claims, verdict per claim.

Shared mechanics:

- **Launch early, merge late.** Start the probe in the background as soon as its input is ready and run the skill's primary pass while it runs, inline or delegated (the reviewer launches no probe of its own, `./reviewer-contract.md` § *Posture*). Collect and merge per `./agent-fanout.md` § *Merge contract* before verdicts or findings are finalized; the probe supplements the primary pass, never replaces it. No time cap bounds the wait (`./delegated-waiting.md` § *How to wait*); calling a stalled probe off is the user's call (`./agent-fanout.md` § *Probe contract (every engine)*).
- **Record the outcome.** The output carries exactly one `Cross-check:` line: `clean` (nothing new, nothing contested) · `merged: <what the probe added or contested, and how it settled>` · `merged: corroborated <file:line>` where the probe only re-found a finding the primary pass cites · `skipped (<reason>)` · `unattached (<n> findings; primary pass blocked)` where the probe completed but the primary pass ended blocked (`./reviewer-contract.md` § *Safety blocks*), its findings neither rendered nor adopted. With `-x` the line is mandatory; without the flag it does not appear.
