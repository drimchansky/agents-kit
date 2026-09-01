# The `-x` Cross-Check

The opt-in cross-vendor second pass the review skills accept, and the mechanics every `-x` cross-check run shares. The probe contract and the merge contract that bind the cross-check are `./agent-fanout.md`; the engines and their launch recipes are `./probe-engines-cross-vendor.md`; the prompt is the citing skill's own shape — `./probe-shape-grounding.md` for a grounding pass, `./probe-shape-cold-review.md` for a cold review.

The review skills accept a `-x` flag: run one probe on the **cross-vendor engine** — the engine from the other vendor than the host harness (host Claude Code → `codex`; host Codex → `claude`) — as an independent second pass over the skill's own object. **Off by default**: without the flag, no probe runs and no cross-check line appears. The second pass is worth the cross-vendor hop because a different model family is maximally uncorrelated with the session's blind spots; every other probe fan-out stays `native`: exploration fan-out, multi-area searches, drift scans, and URL refresh need no flag at all, and `-p`'s lens fleet is opt-in for its cost, not for an engine.

What the probe checks, per skill:

- **`review-task`** — independent grounding: the plan's reality claims (integration points, "reuse X" assumptions, referenced files/symbols/APIs), verdict per claim.
- **`review-pr`** — a cold second review of the branch diff against its base, findings with severity.
- **`review-commit`** — a cold second review of the staged diff, findings with severity.
- **`review-docs`** — independent grounding of the doc's verifiable claims against the artifacts they describe, verdict per claim.

Shared mechanics, every `-x` cross-check run:

- **Launch early, merge late.** Start the probe in the background as soon as its input is ready (the claims list, the diff scope); run the skill's own primary pass while it runs — inline where the skill reviews in-session, or the delegated reviewer pass where it delegates (`./reviewer-contract.md` § *Posture*: the reviewer launches no probe of its own, so this one stays session-launched beside it and the session waits on both); collect and merge per `./agent-fanout.md` § *Merge contract* before verdicts or findings are finalized. The probe supplements that primary pass, never replaces it. No time cap bounds the wait: a probe still running when the primary pass finishes is waited on and reported per `./delegated-waiting.md` § *How to wait*, and calling a stalled one off stays the user's call per `./agent-fanout.md` § *Probe contract (every engine)* — a timeout never decides it for them.
- **Record the outcome.** The skill's output carries exactly one `Cross-check:` line — `clean` (nothing new, nothing contested) · `merged: <what the probe added or contested, and how it settled>` · `skipped (<reason>)`. With `-x` passed the line is mandatory, so a forgotten or failed probe is visible rather than ambiguous; without the flag the line doesn't appear. Each skill's output format says where the line lives.
