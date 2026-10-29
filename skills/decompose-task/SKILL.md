---
name: decompose-task
description: Use when an approved design doc (ADR, accepted RFC, epic-scale ask) should become several tickets and task folders — proposes the decomposition into ordered sibling parts (cut-line alternatives, Jira mapping), and on the user's confirmation materializes each part's ticket.md plus a seeded CONTEXT.md via prepare-ticket. Proposes first; writes nothing before confirmation.
argument-hint: '[source: task-folder doc path, file path, URL, or pasted text] [optional: parent dir, existing Jira keys]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: infer the effort's domain from the source (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core; each materialized part records its own `**Domain:**` in its seeded `CONTEXT.md`. If the domain has no pack, run the neutral methodology and say so.

Decompose an **approved** ADR, accepted RFC, or epic-scale ask into sibling task folders under `./references/workflow/decomposition.md`. Propose in chat first; materialize only the confirmed cut through `../prepare-ticket/SKILL.md` and a context seed.

Phase 1 writes nothing. Phase 2's write surface is exactly the confirmed part folders, each new `<parent>/<NN->slug/` with its `ticket.md` and seeded `CONTEXT.md`. No source-doc edits, no writes into existing task folders, no Jira writes (every mapped ticket body is paste-ready for the user), no git mutation.

Phase 2 runs `../prepare-ticket/SKILL.md`'s full protocol per part with five overrides:

- **Core Rules blocks**: this skill's block covers the pipeline; the inner AGENTS.md read does not repeat.
- **Clarifying questions**: `prepare-ticket`'s per-ticket round folds into Phase 1's single batched confirmation. A gap discovered only at drafting time is asked then, not guessed.
- **Decomposition assessment**: skip `prepare-ticket`'s § *3. Assess decomposition*; draft only the part Phase 1 already confirmed.
- **Handoff**: `prepare-ticket`'s Handoff blocks are dropped; this skill's Output composes one block for the whole run.
- **Destination resolution**: write `ticket.md` directly into the part folder Phase 2 just created; bypass `./references/workflow/task-destinations.md`'s *Destination paths* inference.

## When to Use

**Use when** an approved design doc has independently useful, verifiable delivery seams that may deserve several tickets and task folders, or a large effort's cut deserves a proposal.

**Skip when** the work is tightly coupled or the user explicitly requests one task → `prepare-ticket`, then `plan-task` with bounded steps and checkpoints; the source is undecided → `refine-idea`, since decomposing it hardens open questions into tickets; the sibling folders already exist → `plan-task` / `implement-task`.

## Process

### Phase 1 — Propose (chat-only)

1. **Resolve the source** per `./references/workflow/decomposition.md` § *Source intake*. Confirm it is decided material; otherwise stop and name `refine-idea`.
2. **Resolve the parent directory** once for the whole set: the destination the user named, else the source task folder's own parent when the source lives in a task store (continuing its `NN-` sequence), else the container `./references/workflow/task-destinations.md` § *Destination paths* selects (the matched project area or the canonical root, never a `<slug>` folder), its destination notice printed once here. Then read what a part landing there inherits: every applicable `GROUP_CONTEXT.md` from the selected root down, root to task, per `./references/workflow/task-store.md` § *Shared group context*. An inherited constraint may move a cut line or sharpen an acceptance sketch; no part gains a requirement the source does not decide.
3. **Ground the cut**: read the source in full. For code, check its as-built pointers against current main (`./references/workflow/decomposition.md` § *Engineering heuristics*) so staleness lands in the affected parts' seeds.
4. **Propose** per `./references/workflow/decomposition.md` § *The proposal*: the recommended cut with numbering, per-part acceptance sketches, and dependency notes; real alternatives; the Jira mapping when keys were passed; open items that gate nothing.
5. **Confirm in one batched round** (the host's structured question tool when available): the cut, the numbering, the parent directory, missing Jira keys, and any per-part gap that would stall drafting. Apply exactly what the user answers; a dropped part leaves the others unrenumbered.

### Phase 2 — Materialize (per confirmed part, in plan order)

Run `./references/workflow/decomposition.md` § *Materialization contract* per part:

1. Create `<parent>/<NN->slug/`.
2. Draft `ticket.md` by running `../prepare-ticket/SKILL.md` against the part's confirmed acceptance sketch, to the bar in `./references/workflow/ticket-format.md`.
3. Seed `CONTEXT.md` from `./references/templates/CONTEXT.md` per `./references/workflow/context-schema.md`: `## Problem Statement` cites `./ticket.md`; `## References` carries the source pointer, mapped Jira key, and applicable inherited facts by group-file citation. Add `## Recommended Direction` only for a settled part direction and `## Open Questions` only for items that touch this part. Omit every empty section and template prompt.

## Output

Lists, never tables. Report; do not paste the tickets.

- **Materialized parts**: per part, folder path, ticket title, and, when a Jira mapping exists, the disposition (*absorb into `<KEY>`*, the ticket body doubling as that key's paste-ready description, or *needs-new* with the parent named).
- **Assumptions and open items**: anything inferred while drafting, plus the gate-nothing items carried from the proposal.

Close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the parts materialized, pointing at **Materialized parts**.
- **Know:** Jira dispositions the user applies by hand, since this skill writes no Jira, and inferred details a part's criteria rest on, pointing at **Assumptions and open items**.
- **Next:** the parts in order, ending with `/plan-task <first-part>`. Its token follows `./references/workflow/task-layout.md` § *One task, one flat folder*: the bare slug where one resolves, the folder path otherwise.
