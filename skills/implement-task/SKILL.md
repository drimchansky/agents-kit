---
name: implement-task
description: Use when asked to implement, execute, run, or carry out a task's plan from a task folder (canonically under `.agents/tasks/`) — by task folder path, or the current task if one is already in context.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so.

Executes a plan written by `plan-task` — or any same-format `plan.md` in a task folder, canonically under `.agents/tasks/` though a folder anywhere on disk works the same. It implements the work, records it in a companion **result file** as it goes, marks each step done in the plan with a link to that record, and runs an **acceptance gate** against the goals before flipping the plan to `done`.

Plan = the contract for **how**. Goals = the contract for **what done means**. Result file = the **record**: a rewritable `## Current state` digest above an append-only log. `CONTEXT.md` = static grounding context. `ticket.md` = the product-facing ask the goals derive from.

## Inputs

All in the resolved task folder, all read before any work (§1):

- `ticket.md` — optional, read-only
- `CONTEXT.md` — read-only
- `goals.md` — read-only; the acceptance contract (§7)
- `plan.md` — the steps to execute
- `diagram.md` — optional; re-checked and repainted at the gates (§4)
- `result.md` — this run's record (§3, §5)

Read `./references/workflow/execution-loop.md` before working — the loop, its gates, its failure discipline, and this skill's parameters in its `implement-task` binding. Then the pack files Core Rules 2 calls for: `execution.md` (how to carry out a step), `verification.md` (what its gates run), and any per-surface checklist the work touches. For code that is `./references/engineering/`, where the checklists matter most because this skill produces the actual work product.

**CRITICAL**: This skill mutates the plan, the result file, and `diagram.md` when the task has one — never `CONTEXT.md`, `goals.md`, or `ticket.md`.

- The **plan** is mutated *only* to flip step checkboxes (`- [ ]` → `- [x]`), append result links, update `**Status:**`, and revise scope or steps (§6). Everything else about it stays as written.
- The **diagram** is mutated *only* by the §4 re-check at its three gates (§4, §6, §7) — repainted to match what shipped, never the plan's prose instead of reality — with `**Reflects:**` re-anchored and re-dated.
- The **result file** is the place for narrative: what shipped, what surprised you, what diverged.
- The **goals** are the user's contract. A goal that turns out wrong or missing is surfaced for the user to edit; a changed product ask is theirs to update in `ticket.md`. Never edit either from here.

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

**Read its `plan.md`** (one plan per folder). None → tell the user the folder exists but has no plan, and suggest `plan-task`.

**Then read every other input above, in full, before doing anything:**

- `goals.md` — defines the final gate. Missing → stop and tell the user; `plan-task` should produce one. Never invent goals to fill the gap.
- `CONTEXT.md` — problem statement, scope summary, key assumptions, external references; authoritative for the task's static context.
- `ticket.md` when present — the product-facing ask, read-only; the gate runs against `goals.md`, not the ticket.
- `diagram.md` when present — the target-state shape the plan builds toward; its absence is never a gap.
- `result.md` when it exists — work may have been partly done in a prior session: pick up where it left off, never redoing completed steps. Then branch on the plan's `**Status:**` (`./references/workflow/task-lifecycle.md`):
    - `blocked` → read the result's `**Blocked:**` section; resume only once the blocker has cleared, flipping both files back to `executing` first.
    - `in-review` → read the result's `**In review:**` section listing the pending `(external)` goals. Don't re-run the plan: take those goals alone through §7, against the external confirmation the user now provides, then §8.

### 2. Decide Execution Mode

Ask the user, or infer from the request:

- **Step-by-step** — one step, update both files, pause for the user to inspect or decide. Default for risky or large plans.
- **Full plan** — every step end-to-end, then one combined result (§5). Default for small plans (≤3 steps) or an explicit "just run the whole thing".

Both modes execute steps through the §4 delegation default; step-by-step simply pauses after each step's gates. The automatic parallel batch is full-plan only — a batch would collapse exactly the pause points step-by-step exists to give the user.

### 3. Initialize Execution State

Every status value and transition used here is registered in `./references/workflow/task-lifecycle.md`, the single source of truth; on any disagreement the registry wins.

Create `<task-dir>/result.md` when it doesn't already exist, with this header:

```markdown
# Result: <plan title>

**Plan:** [./plan.md](./plan.md)
**Goals:** [./goals.md](./goals.md)
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Started:** YYYY-MM-DD
**Status:** executing

## Current state
_Updated: YYYY-MM-DD_
- **Status:** executing — <one line: where things stand>
- **Pointers:** <branch `…`, PR #… (url), SHA …, ticket … — or "none yet">
- **Next:** <one line>

---
```

`## Current state` is derived header metadata on the contract in `./references/workflow/task-lifecycle.md`: rewritten **in place**, never appended to. Everything below its closing `---` is the append-only log. A pre-existing result file without the block gains one at this run's first write.

Then point the plan's `**Result:**` line at `./result.md` and flip its `**Status:**` from `to-do` to `executing` — a `**Status:**` change, so regenerate the store index (§8's walk-up rule).

**Reviving a `skipped` plan** — only after the explicit confirmation the *Skip when* gate requires.

**Check where the folder sits first.** A bare slug falls back to `Archive/<slug>/` (`./references/workflow/task-layout.md`) and skipped tasks are the ones that get archived, so a revive can land there — but a live task under `Archive/` is stranded outside every active listing `resume-task` and `review-task` build, and `archive-task` would refuse it as non-terminal. Resolved under `Archive/` → **stop**: have the user move it out (a manual `mv`; archiving is one-way), then re-run.

Otherwise flip `skipped → executing` (the registered revive edge) and continue as a normal run. An existing result file — the record of why the work was dropped — must be `executing`, the pairing rule's value for a live plan; any other value pairs as drift. That record stays: the append-only rule holds, and this run's sections append after it (§5).

### 4. Execute Steps

Run the loop in `./references/workflow/execution-loop.md` — the five beats, both verify gates, Stop-the-Line when either fails, the integration-gate discipline. Read it before starting.

**This skill's bindings:**

- **Source** — one unit is one plan step; its criterion is that step's plan-defined `Verify` line. Stay inside the plan's scope; respect `Depends on:` ordering in both modes.
- **Record** — append a result section (§5) as each step finishes.
- **Mark done** — flip `- [ ]` to `- [x]` for that step and append the result-section link:

    ```markdown
    - [x] **What:** <unchanged> ([result](./result.md#step-1--add-csv-writer))
    ```

- **Pause or continue** — step-by-step: stop after each step and report progress. Full-plan: continue.
- **Blocked** — a Stop-the-Line that can't clear this session: both files' `**Status:**` to `blocked`, a `**Blocked:**` section naming the cause (what failed, what was tried, what's needed — or what's awaited), `## Current state` rewritten naming the blocker, the store index regenerated (§8's walk-up rule), then stop — don't skip ahead (`./references/workflow/task-lifecycle.md`).
- **Integration gates** — the plan's `### Checkpoint after Step N` headings. Each is **mandatory** after marking step N done, not an optional summary; a checkpoint is not a step, carries no `- [ ]`, and is never flipped. Run its assertions per the shared loop, append a checkpoint section (§5), and in step-by-step mode pause as at a step boundary. With a `diagram.md`, it also runs the re-check below.

#### Diagram re-check (only when the task has a `diagram.md`)

Three points re-check it: **each checkpoint**, **each structural plan revision** (§6), **the acceptance gate** (§7). No diagram → skip all three, absence unreported (`./references/workflow/task-layout.md` § *The diagram file*).

Compare the drawing against what shipped and record *what was compared* — which nodes and edges, against which files; that record is what keeps the gate off rubber-stamping. Then:

- **Matches** → re-anchor and re-date `**Reflects:**`. No repaint, no render-check.
- **Diverged** → repaint to what shipped, render-check per the pack's diagram guidance (code: `./references/engineering/planning.md` § *The task diagram*, which owns the notation and the render-check), record the divergence and why in that step's or checkpoint's result section, then re-anchor and re-date the same way.

Either way `**Reflects:**` leaves anchored to the gate — `as of Step N` (the last step completed here) or `as of the acceptance gate` — dated today, replacing the plan-time `as of the plan`.

A divergence is usually information, not failure: the build revealed what the plan didn't anticipate, which is what §6 surfaces. Stop-the-Line only when the shipped structure contradicts a goal.

#### Execution strategy: delegated by default

Execute each step through an **executor** per `./references/workflow/executor-contract.md` and its `implement-task` binding — read both before the first step — on the native engine and adapter defaults in `./references/workflow/agent-fanout.md`.

Default to **serial delegation** because context economy compounds over a run: one executor per step, in plan order, editing the shared tree, launched with the self-contained packet that contract's *Launch packet* requires. While one is in flight the coordinator waits — no step of its own, no shared-tree edit — until it reports. Then re-run both gates on the tree yourself (its pass is advance evidence, not the gate) and record the step (§5).

**Inline fallback** when delegation clearly doesn't pay — a trivial step, mid-step user interaction, debugging-heavy work: announce it in chat and record it in `**Executed:**`. A failed or hung executor degrades the same way per that binding's **Fallback**: report it, run the step inline, continue.

#### Automatic parallel batch (full-plan mode)

Eligible independent steps run concurrently through the same contract and binding. Batch mechanics are not restated: worktree placement, the frozen shared tree, the merge gates, and cleanup are `./references/workflow/agent-fanout.md` § *Coordinator-side parallel batch*, run as written there. This section adds only eligibility, merge point, and record.

No flag: when a batch qualifies, launch it and **announce it in chat** — which steps, why eligible — so automatic parallelism is never silent. The contract's invariants hold: the coordinator owns the shared tree, both task files, and every status; executors never touch the task folder.

**Eligibility.** Every condition in the cited section applies as written, its when-in-doubt-run-serially default included. This skill adds:

- the steps sit in the same checkpoint-bounded batch (between the last checkpoint and the next);
- each declares its surface as a `**Touches:**` line — the declared surface the cited disjointness test and surface check read; `Depends on:` is the dependency path they read.

No `**Touches:**` line (or `**Touches:** none`) → serially-delegated.

**Run** per the cited *Run* rules. In a mixed batch, serial steps depending on a batch step — directly or transitively — run after the merge on the integrated tree; every other serial step runs before launch; both in plan order.

**Merge at the batch's bounding checkpoint** — the cited four gates, per batch step, **in plan order**, plan order being this skill's declared unit order. Their fourth gate, **Record**, resolves to: flip the checkbox, append the result section with its `**Executed:**` field (§5), as in serial execution.

Run the checkpoint's assertions only once every batch step has executed — merged or fallen back to serial — and every post-merge serial step has run. The checkpoint is the batch's integration gate; failure there is Stop-the-Line on the integrated tree. With no checkpoint after the batch, merge at its natural bound — before the first dependent serial step, or before the acceptance gate for the plan's tail — where each step's integrated re-verify plus §7's goal verification and §8's pre-presentation checks serve as the gate. Don't invent an implicit checkpoint.

### 5. Result File: Per-Step Section Template

```markdown
## Step N — <step title>

**Verified:** <how the step's verify criterion was satisfied — command output, test name that passed, behavior observed>

**Shipped:**

- <file:line or path> — <what changed>
- <file:line or path> — <what changed>

**Sources:** <official-doc URLs / deep links grounding any framework-specific code in this step, plus any pattern shipped without an authoritative source and why; otherwise omit>

**Executed:** <only when execution deviated from the default serial delegation — "parallel batch (<executor engine>), merged in plan order at/before <the §4 merge point>", or "inline (<reason>)"; omit for serially-delegated steps>

**Deviations from plan:** <if any — what differed and why; otherwise omit>

**Notes:** <surprises, gotchas, follow-ups, anything important; otherwise omit>

---
```

For full-plan mode, write **one combined section** instead — no per-step blocks:

```markdown
## Full Run — <date>

**Verified:** <summary of every step's verify result, or "all step verify criteria passed">

**Shipped:**

- <bulleted list of every notable change across all steps>

**Sources:** <as above, across all steps; otherwise omit>

**Executed:** <only when a folded step deviated from serial delegation — "Step N inline (<reason>)" per such step; omit otherwise>

**Deviations from plan:** <if any>

**Notes:** <surprises, gotchas, follow-ups>

---
```

In full-plan mode, still flip every step's `- [ ]` to `- [x]`, each linking to the same `#full-run--<date>` anchor (note the double hyphen — the em-dash in the header drops out and both surrounding spaces become hyphens).

Merged parallel-batch steps are the exception on both counts: each keeps its own per-step section — its merge gates and `**Executed:**` record are per-step — and its checkbox links there instead of the `#full-run` anchor. Only the batch's serially-executed steps fold into the combined block.

**Checkpoint section template:**

```markdown
## Checkpoint after Step N

**Asserted:** <which assertions ran — test command, build command, e2e flow exercised>
**Outcome:** passed
**Merged:** <parallel-batch steps merged at this gate in plan order — e.g. "Steps 3, 4 from the parallel batch"; omit when no batch>
**Notes:** <surprises, near-misses, anything important; otherwise omit>

---
```

A failed checkpoint records `**Outcome:** failed` with the failure details, then follows Stop-the-Line. Do not move on.

**After appending any section** — step, full-run, or checkpoint — rewrite `## Current state` to match on its cited contract: `_Updated:_` refreshed, status gloss, `**Pointers:**` (the branch/PR/SHA/ticket currently in play), `**Next:**`, superseded detail dropped. **When a step records a decision**, append a dated one-liner to the result's `## Decision log`, creating it directly below `## Current state`'s closing `---` when absent, as the first section of the append-only log:

```markdown
- YYYY-MM-DD — <decision> (→ <result anchor / CONTEXT section / plan step / DECISIONS.md #N>)
```

A pointer to where the decision is recorded, never the decision text itself (`./references/workflow/task-lifecycle.md`).

### 6. Plan Revisions Mid-Execution

When implementation reveals the plan is wrong — a step infeasible, scope wrong, a new step needed, or a step too large to land in one slice — apply the scope-change rules in `./references/workflow/execution-loop.md` § *Scope changes mid-execution*, including its splitting strategies. Binding for what surfacing and recording mean against a plan:

- **Update the plan in place** — revise the affected step or scope, add new steps, remove obsolete ones. Keep step numbers stable where possible (insert as `Step 3a`, `Step 3b` rather than renumbering).
- **Record the divergence** under the affected step's `**Deviations from plan:**` field, including *why* the plan changed.
- **Repaint the diagram when the revision changes structure** (only when the task has one), at the revision rather than deferred to the next checkpoint — the revision is the causal event, and in step-by-step mode it is where the user inspects. Same in both modes; run it per the §4 re-check.
- In step-by-step mode, pause and confirm the revision with the user before continuing.
- **If the right call is to abandon the task** rather than revise it, surface that and get explicit confirmation first — this skill never sets `skipped` on its own (`./references/workflow/task-lifecycle.md`). On confirmation set the plan's `**Status:**` to `skipped`, record why in the result file, and stop — don't delete the plan or leave it dangling in `executing`.

### 7. Acceptance Gate

After the last step is marked done but **before** flipping either file's `**Status:**` to `done`, run the acceptance gate against `goals.md`, applying the acceptance discipline in `./references/workflow/execution-loop.md`. Binding: the criteria are `goals.md`'s `G<n>` goals, and the verdict goes in an `## Acceptance` section of the result file.

With a `diagram.md`, run the §4 re-check once more here. The gate is where the drawing stops being a target and becomes the **as-built record**, so it is verified against the real tree like any other criterion, and the run ends with `**Reflects:**` naming the acceptance gate and the date.

**Tag each goal** by its `G<n>` ID: `met`, `met with caveats`, `unmet`, `out of scope`, or `pending external`.

- `out of scope` **only when the plan's `## Scope` lists that goal ID in its deferred partition** — confirm the ID is actually there. One you'd call out-of-scope that isn't in the deferred set drifted in after the plan was written: surface it rather than silently dropping it under a label the scope never authorized.
- `pending external` **only for a goal carrying the `(external)` marker** whose verification you genuinely can't perform in-session (a human/client sign-off, a live/production state you can't drive) — record what's awaited and who/what will verify it. Never a substitute for `unmet`: if the agent-verifiable work behind the goal isn't done, it's `unmet`.

Append a single `## Acceptance` section to the result file:

```markdown
## Acceptance

**Verified against:** [./goals.md](./goals.md)

- G1 — met (verified by <command / behavior observed>)
- G2 — met with caveats (<what's caveated and why>)
- G3 — unmet (<what's missing, what's needed to close the gap>)
- G4 — out of scope (excluded by plan scope, user-acknowledged)
- G5 — pending external (awaiting <what>, verified by <who/how>)

---
```

**Any goal `unmet` → do not finalize.** Apply Stop-the-Line: localize the gap, then decide whether it's a missed step (revise the plan, add steps, return to execution) or a goals misunderstanding (surface it, let the user edit the goals file, re-run the gate).

**Any goal `met with caveats` → secure explicit user acknowledgement before finalizing.** Surface each caveat — what's caveated and why — confirm the user accepts shipping with it (the provenance `out of scope` carries at tag time), and record the acknowledgement in that goal's `## Acceptance` entry. An unacknowledged `met with caveats` is not a pass: treat it like `unmet` and do not finalize.

**Any goal `pending external` → do not finalize to `done`; park at `in-review`.** Every *other* goal must be `met` / acknowledged-caveat / out-of-scope first. Then take §8's `in-review` branch.

### 8. Finalize

The gate produces one of two session-terminal outcomes. "Acknowledged" below means the §7 acknowledgement for every `met with caveats` and `out of scope` goal.

**Park at `in-review`** when every agent-verifiable goal is `met` or acknowledged **but one or more `(external)` goals are `pending external`**:

- Both the plan's and the result file's `**Status:**` to `in-review`
- An `**In review:**` section in the result file listing each pending goal — `- G<n> — <what's awaited, who/what verifies it>` — and **no** `**Completed:**` line
- The shared loop's *Before presenting* step (`./references/workflow/execution-loop.md`); its summary additionally names which agent-verifiable goals are `met`, and exactly what external verification is outstanding and how to confirm it

**Finalize to `done`** only once every goal is `met` or acknowledged **and none is `pending external`**:

- The plan's `**Status:**` to `done`
- The result file's `**Status:**` to `done`, plus a closing `**Completed:** YYYY-MM-DD` line
- The shared loop's *Before presenting* step — the domain's pre-presentation checks over the full changed surface, then the summary of what shipped, acceptance results, deviations, and open follow-ups

In **both** branches, rewrite `## Current state` last — at `in-review` its `**Next:**` names the awaited external verification; at `done` the block stays frozen as the final digest. Then regenerate the store index when the store has one: walk up from the task folder for `scripts/generate-index.mjs`; run `node <that-root>/scripts/generate-index.mjs`; skip silently when the script or `node` is absent (`./references/workflow/task-layout.md` § *Store-level artifacts*).

**Reaching `done` from `in-review` (a later re-run).** When the user reports the external verification happened — a confirmation, a receipt, the observed live state — re-run the gate on each `pending external` goal against that **best-available proxy** (`./references/workflow/acceptance-criteria.md`): the user-reported confirmation *is* the sanctioned evidence for an `(external)` goal. Update its `## Acceptance` line to `met`, noting the proxy, then finalize to `done` as above, adding the `**Completed:**` line. If review instead surfaced problems, flip both files back to `executing` and resume — don't force `done`.

## Don't Rationalize

The shared loop's *Don't Rationalize* list applies in full (`./references/workflow/execution-loop.md`). These are this skill's own:

- "I'll update the result file at the end" — Update it as you go. End-of-task batching loses the surprises and reasoning that are worth recording.
- "The worktree verify passed, merging is a formality" — The executor's pass is provisional by contract. Integration is where parallel work breaks; the merge gates are the ones that count.
- "These steps look independent, I'll parallelize them without declarations" — Undeclared means serial. The `Touches:` declaration is the eligibility evidence, not paperwork.
- "Delegating this step is overhead, I'll just do it myself" — The default is delegation because context economy compounds over the run. Inline is the contract's named exception — announced and recorded — not a quiet drift back to doing everything in-session.

### Red flags

The shared loop's red flags apply in full. When the domain is code, also watch the engineering red flags in `./references/engineering/execution.md` § *Red flags*.

## Verification

Confirm the protocol invariants before finishing:

- [ ] All four core artifacts read before starting (plus `ticket.md` when present); a missing `goals.md` surfaced, never invented
- [ ] Result file initialized and kept paired with the plan per `./references/workflow/task-lifecycle.md` — statuses flip together, `**Completed:**` line only at `done`
- [ ] `## Current state` rewritten at every status flip, after every appended section, and at finalize — on its cited contract, never claiming a stronger state than `**Status:**`
- [ ] Every completed step: its plan-defined `Verify` criterion actually run and passed, health verify green, checkbox flipped with a link to its result section
- [ ] Every checkpoint run and recorded; no step started over a failing gate
- [ ] The gate ran every goal by `G<n>` ID against live behavior and wrote `## Acceptance` — nothing left `unmet` at finalize, `pending external` only on `(external)` goals (parking the task at `in-review`)
- [ ] With a `diagram.md`: re-checked at every checkpoint, every structural revision, and the gate — each re-check naming what was compared, each repaint render-checked, `**Reflects:**` re-anchored and re-dated
- [ ] Deviations and plan revisions recorded in the result file; `goals.md` and `CONTEXT.md` never edited from this skill
- [ ] Domain pre-presentation checks re-run on the full changed surface (for code: typecheck, linter, tests, consumer grep; framework code grounded in `**Sources:**`, any ungrounded pattern stopped or recorded there)
- [ ] Every step executed through the delegation default — a serial executor with the coordinator's re-run gates, an announced parallel batch, or an announced inline fallback recorded in its `**Executed:**` field
- [ ] Every parallel-batch step merged only through §4's cited merge gates — surface check, conflict-free merge, integrated re-verify, the batch's checkpoint (or the §7/§8 tail gate) — conflicts and surface escapes falling back to serial delegation
- [ ] Executors wrote no task-folder file and no status; batches recorded (`**Executed:**` fields, checkpoint `**Merged:**` lines) and worktrees removed after merge
