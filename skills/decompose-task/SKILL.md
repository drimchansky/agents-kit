---
name: decompose-task
description: Use when an approved design doc (ADR, accepted RFC, epic-scale ask) should become several tickets and task folders — proposes the decomposition into ordered sibling parts (cut-line alternatives, Jira mapping), and on the user's confirmation materializes each part's ticket.md plus a seeded CONTEXT.md via prepare-ticket. Proposes first; writes nothing before confirmation.
argument-hint: '[source: task-folder doc path, file path, URL, or pasted text] [optional: parent dir, existing Jira keys]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: infer the effort's domain from the source (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core; each materialized part records its own `**Domain:**` in its seeded `CONTEXT.md`. If the domain has no pack, run the neutral methodology and say so.

This composite turns one **approved** source — an ADR, an accepted RFC, an epic-scale ask — into an ordered set of sibling task folders, each ready to enter the workflow as its own ticket-first task. Two phases, in order: **propose** the cut (chat-only), then — only after the user confirms — **materialize** each confirmed part by executing `../prepare-ticket/SKILL.md` per part plus a `CONTEXT.md` seed. The method — source intake, cut-line lenses, the part-quality bar, ordering, the proposal's shape, the materialization contract — lives in [`./references/workflow/decomposition.md`](./references/workflow/decomposition.md). Read it before Phase 1 and run it; don't restate it.

Phase 2 executes the sibling skill file — read `../prepare-ticket/SKILL.md` and run its full protocol per part. Four overrides apply pipeline-wide (the composite convention):

- **Core Rules blocks** — this skill's block above covers the pipeline; the inner skill's AGENTS.md read is already satisfied and doesn't repeat.
- **Clarifying questions** — `prepare-ticket`'s per-ticket clarifying round folds into Phase 1's single batched confirmation, so Phase 2 drafts unprompted from the confirmed material. A gap discovered only at drafting time is the one exception: ask then, don't guess.
- **Next pointers** — the inner skill's handoff suggestions are dropped; this composite's Output owns **Next**.
- **Destination resolution** — the part folder Phase 2 step 1 just created *is* the task folder: write `ticket.md` into it verbatim, bypassing `task-layout.md`'s *Destination paths* inference — which would read a just-created empty directory as a *parent* and nest a new slug inside it.

**CRITICAL**: Phase 1 writes nothing. Phase 2's write surface is exactly the confirmed part folders — each new `<parent>/<NN->slug/` with its `ticket.md` and seeded `CONTEXT.md`; nothing else. No source-doc edits, no writes into existing task folders, no Jira writes (every mapped ticket body is paste-ready for the user), no git mutation.

## When to Use

**Use when:**

- An approved design doc needs to become several tickets and task folders ("decompose this ADR")
- A large effort should enter the workflow as ordered siblings and the cut deserves a proposal, not a guess

**Skip when:**

- The work fits one ticket → `prepare-ticket`, then `plan-task`
- The source isn't decided — competing directions, unresolved gating scope → `refine-idea` (or finish the source's own review); decomposing an undecided source hardens open questions into tickets
- The sibling folders already exist and a part needs planning or execution → `plan-task` / `implement-task`

## Process

### Phase 1 — Propose (chat-only)

1. **Resolve the source** per `decomposition.md` § *Source intake*: a task-folder doc by path, any file, pasted text, or a URL fetched read-only (ask for a paste when unreachable). Confirm it is decided material; when it isn't, stop and name `refine-idea`.
2. **Resolve the parent directory** — where the siblings will live: the source task folder's own parent when the source lives in a task store (continuing its `NN-` sequence), the canonical root per `./references/workflow/task-layout.md` otherwise, or the destination the user named.
3. **Ground the cut** — read the source in full. When the domain is code, check the source's as-built pointers against current main (`decomposition.md` § *Engineering heuristics*) so staleness lands in the affected parts' seeds instead of resurfacing at plan time.
4. **Propose** per `decomposition.md` § *The proposal*: the recommended cut (parts, numbering, per-part acceptance sketches, dependency notes), genuinely different alternatives when they exist, the Jira mapping when keys were passed, and the open items that gate nothing.
5. **Confirm — one batched round** (the host's structured question tool when available): the cut, the numbering, the parent directory, missing Jira keys, and any per-part gap that would stall ticket drafting. Apply exactly what the user answers; a dropped part leaves the set without renumbering the others.

### Phase 2 — Materialize (per confirmed part, in plan order)

Run `decomposition.md` § *Materialization contract* per part:

1. Create `<parent>/<NN->slug/`.
2. Draft `ticket.md` by executing `../prepare-ticket/SKILL.md` against the part's confirmed acceptance sketch — destination: the part folder; bar: `./references/workflow/ticket-format.md`; clarifications: already batched in Phase 1.
3. Seed `CONTEXT.md` per `./references/workflow/context-schema.md`: `**Status:** seeded-by-decompose-task` (registered in `./references/workflow/task-lifecycle.md`), the part's `**Domain:**`, `## Problem Statement` citing `./ticket.md`, `## References` carrying the source pointer, the part's Jira key when mapped, and the duplicated shared facts, `## Recommended Direction` holding only what the source decides for this part (cited to its section), `## Open Questions` carrying the proposal's gate-nothing items that touch this part, every other section heading present as a placeholder.

## Output

Lists, never tables. Report — don't paste the tickets:

- **Materialized parts** — per part: folder path, ticket title, and — when a Jira mapping exists — the disposition (*absorb into `<KEY>`* — the ticket body doubles as that key's paste-ready description refresh — or *needs-new* with the parent/epic named); omitted for a run with no Jira context.
- **Assumptions and open items** — anything inferred while drafting, plus the gate-nothing items carried from the proposal.
- **Next:** `/plan-task <first-part>` — the bare slug when the parts landed in the canonical root or a registered one, the folder's path when their root is neither (`./references/workflow/task-layout.md` § *One task, one flat folder*) — then one line per remaining part in order.

## Don't Rationalize

- "The cut is obvious, I'll just create the folders" — The propose-then-confirm gate is the skill. A folder set the user didn't confirm is drift manufactured at scale.
- "I'll write richer CONTEXT seeds while I'm here" — The seed's shape is `decomposition.md`'s contract; direction beyond what the source decides belongs to `plan-task` and the user.
- "One part is thin, I'll pad it from the source" — A part smaller than its own ticket folds into a neighbor (the part-quality bar); it doesn't get invented requirements.
- "The user named Jira keys, I'll update the tickets for them" — Never. Mapped bodies are paste-ready; the user makes every Jira write.
- "The source looks slightly stale; planning will catch it" — Check the as-built pointers now. Staleness found at decomposition time belongs in the seeds, not rediscovered per part later.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Source resolved and read in full; the decided-material check passed, or the run stopped naming `refine-idea`
- [ ] Proposal printed with the recommended cut, numbering, acceptance sketches, and dependency notes — plus real alternatives, the Jira mapping, and gate-nothing items where they apply; nothing written before confirmation
- [ ] One batched confirmation round; only confirmed parts materialized, exactly as answered, without renumbering surviving parts
- [ ] Per part: folder placed per the numbering rules; `ticket.md` meets `ticket-format.md`'s bar; `CONTEXT.md` seed is the full schema skeleton with `seeded-by-decompose-task`, Problem Statement citing `./ticket.md`, References carrying source pointer + key + shared facts, gate-nothing items in Open Questions; nothing pre-existing silently overwritten
- [ ] No Jira write, no git mutation, no source-doc edit
- [ ] Output reports every part — with its Jira disposition when a mapping exists — and owns **Next** with the `/plan-task` handoff
