# Decomposition: One Approved Ask into Sibling Tasks

How a large, already-decided piece of work — an approved ADR, an accepted RFC, an epic-scale ask — becomes an ordered set of sibling task folders, each ready to enter the workflow as its own ticket-first task. **This file is the single source of truth for the decomposition method**: source intake, cut-line lenses, the part-quality bar, ordering, the proposal's shape, and the materialization contract. `plan-task` § *Multi-part efforts* and `task-layout.md` § *Multi-part efforts* name **when** a split is needed and **where** siblings live — this file owns **how to choose and land the cut**.

Decomposition sits between deciding and planning: upstream, the source has settled *what* to build (`refine-idea` is the tool when it hasn't); downstream, each part gets its own `plan-task` → `implement-task` lifecycle. The method **proposes first and materializes only after confirmation** — the cut is a judgment call the user owns; the method structures it and surfaces the trade-offs, never decides it silently.

## Source intake

The source is **decided material** — a doc whose direction is already approved, not an idea to refine:

- **A task-folder doc** — the canonical case: an `adr.md` / `rfc.md` / `ticket.md` inside an existing task folder, named by path.
- **Any file on disk, or text pasted into the invocation.**
- **An external URL** (a published or locked design page, an epic) — fetched **read-only** with whatever capability the session has; when unreachable, ask the user to paste the content rather than guessing at it.

If the source turns out not to be decided — competing directions, unresolved gating scope — stop and say so: the upstream move is `refine-idea` (or finishing the source's own review), not a decomposition that would harden open questions into tickets. Open items that gate nothing are carried into the proposal instead (below).

## Cut-line lenses

Generate candidate cuts by looking down these lenses; propose **2–3 genuinely different cuts when more than one is viable**, with a recommendation — and don't fabricate alternatives when the source dictates one:

- **Rollout stages** — the source's own sequencing (a mock → consumer-migration → live-cutover progression, a flag-flip order). The strongest default when the source states a rollout: each stage is independently landable and observable.
- **Layers / components** — split by architectural piece (a shared lib, a service leg, a UI leg). The weakest cut when it produces parts unverifiable on their own; acceptable for a foundational piece with genuinely no vertical seam.
- **Repo / team boundaries** — different repos or owners are natural part boundaries; a part spanning two repos usually wants to be two parts.
- **Risk isolation** — carve the most uncertain piece into its own early part, so a failure surfaces before the rest is invested in.

## Part-quality bar

Test every candidate part before it enters the proposal:

- **Independent** — the part lands and verifies without waiting on a sibling's unfinished internals; cross-part needs flow through the ordering (an earlier part's *finished* output), never through shared work-in-progress.
- **Demoable** — the part ends in something observable: behavior exercised, artifact verifiable. A part whose "done" can only be stated as "code exists" is cut wrong.
- **One ticket ↔ one folder** (default) — each part is exactly one product-facing ticket and one task folder. A part too big for one plan splits further (the same bar `plan-task` applies); a part smaller than its own ticket is noise — fold it into its nearest neighbor.
- **No leftovers bucket** — a "misc" part is a smell: its contents either belong to real parts or aren't in scope.

## Ordering and numbering

Ordering lives in folder names, and only there (`task-layout.md` § *Multi-part efforts*):

- `NN-` prefixes **only when the parts have a blocking order**; unordered parts get plain slugs.
- **Continue an existing sequence** — when the parent directory already carries numbered siblings of the same effort, new parts take the next free numbers (`01-`/`02-` present → new parts start at `03-`).
- **A fresh parent starts at `01-`.**
- All parts of one effort belong in **one parent directory** — the prefix is only visible where the folders sort together.

The proposal states the numbering; the user confirms it with the cut.

## The proposal

Chat-only; **nothing is written to disk before the user confirms.** The proposal carries:

- **Source + parent directory** — what was read, and where the siblings will live.
- **The recommended cut** — per part: `NN-<slug>` · a title in ticket voice (imperative, outcome-first — `ticket-format.md`) · an **acceptance sketch** (2–4 plain-sentence outcome bullets at pre-ticket altitude, sharpened to the full ticket bar at materialization) · dependency notes (which siblings it builds on; which decided source sections it implements).
- **Alternatives considered** — when real: each in a line or two with why it lost; omitted when the source dictates the cut.
- **Jira mapping** — when the user names existing keys (as invocation arguments, or asked once at confirmation): per part, *absorb into `<KEY>`* (the materialized ticket doubles as that key's paste-ready description refresh) or *needs a new ticket* (naming the parent/epic). The method never writes to Jira — every mapped body is paste-ready for the user.
- **Open items that gate no part** — carried visibly, so deferral is a decision, not an omission.

The confirmation is **one batched round**: the cut, the numbering, the parent directory, missing Jira keys, and any per-part gap that would stall ticket drafting — the same clarifications `prepare-ticket` would otherwise ask one part at a time. Apply exactly what the user answers; a dropped part leaves the set without renumbering the others.

## Materialization contract

Per confirmed part, in order:

1. **Folder** — `<parent>/NN-<slug>/` (plain `<slug>/` when unordered). A folder already present at the confirmed path is a stop-and-ask: materialization never writes into an existing task folder and never silently overwrites an existing file.
2. **`ticket.md`** — the part's acceptance sketch sharpened to the full bar in `ticket-format.md`; self-contained (a reader with no access to the source session can act); its References cite the source doc.
3. **`CONTEXT.md` seed** — the full schema skeleton per `context-schema.md`, every section heading present, placeholders where nothing is decided:
    - `**Status:** seeded-by-decompose-task` (the registered origin marker — `task-lifecycle.md`) · `**Domain:**` inferred per part — and when a part is clearly non-code with no clear domain, asked in the confirmation round rather than stamped wrong (`context-schema.md`'s field note).
    - `## Problem Statement` cites `./ticket.md` — never restates the ask.
    - `## References` carries the **source pointer** (the source task's slug and the doc's role name, a root-relative path for a store-level doc, or a URL — per `task-layout.md` § *One home per fact*; for a pasted source, a dated *pasted into session* note — the duplicated facts below are then the part's only durable copy), the part's **Jira key** when mapped, and the **shared facts duplicated** from the source that this part needs — siblings share no layer above them, so each folder carries its own copy (`task-layout.md` § *One home per fact*, closing rule).
    - `## Recommended Direction` holds only what the source already decides for this part, cited to its section — decomposition never invents direction.
    - `## Open Questions` carries the proposal's gate-nothing open items that touch this part — deferral stays a visible, durable decision, not a chat-only note.
4. **Handoff** — the run's report ends with `Next: /plan-task <first-part>` — the bare slug when the parts landed in the canonical root or a registered one, the folder's path when their root is neither (`task-layout.md` § *One task, one flat folder*) — plus one line per remaining part.

Each seeded folder is a normal task folder from that moment: `plan-task` respects the existing `CONTEXT.md` and `ticket.md`, sharpens the ticket's criteria into `goals.md`, and the standard lifecycle takes over.

## Engineering heuristics (domain: code)

- **Prefer rollout-stage and vertical cuts over layer cuts** — a part that ships observable behavior behind a flag beats a part that ships a layer nobody can exercise; a layer part is for a foundational piece with no vertical seam (`../engineering/planning.md`'s slicing rule, one level up).
- **Flag-flip seams are ready-made part boundaries** — mock→live switches, `dev → preprod → prod` gates: each flag state is a demoable end state.
- **A shared-library prerequisite is an early, risk-first part** — a lib later parts import goes first, and its ticket names the consumers it unblocks.
- **Repo boundary = part boundary** — BE and FE legs in different repos are different parts (usually different tickets and owners); a "both repos" part hides an integration risk the cut should expose.
- **Check the source's as-built pointers against current main before materializing** — design docs age; a renamed app or a moved module discovered at decomposition time lands in the affected part's `CONTEXT.md` References, instead of being rediscovered at plan time.

## Anti-patterns

- **Splitting by file type or activity** ("all the models", "testing", "docs") — parts each deliver an outcome, not a category of work.
- **Parts that only verify together** — if A is demoable only once B lands, the cut is wrong: merge them, or find the real seam.
- **Numbering without a blocking order** — a prefix asserts sequence; asserting one that doesn't exist misleads every later reader.
- **Materializing before confirming** — the cut is the user's call; a folder set they didn't confirm is drift manufactured at scale.
- **Padding the proposal with a fabricated alternative** — when the source dictates the cut, say so and recommend it.
