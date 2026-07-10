# CONTEXT.md Schema

The canonical structure of a task's `CONTEXT.md` — the static grounding context that sits beside `goals.md`, `plan.md`, and `result.md` in a task folder. **This file is the single source of truth for the CONTEXT.md section layout.** Cited by `refine-idea` (which produces it via its three-phase pass) and `plan-task` (which scaffolds a skeleton when none exists), so downstream consumers (`review-task`, `implement-task`, `resume-task`, `reconcile-task`) read the same section names regardless of how the task started.

## The schema

```markdown
# <task name>

**Status:** <origin marker>
**Domain:** <domain>

## Problem Statement

<one-sentence framing of what this task is solving>

## Goals

_(Goals live in `goals.md`. `plan-task` drafts that file before the plan and asks for clarification when requirements are unclear.)_

## Recommended Direction

<the chosen direction and why>

## Key Assumptions to Validate

- [ ] <assumption that, if wrong, would invalidate the plan> — <how to test it>

## MVP Scope

- **In:** <minimum to test the core assumption>
- **Out:** <what's deferred>

## Not Doing (and Why)

- <intentional exclusion> — <reason>

## Open Questions

- <question the plan can't yet answer>

## References

_(External links, pasted specs, ticket numbers, screenshots, cross-cutting notes. Read by the plan and its result in this task folder.)_
```

## Field notes

- **`**Status:**` is a one-shot origin marker**, not a lifecycle state — `refined` when `refine-idea` wrote the file, `drafted-by-plan-task` when `plan-task` scaffolded it. Never mutated after creation; the plan file owns the working lifecycle. Full vocabulary across all task files lives in `./task-lifecycle.md`.
- **`**Domain:**`** names which domain pack every skill in the task loads (default `engineering`). Infer it from the task; default to `engineering` when the work is code or genuinely ambiguous within a coding context, but when the task is clearly non-code and the right domain is unclear, **ask** rather than stamping a wrong label — a wrong `**Domain:**` silently loads the wrong rules. See `./domain-packs.md`.
- **Placeholder sections are intentional.** Leave every section heading in place even when empty, so downstream skills find the same section names. `refine-idea` fills them from its three-phase pass; `plan-task`, when it scaffolds without a prior idea step, populates `Problem Statement` and `Key Assumptions to Validate` and leaves the rest as placeholders for the user.
- **Keep it static grounding, not a scratchpad.** The user enriches `CONTEXT.md` over time (links, specs, standing decisions). The scripted writers are the `-r` reconcile mode of `resume-task` / `review-task`, which may append minimal reconciliation annotations inside `## References` and `## Open Questions` (per the carve-out in `./task-lifecycle.md` and the contract in `./reconciliation.md`), and `reconcile-task`, which — reconciling the session → docs — may additionally rewrite prose sections, but only through a confirmed judgment item and never the `**Status:**` marker (same contract); no other skill writes to this file. Don't dump per-step implementation notes, approach rationale, or verify criteria into it — those belong in the plan or its result file. Goals and acceptance criteria belong in the sibling `goals.md`, not here. The split cuts both ways: these sections are the **home** for the task's grounding, and downstream artifacts — the plan above all — cite them rather than restating them (see `./task-layout.md` § *One home per fact*). Tasks are independent folders with no shared layer above them, so anything a sibling task needs is duplicated into its own `CONTEXT.md`.
