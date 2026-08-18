---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task folder (canonically under `.agents/tasks/`) — produces a chat-only briefing. Read-only.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core. This skill mostly observes; pull in deeper pack files only if you dig into a step's work. If the domain has no pack, run the neutral methodology and say so.

This skill loads an existing task folder (canonically under `.agents/tasks/`, though anywhere on disk works the same) and produces a chat-only briefing — to resume work after time away, hand off, review what was done, or answer questions about a task, whether in progress, blocked, or already shipped.

**CRITICAL**: This skill is **read-only**, and it runs **no reference sweep** — task files, source code, and git state are never modified — save the user-confirmed activation `mv` of a backlogged folder, which relocates it untouched rather than editing anything in it (`./references/workflow/implement-task-edges.md` § *Activating a backlogged task*) — and the folder's cited links are never swept for freshness. Those links are the reconcilers' business (`references/workflow/reconciliation.md` § *External reference check*). When the folder carries an `observations.md`, quoting its dated lines is reading the folder, not sweeping — quote them with their dates, as cache, never as live state. Verifying a *claim* is not sweeping a *citation*, though: where a domain's own artifacts live behind a URL, the Step-4 drift check still reads them, read-only, per the domain's `verification.md`. Output is **chat only**: no `BRIEF.md` or scratch briefing file.

## When to Use

**Use when:**

- Returning to a task after time away (yours or someone else's) and you need to know where it stands
- Handing off to a teammate or another session — the brief is the handoff document
- Reviewing what was done before commenting, asking questions, or deciding next steps
- The plan was written a while ago and you suspect the code has moved underneath it (drift check)
- Pre-execution triage: "is this safe to pick up, or has the work on disk moved underneath the plan?"

**Skip when:**

- The brief's findings should also be written back into the task docs → use `resume-task-reconcile`, which runs this brief and then reconciles against it
- The cited tickets, PRs, or docs need checking → this skill runs no reference sweep; use `resume-task-reconcile`, or `reconcile-task` at the end of a working session
- No task folder exists yet → suggest `refine-idea` or `plan-task`
- Ready to actually execute the next step → use `implement-task` directly
- The task is fresh with no result file yet → just read the plan; there is no state to reconstruct
- The user wants feasibility validation, not status → use `review-task`
- The gap needs real work — code changes, re-running the acceptance gate, clearing a blocker → use `implement-task`; reconciliation fixes docs only

## Process

### 1. Resolve the Task Folder

Resolve a task folder per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` § *Discovery rules for skills* — cite it, don't restate it; a full `plan.md` path is taken directly.

The activation offer for a folder resolving under `Backlog/` is `./references/workflow/implement-task-edges.md` § *Activating a backlogged task* — read it when resolution lands there; the confirmed `mv` it asks for is the one exception to this skill's read-only rule. <!-- cold -->

**Read the plan** — read the resolved folder's `plan.md` (one plan per folder). No `plan.md` → tell the user the folder exists but has no plan; suggest `plan-task`.

### 2. Load Artifacts

Read all four core artifacts — plus `ticket.md`, `diagram.md`, and `observations.md` when present — don't answer from headers or the latest section alone:

- `ticket.md` (when present) — the product-facing ask and its acceptance criteria.
- `CONTEXT.md` — the static grounding context (problem statement, scope summary, key assumptions, references).
- `goals.md` — capture the full `## Goals` list by `G<n>` ID. Note any goal marked `_(unresolved: ...)_`.
- `plan.md` — note its `**Status:**` header and its `**Goals:**` link.
- `diagram.md` (when present) — the target-state shape the plan builds toward; capture its dated `**Reflects:**` line. Absence is normal and is not a gap.
- `observations.md` (when present) — the last sweep's dated observations of the folder's cited references (`./references/workflow/task-observations.md`); a cache to quote with its dates, never live truth. Absence is normal. <!-- cold -->
- `result.md` — read `## Current state` first for orientation (derived metadata, never trusted ground truth); then note `**Status:**`, find the latest per-step or full-run section, capture every `**Blocked:**` and `**In review:**` block verbatim, and capture any `## Acceptance` section verbatim.

Status vocabulary and the **pairing rule** live in `./references/workflow/task-lifecycle.md` § *Status values* and § *Pairing rule* — flag mismatched pairs as drift. Deliberate pauses are not drift: a `skipped` plan is abandoned (a missing result file is expected), `blocked` + `**Blocked:**` is paused (name the cause), and `in-review` + `**In review:**` is parked awaiting the listed `(external)` goals.

Flag in the brief:

- `CONTEXT.md` missing → task scaffolded outside the standard flow.
- A plan with no sibling `goals.md` → `plan-task` was expected to produce one; the acceptance gate cannot run without it.

### 3. Reconstruct State from Checkboxes

For the plan:

- Count `- [x]` (done) vs `- [ ]` (pending) steps.
- Identify the next pending step. Pull its **What**, **Verify**, **Depends on**, any **Due** / **Lead time**, and the file paths it touches.
- For each `- [x]` step, follow the result anchor link to the matching section in the result file. **Match the anchor to the result file's actual shape:** a step-by-step run has `## Step N — <title>` headings (anchor `#step-n--<slug>`), but a full-plan run records a single `## Full Run — <date>` section (anchor `#full-run--<date>`) — there every step's `Done` link targets that one combined anchor.
- If the plan contains `### Checkpoint after Step N` headers, note which checkpoints have a corresponding `## Checkpoint after Step N` entry in the result file with `**Outcome:** passed`.
- Surface every `**Blocked:**` and `**In review:**` section from the result file verbatim.

If the prose and the checkboxes disagree, trust the checkboxes and note the disagreement.

### 4. Drift Check Against Current Reality

Compare what the plan and result files **claim was done** against the current state of the world the task acts on; don't reconstruct it from history — observe what's there now.

Partition the claims by state, because they're checked differently:

- **Done / shipped claims** — anything a `**Shipped:**` block or a `- [x]` step asserts already exists or already happened. Checkable against reality now; a claim that no longer holds is drift.
- **Pending claims** — anything a `- [ ]` (not yet done) step will produce. These may legitimately not exist yet; absence is **not** drift. A pending artifact that *already* exists is worth an `info`.
- **`## Current state` claims** — the digest's status gloss, `**Pointers:**` entries, and `**Next:**` line. The digest is derived and rots without any checkbox moving: a gloss that no longer matches the markers, or a `**Next:**` naming an action that already happened, is drift — tag `warn`. A pointer that names something on disk (branch, SHA) is checked against the repo like any other claim; one that names an external system is **not** fetched here — quote `observations.md`'s dated line for it when the file exists, or say it wasn't checked; either way the brief never implies live verification.

For each done/shipped claim, confirm it still holds and tag the finding. When the domain is code, follow the drift-verification recipe in `./references/engineering/exploration.md` § *Blast-radius / drift verification (used by review and resume)*. For other domains, verify each claim against the domain's own artifacts.

**Goal sanity check (domain-neutral).** If the result file has an `## Acceptance` section, re-check the goals tagged `met` against current behavior: on a `done` plan re-check **every** `met` goal, never a sample; on a still-`executing` plan, spot-check the `met` ones you can reach. No `## Acceptance` section on a `done` plan is itself drift — the gate was skipped; flag it `block`. A `met` goal that no longer holds is `warn`. A goal tagged `pending external` is neither drift nor `unmet` — it's an `(external)` goal awaiting verification outside the session; surface it as outstanding (with what's awaited) rather than re-checking it against in-session behavior.

Tag each finding `info` (FYI), `warn` (review before resuming), or `block` (plan needs update before execution can proceed).

**Always render the "Drift since plan" heading** — print `No drift detected.` when clean; the absence line is the verification statement.

### 5. Produce the Brief

Assemble per the output template below and print it to chat. This is the last step; no file is written.

## Output Template

```markdown
# Resume: <task title>

**Task dir:** `<resolved task folder path>`
**Goals:** `goals.md`
**Plan:** `plan.md` (Status: <status>)
**Diagram:** `diagram.md` (Reflects: <the line verbatim>) — _omit this line entirely when the task has no diagram_
**Result:** `result.md` (Status: <status>) — or "not yet started"

## Status

<one paragraph: N of M steps done; executing / blocked / in-review / ready to resume / done / skipped; whether the acceptance gate has run and whether any `(external)` goal is still pending. May quote the result's `## Current state` gloss, marked verified or stale per the Step-4 drift check, never repeated unchecked>

## Goals

- G1 — <as written in goals.md> — _met / met with caveats / unmet / out of scope / pending external / not yet checked / unresolved_

(Pull each goal verbatim from `goals.md` with its `G<n>` ID, keeping any `(external)` marker. Outcomes come from the result file's `## Acceptance` section, tagged by ID — carry each tag through verbatim: `met with caveats` with its caveat note, `out of scope`, `pending external` with what's awaited. No `## Acceptance` section → mark every goal _not yet checked_. Surface any goal trailing `_(unresolved: ...)_` as `unresolved`.)

## Done

- Step 1 — <title> ([result](./result.md#step-1--<slug>))

## Up next

- Step <N> — <title>
    - **Verify:** <criterion from plan>
    - **Depends on:** <prior steps>
    - **Due / Lead time:** <from plan, if set — otherwise omit>
    - **Touches:** <from plan, if set — otherwise omit>

## Blocked

- <verbatim **Blocked:** sections from result file, one per block>

## In review

- <verbatim **In review:** section from result file — the pending `(external)` goals and what each awaits>

## Drift since plan

- [warn] `src/auth/handler.ts` — function `validateToken` cited in Step 3 result is no longer in the file
- [block] `src/legacy/auth.ts` — Step 2 result claims it was modified, but the file no longer exists on disk
- [info] `src/api/users.ts` — Step 4 (pending) plans to create this file, but it already exists; check whether the step is partially done or the filename collides
- [info] `src/cache/ttl.ts` — Step 1's shipped change still present, but adjacent code has been refactored; review before resuming Step 5
- [warn] G2 — result claims `met` but the named flow no longer behaves as the goal requires; re-run the acceptance gate before relying on the prior result

(or, when clean: `No drift detected.`)

## Open questions

- <deduped from CONTEXT.md "Open Questions" + plan "Open Questions" + any goals marked `_(unresolved: ...)_`; questions the result file already answers are removed, and the answer surfaced in their place>

## Where to start

<2–3 sentences naming the concrete first action — file to open, command to run (e.g. `/implement-task <slug>`), or a specific drift item to resolve before resuming>
```

Omit sections with nothing to report — **except** "Drift since plan", which always renders.

## Don't Rationalize

- "I'll run the next step while I'm here" — This skill never executes plan work, and never writes. Hand off to `implement-task`.
- "The plan and result already explain everything; no need to read the code" — Result files describe what _was_ done, not what's in the code _now_; the drift check is the load-bearing value over `cat`.
- "The result file is recent, skip the drift check" — Recent ≠ unchanged. The implementation can shift after a step lands.
- "User said 'resume', so I'll just start coding" — In this skill, _resume_ means brief, then decide; the user picks the next move.
- "The ticket link is right there; one fetch would sharpen the brief" — This skill sweeps no citations, by design; point the user at `resume-task-reconcile`. Reading the artifact a *claim* points at stays in scope — that's the drift check.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Task folder resolved per `task-layout.md` (asked when ambiguous); all four core artifacts read (plus `ticket.md`, `diagram.md`, and `observations.md` when present); a missing `goals.md` flagged
- [ ] Nothing written, edited, renamed, or deleted anywhere — save a user-confirmed activation `mv` of a backlogged folder; no git mutation, no reference sweep run, no `BRIEF.md` or scratch briefing file
- [ ] State reconstructed from checkbox markers, not prose; `**Blocked:**` / `**In review:**` sections surfaced verbatim; a `skipped` plan reported as abandoned, not drift
- [ ] Drift check compared done/shipped claims against current reality — partitioned shipped vs. pending, `## Current state` claims included, every `met` goal re-checked on a `done` plan, a missing `## Acceptance` on a `done` plan flagged `block` — with "Drift since plan" rendered even when clean
- [ ] Brief printed to chat with the template sections and a concrete "Where to start" action
