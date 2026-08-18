# Agent Fan-Out: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contract — `./agent-fanout.md` — is the sole source of truth for behavior. Where behavior and these notes disagree, the contract wins. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why a probe's isolation is the point

`./agent-fanout.md` § *What a probe is*. That isolation is a feature, not a limitation; it's what makes a probe worth consulting where the session's own read might be biased (grounding a plan it helped write, reviewing a diff whose intent it has already internalized).

## Why `implement-task` is the delegate-by-default posture

`./agent-fanout.md` § *Write-mode routing*, the registry's `implement-task` bullet. This is the proven posture the other two are calibrated against.
