# The Goals File: Durable IDs, Cited by Step

The contract for `goals.md`: the testable acceptance criteria for "done", which every other artifact cites by ID. Quality bar: `./acceptance-criteria.md`. Copy-ready shape: `../templates/goals.md`. Folder placement: `./task-layout.md`.

`goals.md` is a static input: no `**Status:**` field and no `## Description`.

- **Durable, never-renumbered IDs.** Each goal carries a `G<n>` assigned once. Removing a goal retires its number (`G1, G3` is fine); a new goal takes the next free number, never a retired one, so a step citing `G2` keeps pointing at the same goal across edits.
- **Optional `(external)` marker** right after the ID (`- G5 (external) — <outcome>`), per `./acceptance-criteria.md` § *Externally-verified goals — the `(external)` marker*; absent means agent-verifiable.
- **Steps cite the goals they deliver.** Every plan step carries `**Goal:** G1, G3`, or `**Goal:** none (infra/refactor)` for a step with no user-visible goal. Coverage is then mechanical: every goal ID maps to at least one step, and every non-escaped step to at least one goal.
- **Scope is a partition of goal IDs.** A plan's `## Scope` lists delivered and deferred goals by explicit ID (`delivered: G1, G3 · deferred: G4`). No ranges: retired IDs leave gaps, so `G1-G3` is ambiguous once `G2` is gone.
