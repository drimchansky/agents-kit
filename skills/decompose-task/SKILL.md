---
name: decompose-task
description: Use when an approved design doc (ADR, accepted RFC, epic-scale ask) should become several tickets and task folders — proposes the decomposition into ordered sibling parts (cut-line alternatives, Jira mapping), and on the user's confirmation materializes each part's ticket.md plus a seeded CONTEXT.md via prepare-ticket. Proposes first; writes nothing before confirmation.
argument-hint: '[source: task-folder doc path, file path, URL, or pasted text] [optional: parent dir, existing Jira keys]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: infer the effort's domain from the source (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core; each materialized part records its own `**Domain:**` in its seeded `CONTEXT.md`. If the domain has no pack, run the neutral methodology and say so.

Turn one **approved** source (an ADR, an accepted RFC, an epic-scale ask) into an ordered set of sibling task folders, each entering the workflow as its own ticket-first task. Two phases: **propose** the cut in chat, then, only after the user confirms, **materialize** each part by running `../prepare-ticket/SKILL.md` plus a `CONTEXT.md` seed. The method is `./references/workflow/decomposition.md`; read it before Phase 1.

Phase 1 writes nothing. Phase 2's write surface is exactly the confirmed part folders, each new `<parent>/<NN->slug/` with its `ticket.md` and seeded `CONTEXT.md`. No source-doc edits, no writes into existing task folders, no Jira writes (every mapped ticket body is paste-ready for the user), no git mutation.

Phase 2 runs `../prepare-ticket/SKILL.md`'s full protocol per part with four overrides:

- **Core Rules blocks**: this skill's block covers the pipeline; the inner AGENTS.md read does not repeat.
- **Clarifying questions**: `prepare-ticket`'s per-ticket round folds into Phase 1's single batched confirmation. A gap discovered only at drafting time is asked then, not guessed.
- **Next pointers**: the inner skill's handoff suggestions are dropped; this skill's Output owns **Next**.
- **Destination resolution**: the part folder Phase 2 step 1 just created *is* the task folder. Write `ticket.md` into it directly, bypassing `task-destinations.md`'s *Destination paths* inference, which would nest a new slug inside the empty directory.

## When to Use

**Use when** an approved design doc needs to become several tickets and task folders, or a large effort should enter the workflow as ordered siblings and the cut deserves a proposal.

**Skip when** the work fits one ticket → `prepare-ticket`, then `plan-task`; the source is undecided → `refine-idea`, since decomposing it hardens open questions into tickets; the sibling folders already exist → `plan-task` / `implement-task`.

## Process

### Phase 1 — Propose (chat-only)

1. **Resolve the source** per `decomposition.md` § *Source intake*. Confirm it is decided material; otherwise stop and name `refine-idea`.
2. **Resolve the parent directory** once for the whole set: the destination the user named, else the source task folder's own parent when the source lives in a task store (continuing its `NN-` sequence), else the container `./references/workflow/task-destinations.md` § *Destination paths* selects (the matched project area or the canonical root, never a `<slug>` folder), its destination notice printed once here. Then read what a part landing there inherits: every applicable `GROUP_CONTEXT.md` from the selected root down, root to task, per `./references/workflow/task-store.md` § *Shared group context*. An inherited constraint may move a cut line or sharpen an acceptance sketch; no part gains a requirement the source does not decide.
3. **Ground the cut**: read the source in full. For code, check its as-built pointers against current main (`decomposition.md` § *Engineering heuristics*) so staleness lands in the affected parts' seeds.
4. **Propose** per `decomposition.md` § *The proposal*: the recommended cut with numbering, per-part acceptance sketches, and dependency notes; real alternatives; the Jira mapping when keys were passed; open items that gate nothing.
5. **Confirm in one batched round** (the host's structured question tool when available): the cut, the numbering, the parent directory, missing Jira keys, and any per-part gap that would stall drafting. Apply exactly what the user answers; a dropped part leaves the others unrenumbered.

### Phase 2 — Materialize (per confirmed part, in plan order)

Run `decomposition.md` § *Materialization contract* per part:

1. Create `<parent>/<NN->slug/`.
2. Draft `ticket.md` by running `../prepare-ticket/SKILL.md` against the part's confirmed acceptance sketch, to the bar in `./references/workflow/ticket-format.md`.
3. Seed `CONTEXT.md` from `./references/templates/CONTEXT.md` per `./references/workflow/context-schema.md`, its sections filled as the contract's step 3 says: `## Problem Statement` citing `./ticket.md`, `## References` carrying the source pointer, the Jira key, and the shared facts cited to the group file that holds them, `## Recommended Direction` holding only what the source decides, `## Open Questions` carrying the proposal's gate-nothing items that touch this part, every other heading a placeholder.

## Output

Lists, never tables. Report; do not paste the tickets.

- **Materialized parts**: per part, folder path, ticket title, and, when a Jira mapping exists, the disposition (*absorb into `<KEY>`*, the ticket body doubling as that key's paste-ready description, or *needs-new* with the parent named).
- **Assumptions and open items**: anything inferred while drafting, plus the gate-nothing items carried from the proposal.
- **Next:** `/plan-task <first-part>`, the token `./references/workflow/task-layout.md` § *One task, one flat folder* fixes (bare slug where one resolves, folder path otherwise), then one line per remaining part in order.
