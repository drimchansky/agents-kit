# CONTEXT.md Schema

The section layout of a task's `CONTEXT.md`, the static grounding beside `goals.md`, `plan.md`, `result.md`, and the optional `ticket.md` and `observations.md`. When a section name changes, update it here first and propagate to the consumers that read or write these sections without citing this file: `review-task`, `implement-task`, `resume-task`, `reconcile-task`, `./reconciliation.md` (its annotation rows name `## References` and `## Open Questions`; its grounding-evidence rule names `Recommended Direction`, `MVP Scope`, `Not Doing`, and `Key Assumptions`), `scripts/sweep-scope.ts` (it matches the same two headings to bound the sweep), and through those two the reconcile composites. Grep cannot reconstruct this registry, so it is maintained here.

## The schema

Copy `../templates/CONTEXT.md`, keep every heading, fill the placeholders.

## Field notes

- **No `**Status:**` field.** The plan owns the task's lifecycle; a legacy line here reads as none (`./task-lifecycle.md`).
- **`**Domain:**`** names the domain pack every skill in the task loads (default `engineering`). Default to `engineering` for code or ambiguity within a coding context. When the task is clearly non-code and the domain is unclear, ask rather than stamp a wrong label.
- **Placeholder sections are intentional.** Keep every heading even when empty. `refine-idea` fills them from its ideation pass; `plan-task` scaffolding without a prior idea step fills `Problem Statement` and `Key Assumptions to Validate`; `decompose-task`'s seed fills `Problem Statement` (citing `./ticket.md`), `References`, `Open Questions`, and only what the source decides in `Recommended Direction`.
- **Static grounding, not a scratchpad.** The user enriches it over time. The three reconcilers may append annotations inside `## References` and `## Open Questions` and rewrite a prose section as a judged edit (`./reconciliation.md` § *Grounding docs change on evidence, never silently*); `implement-task` corrects a section its own execution disproved (its § *Correcting Grounding Where It's Wrong*). No other skill writes here. Per-step notes, approach rationale, and verify criteria belong in the plan or its result; goals belong in `goals.md`. Downstream artifacts cite these sections rather than restating them (`./one-home.md` § *One home per fact*). A fact a sibling task needs is duplicated here, unless a `GROUP_CONTEXT.md` above both tasks holds it; then `## References` cites that file (`./task-store.md` § *Shared group context*).
- **Project-level decisions** live in the store's `DECISIONS.md` when one exists (`./task-store.md` § *Store-level artifacts*). Cite them as `Decision #N — <root-relative path>` in `## References`; an inlined copy names `DECISIONS.md` as its source.
- **With a `ticket.md` present, `## Problem Statement` cites `./ticket.md`** rather than restating it (`./ticket-format.md`). `## References` carries links surfaced during refinement or planning; the requester's own links stay in the ticket. Without a ticket, `## Problem Statement` holds the one-sentence framing.
