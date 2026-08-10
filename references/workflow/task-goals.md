# The Goals File: Durable IDs, Cited by Step

The contract for `goals.md`, one of the task folder's role files — where the folder sits and how it is discovered stay in the sibling `task-layout.md`. **This file is the single source of truth for the goals file's shape.**

`goals.md` is the single source of task intent — the testable acceptance criteria for what "done" means (the quality bar lives in the sibling `acceptance-criteria.md`). Every other artifact *references* it by ID rather than restating intent. Its shape:

```markdown
# Goals: <task title>
**Plan:** [./plan.md](./plan.md)

## Goals
- G1 — <testable, observable outcome>
- G2 — <testable, observable outcome>
```

Like the spec it replaces, `goals.md` is a static input — it carries no `**Status:**` field and no `## Description`; the title and the goals themselves carry the intent.

- **Durable, never-renumbered IDs.** Each goal carries a `G<n>` ID assigned once. Removing a goal **retires** its number (a gap is fine — deleting `G2` leaves `G1, G3`); a new goal takes the next free number, never a retired one. This is what lets a plan step cite `G2` and keep pointing at the same goal across user edits between sessions.
- **Optional `(external)` marker.** A goal verified *outside* the agent's session — a human/client sign-off, or a live/production state the agent can't drive in-session — carries an `(external)` token right after its ID: `- G5 (external) — <outcome>`. It is an optional annotation on the bullet (absent = agent-verifiable, the default); the acceptance gate tags such a goal `pending external` and parks the task at the `in-review` state until it's confirmed. Quality bar and rationale live in the sibling `acceptance-criteria.md`; the `in-review` state in `task-lifecycle.md`.
- **Steps cite the goals they deliver.** Every plan step carries a `**Goal:**` line naming the goal ID(s) it delivers (`**Goal:** G1, G3`) — or the explicit escape `**Goal:** none (infra/refactor)` for a step that delivers no user-visible goal. Coverage is then mechanical: every goal ID maps to at least one delivering step, and every non-escaped step to at least one goal.
- **Scope is a partition of goal IDs.** A plan's `## Scope` says which goals it delivers and which it defers, by explicit ID list (e.g. `delivered: G1, G3 · deferred: G4`), instead of re-prosing intent. Do not use ranges: retired goal IDs can leave gaps, so `G1-G3` is ambiguous once `G2` has been removed. Each goal is either in this plan or deferred to another — the partition is what makes goals↔scope drift unwritable.
