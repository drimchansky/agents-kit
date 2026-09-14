# Decomposition: One Approved Ask into Sibling Tasks

How an approved ADR, an accepted RFC, or an epic-scale ask becomes an ordered set of sibling task folders, each entering the workflow as its own ticket-first task. `plan-task` § *Multi-part efforts* and `task-siblings.md` say when a split is needed and where siblings live; this file says how to choose and land the cut.

The source has already settled *what* to build (`refine-idea` is the tool when it has not); each part then gets its own `plan-task` → `implement-task` lifecycle. The method proposes first and materializes only after confirmation: the cut is the user's call.

## Source intake

The source is decided material:

- **A task-folder doc**: an `adr.md`, `rfc.md`, or `ticket.md` inside an existing task folder, named by path.
- **Any file on disk, or text pasted into the invocation.**
- **An external URL**, fetched read-only; when unreachable, ask the user to paste the content.

A source that is not decided (competing directions, unresolved gating scope) stops the run: name `refine-idea` or the source's own review. Open items that gate nothing are carried into the proposal.

## Cut-line lenses

Propose 2–3 genuinely different cuts when more than one is viable, with a recommendation; do not fabricate alternatives when the source dictates one.

- **Rollout stages**: the source's own sequencing (mock → consumer migration → live cutover, a flag-flip order). The strongest default: each stage lands and is observed on its own.
- **Layers / components**: a shared lib, a service leg, a UI leg. The weakest cut when parts cannot verify alone; acceptable for a foundational piece with no vertical seam.
- **Repo / team boundaries**: a part spanning two repos usually wants to be two parts.
- **Risk isolation**: the most uncertain piece as its own early part.

## Part-quality bar

- **Independent**: lands and verifies without a sibling's unfinished internals; cross-part needs flow through the ordering, never through shared work-in-progress.
- **Demoable**: ends in behavior exercised or an artifact verifiable. "Code exists" is not done.
- **One ticket ↔ one folder**: a part too big for one plan splits further; a part smaller than its own ticket folds into its nearest neighbor.
- **No leftovers bucket**: a "misc" part's contents belong to real parts or are out of scope.

## Ordering and numbering

Ordering lives in folder names only (`task-siblings.md`):

- `NN-` prefixes (two digits and a hyphen) only when the parts have a blocking order; unordered parts get plain slugs.
- Continue an existing sequence: `01-`/`02-` present → new parts start at `03-`. A fresh parent starts at `01-`.
- All parts of one effort share one parent directory.

The proposal states the numbering; the user confirms it with the cut.

## The proposal

Chat-only; nothing is written before the user confirms. It carries:

- **Source + parent directory.**
- **The recommended cut**, per part: `NN-<slug>` · a title in ticket voice (imperative, outcome-first, `ticket-format.md`) · an acceptance sketch of 2–4 plain-sentence outcome bullets, sharpened to the full ticket bar at materialization · dependency notes (which siblings it builds on, which source sections it implements).
- **Alternatives considered**, each in a line with why it lost; omitted when the source dictates the cut.
- **Jira mapping**, when the user names existing keys: per part, *absorb into `<KEY>`* (the materialized ticket doubles as that key's paste-ready description) or *needs a new ticket* under a named parent. The method never writes to Jira.
- **Open items that gate no part**, carried visibly.

Confirmation is one batched round: the cut, the numbering, the parent directory, missing Jira keys, and any per-part gap that would stall ticket drafting. Apply exactly what the user answers; a dropped part leaves the others unrenumbered.

## Materialization contract

Per confirmed part, in order:

1. **Folder**: `<parent>/NN-<slug>/` (plain `<slug>/` when unordered), after the cross-root collision check `task-layout.md` § *Discovery rules for skills* binds to every **resolve-or-create** member. A folder already present at the confirmed path is a stop-and-ask: never write into an existing task folder, never silently overwrite a file.
2. **`ticket.md`**: the acceptance sketch sharpened to the full bar in `ticket-format.md`, self-contained, its References citing the source doc.
3. **`CONTEXT.md` seed**: the full schema skeleton per `context-schema.md`, every heading present:
    - `**Domain:**` inferred per part; a clearly non-code part with no clear domain is asked in the confirmation round.
    - `## Problem Statement` cites `./ticket.md`.
    - `## References` carries the source pointer (the source task's slug and doc role, a root-relative path for a store-level doc, or a URL; for a pasted source, a dated *pasted into session* note), the part's Jira key when mapped, and the shared facts the part needs. A fact an applicable ancestor `GROUP_CONTEXT.md` holds is cited there by root-relative path (`./task-store.md` § *Shared group context*); one no group holds is duplicated into the folder (`./one-home.md` § *One home per fact*).
    - `## Recommended Direction` holds only what the source decides for this part, cited to its section.
    - `## Open Questions` carries the proposal's gate-nothing items that touch this part.
4. **Handoff**: the report ends with `Next: /plan-task <first-part>`, the token `task-layout.md` § *One task, one flat folder* fixes (bare slug where one resolves, folder path otherwise), plus one line per remaining part.

Each seeded folder is then a normal task folder: `plan-task` respects the existing `CONTEXT.md` and `ticket.md` and sharpens the ticket's criteria into `goals.md`.

## Engineering heuristics (domain: code)

- Prefer rollout-stage and vertical cuts over layer cuts; a layer part is for a foundational piece with no vertical seam (`../engineering/planning.md`).
- Flag-flip seams (mock → live, `dev → preprod → prod`) are ready-made part boundaries.
- A shared-library prerequisite is an early, risk-first part whose ticket names the consumers it unblocks.
- Repo boundary = part boundary: BE and FE legs in different repos are different parts.
- Check the source's as-built pointers against current main before materializing; a renamed app or moved module lands in the affected part's `CONTEXT.md` References.

## Anti-patterns

- Splitting by file type or activity ("all the models", "testing", "docs")
- Parts that only verify together: merge them or find the real seam
- Numbering without a blocking order
- Materializing before confirming
- Padding the proposal with a fabricated alternative
