# Task Lifecycle and Authorship: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contracts — `./task-lifecycle.md` and its write-surface sibling `./task-authorship.md` — are the sole source of truth for behavior. Where behavior and these notes disagree, the contracts win. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why `in-review` is not a kind of `blocked`

`./task-lifecycle.md` § *Status values*, the `plan.md` `in-review` bullet. A **voluntary hand-off**, not a failure: distinct from `blocked`, which is an *involuntary pause* on a prerequisite or failure.

## Why the goals file sits outside the `Status:` scheme

`./task-authorship.md` § *Files*, the closing paragraph on the shared `Status:` field name; the goals bullet it points back to is in that same section. The goals file sits outside this scheme entirely; it is a static input that evolves through user edits (and, only by a confirmed judgment item, `reconcile-task` — see the goals bullet above).
