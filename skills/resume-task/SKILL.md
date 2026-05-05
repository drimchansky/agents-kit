---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task in `.agents/tasks/<slug>/` — produces a chat-only briefing without mutating files.
argument-hint: '[task slug or plan path]'
disable-model-invocation: true
---

## Core Rules

Before doing anything else in this skill:

1. Read the sibling file `./AGENTS.md` (relative to this `SKILL.md`).
2. Apply the rules it defines for the rest of this skill's execution.
3. Output the following line as a visible confirmation, **before** any other text or tool calls in this skill, on its own line — substitute `<version>` with the value on the **Version** line at the top of `./AGENTS.md`:

    ✅ Core agents-kit@<version> rules applied

The rules cover scope discipline, push-back behavior, communication style, and pre-presentation checks — they take precedence over default behavior unless the project's own conventions say otherwise.

This skill loads an existing task in `.agents/tasks/<slug>/` and produces a chat-only briefing — used to resume work after time away, hand off, review what was done, or answer questions about a task — whether in progress, blocked, or already shipped. It reads the three task artifacts (`CONTEXT.md`, every `*.plan.md`, every `*.result.md`), reconstructs state from `- [ ]` / `- [x]` checkboxes, checks for drift between the plan's claims and current code/git, and prints a structured brief.

**CRITICAL**: This skill is **read-only across the repo** — task files (`CONTEXT.md`, `*.plan.md`, `*.result.md`) and source code are observed but never modified (no write, edit, rename, delete). The skill also never mutates git state (no add, commit, checkout, stash). Reading implementation code is **expected and required** — the drift check in Step 4 greps shipped paths and opens cited files to verify the plan still matches reality. Output is **chat only** — do not write a `BRIEF.md` artifact. Briefings stale within hours and a fourth file would contradict the three-file contract that `design-plan` and `implement-plan` rely on.

## References

Read `references/engineering/` checklists only if you decide to dig into a pending step's code during the spot-check pass. This skill mostly observes — the references are for callers that go on to execute via `implement-plan`.

## When to Use

**Use when:**

- Returning to a task after time away (yours or someone else's) and you need to know where it stands
- Handing off to a teammate or another session — the brief is the handoff document
- Reviewing what was done before commenting, asking questions, or deciding next steps
- The plan was written a while ago and you suspect the code has moved underneath it (drift check)
- Pre-execution triage: "is this safe to pick up, or has the world moved?"

**Skip when:**

- No task directory exists yet → suggest `refine-idea` or `design-plan`
- Ready to actually execute the next step → use `implement-plan` directly (it reads the same artifacts as a prelude to writing code)
- The task is fresh with no result file yet → just read the plan; there is no state to reconstruct
- The user wants feasibility validation, not status → use `review-plan`

## Process

### 1. Resolve the Task Directory and Plan(s)

Discovery is two-level — first the task directory, then the plan(s) inside it. Mirror `implement-plan`'s rules:

- **If the user gave a full plan path**, use it directly. Derive the task directory from its parent.
- **If the user gave a slug only** (e.g. `add-csv-export`), resolve to `.agents/tasks/<slug>/`. Inside, list `*.plan.md` files (filter out `*.result.md`):
    - Exactly one plan → use it.
    - Multiple plans → brief them all together; surface order if filenames are numbered (`01-`, `02-`).
    - No plans → tell the user the directory exists but has no plan; suggest `design-plan`.
- **If the user gave nothing**, list `.agents/tasks/*/` directories and ask which task. Then descend per the rule above.

Don't guess between ambiguous candidates — ask.

### 2. Load Artifacts

Read in full, not skim:

- `.agents/tasks/<slug>/CONTEXT.md` — the shared static context (problem statement, scope summary, key assumptions, references).
- Every `*.plan.md` in the directory — note each plan's `**Status:**` header.
- Every `*.result.md` — note `**Status:**`, find the latest per-step or full-run section, and capture every `**Blocked:**` block verbatim.

Status values across these three files are defined in `references/engineering/task-lifecycle.md` — consult it if you encounter an unfamiliar value, and use the **pairing rule** there to flag inconsistencies (e.g. plan `executing` with no result file, plan `done` with result `executing`).

If `CONTEXT.md` is missing, flag it in the brief — that's a sign the task was scaffolded outside the standard flow.

### 3. Reconstruct State from Checkboxes

For each plan:

- Count `- [x]` (done) vs `- [ ]` (pending) steps.
- Identify the next pending step. Pull its **What**, **Verify**, **Depends on**, and the file paths it touches.
- For each `- [x]` step, follow the result anchor link to the matching section in the result file.
- If the plan contains `### Checkpoint after Step N` headers, note which checkpoints have a corresponding `## Checkpoint after Step N` entry in the result file with `**Outcome:** passed`.
- Surface every `**Blocked:**` section from the result file verbatim — do not paraphrase.

State is reconstructed from the markers, not inferred from prose. If the prose and checkboxes disagree, trust the checkboxes and note the disagreement.

### 4. Drift Check Against Implementation

The drift check is the load-bearing value over `cat plan.md` — without it, the brief is just a re-rendering of files the user could read themselves. Compare the plan and result file's claims against the current state of the code on disk; do not consult git history.

1. **Extract paths and symbols, partitioned by state.** Walk the plan + every result file and collect paths into two buckets — the existence check in 4.2 treats them differently:
    - **Shipped paths** — every path that appears in a `**Shipped:**` block of a result-file step entry, **plus** every path on a `- [x]` (done) plan step's touch list. These are claims that the file already exists on disk.
    - **Pending paths** — every path on a `- [ ]` (not yet done) plan step's touch list. These may legitimately not exist yet (the step will create them); absence is **not** drift.
    - Inline markdown code spans (`` `like/this.ext` ``) inside narrative prose: tag as **shipped** if they sit inside a `**Shipped:**` block or a done-step's result section; otherwise tag as **pending**.
    - Do **not** filter by file extension; a path is anything that looks like one (contains `/` or matches a known top-level file in the repo).
    - Cited symbols — function, component, type, or export names named inline in plan or result narrative. Always treated as shipped, since they're cited as already-implemented.
2. **Existence check.** Confirm each path still exists on disk:
    - **Shipped path missing** → tag `block` (or `warn` if the path was renamed/moved and you can identify the new location). The plan's claim disagrees with reality.
    - **Pending path missing** → expected; do **not** emit a finding.
    - **Pending path that already exists** → tag `info`. Worth noting (the step may already be partially done, or the filename collides with unrelated code) but not blocking.
3. **Symbol-survival check.** For each cited symbol in a result file's `**Shipped:**` block, grep the named file. Flag symbols that are gone, renamed, or moved.
4. **Implementation-vs-record sanity check.** Open one or two `**Shipped:**` files from the latest result entry and confirm the changes the result describes are visibly present (not reverted, not refactored away). For the next pending step, read the files it will touch and flag if the surrounding code has shifted enough that the step's verify criterion no longer applies cleanly.

Tag each finding `info` (FYI), `warn` (review before resuming), or `block` (plan needs update before execution can proceed).

**Always render the "Drift since plan" heading** — print `No drift detected.` when clean. Absence of drift is a verification statement, not silence.

### 5. Produce the Brief

Assemble per the output template below. Print to chat. Do not write any file.

## Output Template

```markdown
# Resume: <task title>

**Task dir:** `.agents/tasks/<slug>/`
**Plan(s):** `<task-slug>.plan.md` (Status: <status>) [, additional plans …]
**Result(s):** `<task-slug>.result.md` (Status: <status>) — or "not yet started"

## Status

<one paragraph: N of M steps done across <K> plans; executing / blocked / ready to resume / done>

## Done

- Step 1 — <title> ([result](./<task-slug>.result.md#step-1--<slug>))
- Step 2 — <title> ([result](…))

## Up next

- Step <N> — <title>
    - **Verify:** <criterion from plan>
    - **Depends on:** <prior steps>
    - **Touches:** <files from plan>

## Blocked

- <verbatim **Blocked:** sections from result file, one per block — or "none">

## Drift since plan

- [warn] `src/auth/handler.ts` — function `validateToken` cited in Step 3 result is no longer in the file
- [block] `src/legacy/auth.ts` — Step 2 result claims it was modified, but the file no longer exists on disk
- [info] `src/api/users.ts` — Step 4 (pending) plans to create this file, but it already exists; check whether the step is partially done or the filename collides
- [info] `src/cache/ttl.ts` — Step 1's shipped change still present, but adjacent code has been refactored; review before resuming Step 5

(or, when clean: `No drift detected.`)

## Open questions

- <deduped from CONTEXT.md "Open Questions" + plan "Open Questions"; questions answered in the result file are removed>

## Where to start

<2–3 sentences naming the concrete first action — file to open, command to run (e.g. `/implement-plan <slug>`), or a specific drift item to resolve before resuming>
```

If multiple plans live in the directory, render one **Done** / **Up next** / **Blocked** block per plan with a clear sub-heading; the **Drift**, **Open questions**, and **Where to start** sections remain shared.

## Don't Rationalize

- "I'll run the next step while I'm here" — This skill is read-only. Hand off to `implement-plan` if the user wants execution.
- "The plan and result already explain everything; no need to read the code" — Result files describe what _was_ done, not what's in the code _now_. Code can be reverted, refactored, or removed after the fact. The drift check is the load-bearing value over `cat`.
- "The result file is recent, skip the drift check" — Recent ≠ unchanged. The implementation can shift after a step lands.
- "I'll write a `BRIEF.md` so the user has it later" — Briefings stale within hours; a fourth artifact contradicts the three-file contract. Print to chat only.
- "User said 'resume', so I'll just start coding" — In this skill, _resume_ means brief, then decide. The brief is the deliverable; the user picks the next move.

## Verification

- [ ] Task directory `.agents/tasks/<slug>/` resolved (asked the user when ambiguous, never guessed)
- [ ] `CONTEXT.md`, every `*.plan.md`, and every `*.result.md` in the directory read in full
- [ ] No file in the task directory was written, edited, renamed, or deleted
- [ ] No git state was mutated (no add, commit, checkout, stash)
- [ ] Step state reconstructed from checkbox markers, not inferred from prose
- [ ] All `**Blocked:**` sections in the result file surfaced verbatim
- [ ] Drift check compared plan/result claims against the current implementation on disk; findings listed (or `No drift detected.` stated explicitly)
- [ ] Plan-referenced paths partitioned into shipped vs. pending before existence-check; missing **shipped** paths flagged as `block`/`warn`, missing **pending** paths not flagged
- [ ] At least one `**Shipped:**` file from the latest result entry spot-checked against current source
- [ ] Brief uses the documented template sections in order
- [ ] "Where to start" names a concrete first action (file + command), not a generic suggestion
- [ ] Open questions deduplicated across `CONTEXT.md` and plan; already-answered ones removed
- [ ] No `BRIEF.md` (or any other file) was created
