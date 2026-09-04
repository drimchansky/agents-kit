---
name: implement-task
description: Use when asked to implement, execute, run, or carry out a task's plan from a task folder (canonically under `.agents/tasks/`) — by task folder path, or the current task if one is already in context.
argument-hint: '[task folder path]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

Executes a plan written by `plan-task` — or any same-format `plan.md` in a task folder, canonically under `.agents/tasks/` though a folder anywhere on disk works the same. It implements the work, records it in a companion **result file** as it goes, marks each step done in the plan with a link to that record, and runs an **acceptance gate** against the goals before flipping the plan to `done`.

Plan = the contract for **how**. Goals = the contract for **what done means**. Result file = the **record**: a rewritable `## Current state` digest above an append-only log. `CONTEXT.md` = static grounding context. `ticket.md` = the product-facing ask the goals derive from.

## Inputs

All in the resolved task folder, opened in the order §1 fixes — never all at once:

- `ticket.md` — optional, read-only
- `CONTEXT.md` — read-only
- `goals.md` — read-only; the acceptance contract (§7)
- `plan.md` — the steps to execute
- `result.md` — this run's record (§3, §5)

Read `./references/workflow/execution-loop.md` before working — the loop, its two verification tiers, its failure discipline, and the six parameters this skill binds — five in §4 below, **Acceptance** at the §7 gate — stated here in full, so this skill needs nothing from the cross-consumer index. Then the pack files Core Rules 2 calls for: `execution.md` (how to carry out a step), `verification.md` (what its two tiers run), and any per-surface checklist the work touches. For code that is `./references/engineering/`, where the checklists matter most because this skill produces the actual work product.

**CRITICAL**: This skill mutates the plan and the result file — never `CONTEXT.md`, `goals.md`, or `ticket.md`. Its only Git writes are the task's own branch and worktree (§1, §3, §8), plus the branch-scoped `git fetch origin <default-branch>` the **merged** predicate runs wherever it is invoked — §8's removal, §1's re-entry — which moves the default branch's remote-tracking ref and no other — nothing staged, committed, or pushed. Outside the task folder and the work product, its one write is the repository's own `AGENTS.md` / `CLAUDE.md` — the branch convention a creation-path run proposes where the repository declares no pattern, recorded there **only on the user's explicit confirmation**: `./references/workflow/task-delivery-edges.md` § *Proposing an observed branch convention*. <!-- cold -->

Per-file authorship is `./references/workflow/task-authorship.md` § *Files*; this skill adds only that the plan changes by checkbox flips, appended result links, `**Status:**`, and §6 revisions.

## When to Use

**Use when** the user asks to implement, execute, run, carry out, or resume a task or its plan — pointing at a task folder (e.g. `.agents/tasks/add-csv-export/`) or its `plan.md`, or naming a task already established in this session.

**Skip when:**

- No task folder exists yet — direct the user to `plan-task` first
- The work is small enough that a plan would be overhead — use `implement`, the same loop against an ask framed in the session
- The plan is still being iterated on, not yet finalized
- The plan's `**Status:**` is `skipped` — deliberately abandoned. Confirm the user wants it revived; never silently run an abandoned plan. On confirmation, §3 takes the registered `skipped → executing` revive (`./references/workflow/task-lifecycle.md`)

A task described with no plan: suggest `plan-task` when it's non-trivial, `implement` when it isn't.

## Process

### 0. Prepare Against Authoritative Sources

Establish ground truth before the work, per `./references/workflow/execution-loop.md` § *Ground truth before work* — the resolved domain's `execution.md` carries the recipe.

**Binding for what you find:** record the sources you ground the work on — and any pattern you couldn't ground — in the result file's `**Sources:**` field (§5), never in code comments.

### 1. Locate and Load the Task

**Resolve the folder** per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` — cite them, don't restate them.

The activation offer for a folder resolving under `Backlog/` is `./references/workflow/implement-task-edges.md` § *Activating a backlogged task* — read it when resolution lands there. <!-- cold -->

**Then load it** in the order `./references/workflow/task-layout.md` § *Reading a resolved folder* fixes. What that order means here:

- The report's exit 1 is a folder with no readable `plan.md` (one plan per folder) → say so and suggest `plan-task`.
- `goals.md` defines the final gate. Missing → stop and tell the user; `plan-task` should produce one. Never invent goals to fill the gap.
- `CONTEXT.md` — its header block for the `**Domain:**` Core Rules 2 needs; its prose sections when a step's packet (§4) turns on them.
- `ticket.md` when present — the product-facing ask, read-only; the gate runs against `goals.md`, not the ticket.
- A `currentState` block, or any step already checked, means a prior session got partway: pick up where it left off, never redoing completed steps. Then branch on the reported plan status (`./references/workflow/task-lifecycle.md`):
    - `blocked` → read the result's `**Blocked:**` section; resume only once the blocker has cleared, flipping the plan back to `executing` first.
    - `in-review` → read the result's `**In review:**` section listing the pending `(external)` goals. Don't re-run the plan: take those goals alone through §7, against the external confirmation the user now provides, then §8, whose later-run finalization runs a fresh health boundary before `done`.

**A branch in `**Pointers:**` means a task worktree** — re-enter or recreate it first: `./references/workflow/implement-task-edges.md` § *Task worktree*. <!-- cold -->

### 2. Decide Execution Mode

Ask the user, or infer from the request:

- **Step-by-step** — one step, update both files, pause for the user to inspect or decide. Default for risky or large plans.
- **Full plan** — every step end-to-end, then one combined result (§5). Default for small plans (≤3 steps) or an explicit "just run the whole thing".

Step-by-step simply pauses after each step's unit outcome and the health boundary that pause carries (§4). The automatic parallel batch is full-plan only — a batch would collapse exactly the pause points step-by-step exists to give the user.

### 3. Initialize Execution State

Every status value and transition used here is registered in `./references/workflow/task-lifecycle.md`, the single source of truth; on any disagreement the registry wins.

**Create the task branch and worktree first** — unless §1 re-entered one — when both gate conditions hold: the task's resolved `**Domain:**` is `engineering`, and the resolved repository exists and holds at least one path a plan step names. Creation is **announced**, so the `**Pointers:**` below carries the branch. A doc or bureaucratic task, or one for which no root resolves at all, fails the gate and skips creation silently, opening nothing; every other run reads `./references/workflow/task-delivery.md` § *Branch and worktree creation*, which owns **Which repository**, the naming, the sanction, the degrade, and the one skip that announces itself. <!-- cold -->

Create `<task-dir>/result.md` when it doesn't already exist, from the header and `## Current state` block of `./references/templates/result.md`, dated today.

`## Current state` is derived header metadata on the contract in `./references/workflow/task-authorship.md`: rewritten **in place**, with everything below its closing `---` the append-only log.

Then point the plan's `**Result:**` line at `./result.md` and flip its `**Status:**` from `to-do` to `executing`.

**Reviving a `skipped` plan** — only after the explicit confirmation the *Skip when* gate requires.

The archive-location check and the revive procedure are `./references/workflow/implement-task-edges.md` § *Reviving a skipped plan* — read them at a revive. <!-- cold -->

### 4. Execute Steps

Run the loop in `./references/workflow/execution-loop.md` — the five beats, its two verification tiers, Stop-the-Line when required evidence fails, the assertion-gate discipline. Read it before starting.

**This skill's bindings:**

- **Source** — one unit is one plan step; its criterion is that step's plan-defined `Verify` line. Stay inside the plan's scope; respect `Depends on:` ordering in both modes.
- **Record** — append a result section (§5) once the step's outcome and, where the step carries one, its health boundary have run.
- **Mark done** — flip `- [ ]` to `- [x]` for that step and append the result-section link:

    ```
    - [x] **What:** <unchanged> ([result](./result.md#step-1--add-csv-writer))
    ```

- **Pause or continue** — step-by-step: stop after each step and report progress. Full-plan: continue.
- **Blocked** — a Stop-the-Line that can't clear this session: the plan's `**Status:**` to `blocked`, a `**Blocked:**` section in the result file naming the cause (what failed, what was tried, what's needed — or what's awaited) and the last health boundary that passed with what it covered, or `none` where none did, `## Current state` rewritten naming the blocker, then stop — don't skip ahead (`./references/workflow/task-lifecycle.md`).
- **Health boundaries** — every step-by-step pause before the user receives the tree; every authored checkpoint after its named assertions; each natural batch bound before dependent work; the full-plan tail before acceptance; and every later-run `in-review → done` finalization after the pending external goals are re-checked and before status advances. A batch bounded by a checkpoint shares that checkpoint's one health pass, and a tail batch shares the full-plan tail — neither adds another. At a step-by-step pause the boundary runs after the step's outcome proof and **before** its result section is appended, so the section records a result that exists. Between boundaries, a step proves its own outcome tier (`./references/workflow/execution-loop.md` § *Two verification tiers*) and no more; the integrated recipe (`./references/engineering/verification.md` for code, which resolves each boundary's scope) runs only at the places above. The later finalization is a fresh boundary under the shared loop's cross-run identity rule; record a successful result in §8's dated section. If it fails, take the plan through the registered `in-review → executing` edge before this binding's existing **Blocked** behavior.
- **Integration assertions** — the plan's `### Checkpoint after Step N` headings. Each is **mandatory** after marking step N done, not an optional summary; a checkpoint is not a step, carries no `- [ ]`, and is never flipped. Run its assertions per the shared loop, then its health boundary, append a checkpoint section (§5), and in step-by-step mode pause as at a step boundary.

#### Execution strategy: every step delegates

Execute each step through an **executor** per `./references/workflow/executor-contract.md` and its `implement-task` binding — read both before the first step — whose **Segment bound** fixes the launch shape and whose engine `native` places a serially delegated step or segment on the shared tree; steps eligible for the parallel batch below leave that shape.

**Every step goes to an executor**: `./references/workflow/write-mode-posture.md` owns that posture, what a launch packet owes, and the three exceptions that keep a step here — read it before the first step. Capture the shared tree before launching — the `baseline` manifest the intake's surface check needs, one per segment, checked over its steps' edit surfaces. **Deviation is measured against the mode's default launch on `native`**, never against whichever engine the run selected — which is what the `**Executed:**` fields (§5) record. While an executor is in flight the coordinator waits — no step of its own, no shared-tree edit — per `./references/workflow/delegated-waiting.md` § *How to wait*. Then take each report through that contract's § *Write-mode routing* intake, which decides whether the step's outcome tier is re-proved here, and record the step (§5); a failure there is Stop-the-Line at that step, on the contract's § *Segment launches* terms.

**Inline is an exception, announced and recorded.** A step runs here only on one of that **posture** file's three exceptions, on the announce-and-record terms it sets — `**Executed:**` (§5) is this skill's shape for them. A failed or hung executor is reported and takes this binding's **Fallback**, after which continue. On a segment, the contract's § *Segment launches* governs what stands and what relaunches. <!-- cold -->

#### Automatic parallel batch (full-plan mode)

Eligible independent steps run concurrently through the same contract and binding. Eligibility, launch, merge, and the checkpoint hand-off are `./references/workflow/implement-task-edges.md` § *Automatic parallel batch* — read it when steps declare `**Touches:**` surfaces in full-plan mode and a batch may qualify. No `**Touches:**` line (or `**Touches:** none`) → serially-delegated. <!-- cold -->

### 5. Result File: Sections

Copy each section from `./references/templates/result.md` and fill it: the per-step record, the full-run variant that replaces the per-step blocks in full-plan mode, the checkpoint block, the `## Decision log` line, and §7's `## Acceptance`.

Each record is held to `RECORD_MAX_KB` (`./references/workflow/task-layout.md` § *One task, one flat folder*), which is what the field bounds serve: an executor's report is cited by the `executor` / `coordinator` token `**Verified:**` opens with — on a segment, by the unit it was reported for — and never pasted, a longer excerpt going to a scratch or log file the record cites. The full-run variant and the checkpoint block bound each step's entry the same way.

`**Health:**` records the boundary to the resolved domain's shape (`./references/engineering/verification.md` § *What a boundary records* for code), omitted on a step merged from a parallel batch and on one that ended at an authored checkpoint, whose section carries it instead.

`**Executed:**` is omitted for a step that ran the mode's default launch on `native` — per-step serial in step-by-step, its checkpoint-bounded segment in full-plan. Otherwise it names what deviated: "parallel batch (<executor engine>), merged in plan order at/before <the §4 merge point>", "serial delegation (<executor engine>)", or "inline (<which posture exception: not specifiable / delegation unavailable / executor failed> — <detail>)". The full-run variant prefixes each such entry `Step N`, and writes "Steps M–N segment (<executor engine>)" for a segment reshaped by a relaunch.

In full-plan mode, still flip every step's `- [ ]` to `- [x]`, each linking to the same `#full-run--<date>` anchor (note the double hyphen — the em-dash in the header drops out and both surrounding spaces become hyphens).

Merged parallel-batch steps are the exception on both counts: each keeps its own per-step section — its merge gates and `**Executed:**` record are per-step — and its checkbox links there instead of the `#full-run` anchor. Only the batch's serially-executed steps fold into the combined block.

A failed checkpoint records the `**Asserted:**` and `**Health:**` results that ran (or `not run`), `**Outcome:** failed`, and the failure details, then follows Stop-the-Line. Do not move on.

**At every plan `**Status:**` flip and at run end** — finalize included; a run dying mid-way leaves it stale, tolerated by the next run — rewrite `## Current state` on its cited contract, carrying any commit watermark entry forward untouched (`./references/workflow/reconciliation-commits.md` § *The watermark*). **When a step records a decision**, append the template's dated one-liner to the result's `## Decision log`, creating that section directly below `## Current state`'s closing `---` when absent, as the first section of the append-only log — a pointer to where the decision is recorded, never the decision text itself (`./references/workflow/task-authorship.md`).

### 6. Plan Revisions Mid-Execution

When implementation reveals the plan is wrong — a step infeasible, scope wrong, a new step needed, or a step too large to land in one slice — apply the scope-change rules in `./references/workflow/execution-recovery.md` § *Scope changes mid-execution*, including its splitting strategies. The binding — the in-place plan update, the `**Deviations from plan:**` record, the step-by-step pause, and the abandon flow — is `./references/workflow/implement-task-edges.md` § *Plan revisions* — read it when a revision is needed. <!-- cold -->

### 7. Acceptance Gate

After the last step is marked done but **before** flipping the plan's `**Status:**` to `done`, run the acceptance gate against `goals.md`, applying the acceptance discipline in `./references/workflow/execution-acceptance.md`. Binding: the criteria are `goals.md`'s `G<n>` goals, and the verdict goes in an `## Acceptance` section of the result file.

**Tag each goal** by its `G<n>` ID: `met`, `met with caveats`, `unmet`, `out of scope`, or `pending external`.

- `out of scope` **only when the plan's `## Scope` lists that goal ID in its deferred partition** — confirm the ID is actually there. One you'd call out-of-scope that isn't in the deferred set drifted in after the plan was written: surface it rather than silently dropping it under a label the scope never authorized.
- `pending external` **only for a goal carrying the `(external)` marker** whose verification you genuinely can't perform in-session (a human/client sign-off, a live/production state you can't drive) — record what's awaited and who/what will verify it. Never a substitute for `unmet`: if the agent-verifiable work behind the goal isn't done, it's `unmet`.

Append a single `## Acceptance` section to the result file, copied from `./references/templates/result.md`: one line per goal, each carrying its tag and the evidence, caveat, or awaited confirmation behind it.

**Any goal `unmet` → do not finalize.** Apply Stop-the-Line: localize the gap, then decide whether it's a missed step (revise the plan, add steps, return to execution) or a goals misunderstanding (surface it, let the user edit the goals file, re-run the gate).

**Any goal `met with caveats` → secure explicit user acknowledgement before finalizing.** Surface each caveat — what's caveated and why — confirm the user accepts shipping with it (the provenance `out of scope` carries at tag time), and record the acknowledgement in that goal's `## Acceptance` entry. An unacknowledged `met with caveats` is not a pass: treat it like `unmet` and do not finalize.

**Any goal `pending external` → do not finalize to `done`; park at `in-review`.** Every *other* goal must be `met` / acknowledged-caveat / out-of-scope first. Then take §8's `in-review` branch.

### 8. Finalize

The gate produces one of two session-terminal outcomes. "Acknowledged" below means the §7 acknowledgement for every `met with caveats` and `out of scope` goal.

**Park at `in-review`** when every agent-verifiable goal is `met` or acknowledged **but one or more `(external)` goals are `pending external`**:

- The plan's `**Status:**` to `in-review`
- An `**In review:**` section in the result file listing each pending goal — `- G<n> — <what's awaited, who/what verifies it>` — and **no** `**Completed:**` line
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*); its summary additionally names which agent-verifiable goals are `met`, and exactly what external verification is outstanding and how to confirm it

**Finalize to `done`** only once every goal is `met` or acknowledged **and none is `pending external`**:

- The plan's `**Status:**` to `done`
- A closing `**Completed:** YYYY-MM-DD` line in the result file
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*)
- The task worktree and branch removed **after** that step and last of these four, per `./references/workflow/task-delivery-edges.md` § *Removal* — merged PR and clean tree, else refused with the reason. That step deletes scratch artifacts the **clean** predicate would read as dirty, and its boundary runs on the worktree removal takes away. This skill never commits, so the refusal is the usual outcome — recorded either way, never blocking the finalize — with `maintain`'s husk sweep collecting the worktree later. <!-- cold -->

In **both** branches, rewrite `## Current state` last of all — after the removal above, so `**Pointers:**` records whether the branch survived; at `in-review` its `**Next:**` names the awaited external verification; at `done` the block stays frozen as the final digest.

**Reaching `done` from `in-review` (a later re-run).** The procedure is `./references/workflow/implement-task-edges.md` § *Reaching done from in-review* — read it on a later run finalizing an `in-review` task. <!-- cold -->

## Don't Rationalize

The shared loop's *Don't Rationalize* list applies in full (`./references/workflow/execution-loop.md`). These are this skill's own:

- "I'll update the result file at the end" — Update it as you go. End-of-task batching loses the surprises and reasoning that are worth recording.
- "The worktree verify passed, merging is a formality" — A worktree executor's pass is provisional by contract. Integration is where parallel work breaks; the merge gates are the ones that count.
- "These steps look independent, I'll parallelize them without declarations" — Undeclared means serial. The `Touches:` declaration is the eligibility evidence, not paperwork.

### Red flags

The shared loop's red flags apply in full. When the domain is code, also watch the engineering red flags in `./references/engineering/execution.md` § *Red flags*.

## Verification

Confirm the protocol invariants before finishing:

- [ ] All four core artifacts read before starting (plus `ticket.md` when present); a missing `goals.md` surfaced, never invented
- [ ] Result file initialized and carrying every section its plan's state owes per `./references/workflow/task-lifecycle.md` § *Companion result file* — no `**Status:**` header of its own, `**Completed:**` line only at `done`
- [ ] `## Current state` rewritten at every plan status flip and once at run end (finalize included) — on its cited contract, never claiming a stronger state than the plan's `**Status:**`
- [ ] Any `**Pointers:**` commit watermark entry carried forward unchanged at every one of those rewrites — never advanced, never dropped, and never created here; seeding one is a reconciler's act (`./references/workflow/task-authorship.md`)
- [ ] Task branch and worktree created once at §3, re-entered from the recorded branch on a resume, and both removed at §8 — each on the terms those sections cite, never guessed between two folders and never forced, any degrade recorded
- [ ] Every completed step: its full unit-outcome tier passed on the evidence the intake accepted or re-proved (`./references/workflow/executor-contract.md` § *Write-mode routing*), that source named in its `**Verified:**` record, checkbox flipped with a link to its result section
- [ ] Integrated health established at every boundary the **Health boundaries** binding declares — each at the scope the domain recipe resolves, with a checkpoint or tail batch sharing that one boundary, a later finalization freshly recorded, and current against the final unchanged tree
- [ ] Every checkpoint ran its named assertions, recorded distinct `Asserted`, `Health`, and `Outcome` results, and passed before work continued
- [ ] The gate ran every goal by `G<n>` ID against live behavior and wrote `## Acceptance` — nothing left `unmet` at finalize, `pending external` only on `(external)` goals (parking the task at `in-review`)
- [ ] Deviations and plan revisions recorded in the result file; `goals.md` and `CONTEXT.md` never edited from this skill, and the repository's `AGENTS.md` / `CLAUDE.md` written only on the user's explicit confirmation and stated when written
- [ ] Domain pre-presentation checks run over the full changed surface; framework code grounded in `**Sources:**`, any ungrounded pattern stopped or recorded there. Presentation consumed health as `./references/workflow/execution-acceptance.md` § *Before presenting* fixes
- [ ] Every step delegated — through the mode's default launch or an announced parallel batch — with any inline step naming which of the three posture exceptions applied, and its `**Executed:**` field recording whatever deviated
- [ ] Every parallel-batch step merged only through §4's cited merge gates, conflicts and surface escapes falling back to serial delegation; no per-merge health run
- [ ] Executors wrote no task-folder file and no status; batches recorded (`**Executed:**` fields, checkpoint `**Merged:**` lines) and every coordinator-managed worktree removed after merge
