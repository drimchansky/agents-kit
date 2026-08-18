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

Read `./references/workflow/execution-loop.md` before working — the loop, its two verification tiers, its failure discipline, and the six parameters this skill binds — five in §4 below, **Acceptance** at the §7 gate — stated here in full, so this skill needs nothing from the cross-consumer index. Then the pack files Core Rules 2 calls for: `execution.md` (how to carry out a step), `verification.md` (what its two tiers run), and any per-surface checklist the work touches. For code that is `./references/engineering/`, where the checklists matter most because this skill produces the actual work product.

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
    - `in-review` → read the result's `**In review:**` section listing the pending `(external)` goals. Don't re-run the plan: take those goals alone through §7, against the external confirmation the user now provides, then §8, whose later-run finalization runs a fresh health boundary before `done`.

### 2. Decide Execution Mode

Ask the user, or infer from the request:

- **Step-by-step** — one step, update both files, pause for the user to inspect or decide. Default for risky or large plans.
- **Full plan** — every step end-to-end, then one combined result (§5). Default for small plans (≤3 steps) or an explicit "just run the whole thing".

Both modes execute steps through the §4 delegation default; step-by-step simply pauses after each step's unit outcome and the health boundary that pause carries (§4). The automatic parallel batch is full-plan only — a batch would collapse exactly the pause points step-by-step exists to give the user.

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

`## Current state` is derived header metadata on the contract in `./references/workflow/task-authorship.md`: rewritten **in place**, never appended to. Everything below its closing `---` is the append-only log.

Then point the plan's `**Result:**` line at `./result.md` and flip its `**Status:**` from `to-do` to `executing`.

**Reviving a `skipped` plan** — only after the explicit confirmation the *Skip when* gate requires.

The archive-location check and the revive procedure are `./references/workflow/implement-task-edges.md` § *Reviving a skipped plan* — read them at a revive. <!-- cold -->

### 4. Execute Steps

Run the loop in `./references/workflow/execution-loop.md` — the five beats, its two verification tiers, Stop-the-Line when required evidence fails, the assertion-gate discipline. Read it before starting.

**This skill's bindings:**

- **Source** — one unit is one plan step; its criterion is that step's plan-defined `Verify` line. Stay inside the plan's scope; respect `Depends on:` ordering in both modes.
- **Record** — append a result section (§5) once the step's outcome and, where the step carries one, its health boundary have run.
- **Mark done** — flip `- [ ]` to `- [x]` for that step and append the result-section link:

    ```markdown
    - [x] **What:** <unchanged> ([result](./result.md#step-1--add-csv-writer))
    ```

- **Pause or continue** — step-by-step: stop after each step and report progress. Full-plan: continue.
- **Blocked** — a Stop-the-Line that can't clear this session: both files' `**Status:**` to `blocked`, a `**Blocked:**` section naming the cause (what failed, what was tried, what's needed — or what's awaited) and the last health boundary that passed with what it covered (or `none`, so a run that stops before its first boundary says so rather than leaving it unrecorded), `## Current state` rewritten naming the blocker, then stop — don't skip ahead (`./references/workflow/task-lifecycle.md`).
- **Health boundaries** — every step-by-step pause before the user receives the tree; every authored checkpoint after its named assertions; each natural batch bound before dependent work; the full-plan tail before acceptance; and every later-run `in-review → done` finalization after the pending external goals are re-checked and before status advances. A batch bounded by a checkpoint shares that checkpoint's one health pass, and a tail batch shares the full-plan tail — neither adds another. At a step-by-step pause the boundary runs after the step's outcome proof and **before** its result section is appended, so the section records a result that exists — the order the **Integration assertions** binding below already gives a checkpoint. Between boundaries, a step proves its own outcome tier (`./references/workflow/execution-loop.md` § *Two verification tiers*) and no more; the integrated recipe (`./references/engineering/verification.md` for code) runs at these declared places rather than between them, so a full-plan run over a checkpoint-free plan establishes health once, at the tail. The later finalization is a fresh boundary under the shared loop's cross-run identity rule; record a successful result in §8's dated section. If it fails, take both files through the registered `in-review → executing` edge before this binding's existing **Blocked** behavior.
- **Integration assertions** — the plan's `### Checkpoint after Step N` headings. Each is **mandatory** after marking step N done, not an optional summary; a checkpoint is not a step, carries no `- [ ]`, and is never flipped. Run its assertions per the shared loop, then its health boundary, append a checkpoint section (§5), and in step-by-step mode pause as at a step boundary. With a `diagram.md`, it also runs the re-check below.

#### Diagram re-check (only when the task has a `diagram.md`)

No diagram → skip every re-check, absence unreported. With one, the three re-check gates, the comparison-and-repaint procedure, and the `**Reflects:**` re-anchor are `./references/workflow/implement-task-edges.md` § *Diagram re-check* — read it when the task has a `diagram.md`. <!-- cold -->

#### Execution strategy: delegated by default

Execute each step through an **executor** per `./references/workflow/executor-contract.md` and its `implement-task` binding — read both before the first step — on the native engine and adapter defaults in `./references/workflow/agent-fanout.md`.

Default to **serial delegation** because context economy compounds over a run: one executor per step, in plan order, editing the shared tree, launched with the self-contained packet that contract's *Launch packet* requires. While one is in flight the coordinator waits — no step of its own, no shared-tree edit — until it reports. Then the coordinator re-proves the step's full outcome tier on the tree (`./references/workflow/execution-loop.md` § *Two verification tiers*), the executor having run the criterion alone (its pass is advance evidence, never the gate), and records the step (§5); integrated health is not owed here, only at the boundaries the binding declares.

**Inline fallback** when delegation clearly doesn't pay — a trivial step, mid-step user interaction, debugging-heavy work: announce it in chat and record it in `**Executed:**`. A failed or hung executor degrades the same way per that binding's **Fallback**: report it, run the step inline, continue.

#### Automatic parallel batch (full-plan mode)

Eligible independent steps run concurrently through the same contract and binding. Eligibility, launch, merge, and the checkpoint hand-off are `./references/workflow/implement-task-edges.md` § *Automatic parallel batch* — read it when steps declare `**Touches:**` surfaces in full-plan mode and a batch may qualify. No `**Touches:**` line (or `**Touches:** none`) → serially-delegated. <!-- cold -->

### 5. Result File: Per-Step Section Template

```markdown
## Step N — <step title>

**Verified:** <how the step's full outcome tier was satisfied — the `Verify` criterion's evidence (command output, test that passed, behavior observed) plus the per-unit checks the domain adds>

**Health:** <the integrated health recipe result at the boundary this step ended on; omit for a merged parallel-batch step and for one that ended at an authored checkpoint, whose section carries it instead>

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

**Verified:** <summary of every step's outcome tier, or "every step's outcome tier passed" — never the criteria alone>

**Health:** <the full-plan tail boundary's integrated health recipe result on the final tree, plus any mid-run boundary that ran, named with the point it bounded>

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

**Asserted:** <which named assertions ran — e.g. the e2e flow exercised>
**Health:** <the one integrated health recipe result on the tree this checkpoint bounds, including any batch it bounds>
**Outcome:** passed
**Merged:** <parallel-batch steps merged at this gate in plan order — e.g. "Steps 3, 4 from the parallel batch"; omit when no batch>
**Notes:** <surprises, near-misses, anything important; otherwise omit>

---
```

A failed checkpoint records the `**Asserted:**` and `**Health:**` results that ran (or `not run`), `**Outcome:** failed`, and the failure details, then follows Stop-the-Line. Do not move on.

**After appending any section** — step, full-run, checkpoint, or health boundary — rewrite `## Current state` to match on its cited contract: `_Updated:_` refreshed, status gloss, `**Pointers:**` (the branch/PR/SHA/ticket currently in play), `**Next:**`, superseded detail dropped. **When a step records a decision**, append a dated one-liner to the result's `## Decision log`, creating it directly below `## Current state`'s closing `---` when absent, as the first section of the append-only log:

```markdown
- YYYY-MM-DD — <decision> (→ <result anchor / CONTEXT section / plan step / DECISIONS.md #N>)
```

A pointer to where the decision is recorded, never the decision text itself (`./references/workflow/task-authorship.md`).

### 6. Plan Revisions Mid-Execution

When implementation reveals the plan is wrong — a step infeasible, scope wrong, a new step needed, or a step too large to land in one slice — apply the scope-change rules in `./references/workflow/execution-recovery.md` § *Scope changes mid-execution*, including its splitting strategies. Binding for what surfacing and recording mean against a plan: <!-- cold -->

The binding — the in-place plan update, the `**Deviations from plan:**` record, the structural repaint, the step-by-step pause, and the abandon flow — is `./references/workflow/implement-task-edges.md` § *Plan revisions* — read it when a revision is needed. <!-- cold -->

### 7. Acceptance Gate

After the last step is marked done but **before** flipping either file's `**Status:**` to `done`, run the acceptance gate against `goals.md`, applying the acceptance discipline in `./references/workflow/execution-acceptance.md`. Binding: the criteria are `goals.md`'s `G<n>` goals, and the verdict goes in an `## Acceptance` section of the result file.

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
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*); its summary additionally names which agent-verifiable goals are `met`, and exactly what external verification is outstanding and how to confirm it

**Finalize to `done`** only once every goal is `met` or acknowledged **and none is `pending external`**:

- The plan's `**Status:**` to `done`
- The result file's `**Status:**` to `done`, plus a closing `**Completed:** YYYY-MM-DD` line
- The shared loop's *Before presenting* step (`./references/workflow/execution-acceptance.md` § *Before presenting*)

In **both** branches, rewrite `## Current state` last — at `in-review` its `**Next:**` names the awaited external verification; at `done` the block stays frozen as the final digest.

**Reaching `done` from `in-review` (a later re-run).** The procedure is `./references/workflow/implement-task-edges.md` § *Reaching done from in-review* — read it on a later run finalizing an `in-review` task. <!-- cold -->

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
- [ ] Every completed step: its full unit-outcome tier actually run and passed — the plan-defined `Verify` criterion plus the per-unit checks the resolved domain's `verification.md` adds — checkbox flipped with a link to its result section
- [ ] Integrated health established at every boundary the **Health boundaries** binding declares — with a checkpoint or tail batch sharing that one boundary, a later finalization freshly recorded, and current against the final unchanged tree
- [ ] Every checkpoint ran its named assertions, recorded distinct `Asserted`, `Health`, and `Outcome` results, and passed before work continued
- [ ] The gate ran every goal by `G<n>` ID against live behavior and wrote `## Acceptance` — nothing left `unmet` at finalize, `pending external` only on `(external)` goals (parking the task at `in-review`)
- [ ] With a `diagram.md`: re-checked at every checkpoint, every structural revision, and the gate — each re-check naming what was compared, each repaint render-checked, `**Reflects:**` re-anchored and re-dated
- [ ] Deviations and plan revisions recorded in the result file; `goals.md` and `CONTEXT.md` never edited from this skill
- [ ] Domain pre-presentation checks run over the full changed surface; framework code grounded in `**Sources:**`, any ungrounded pattern stopped or recorded there. Health is consumed from the final current boundary rather than re-run for presentation's sake
- [ ] Every step executed through the delegation default — a serial executor with the coordinator's re-proved outcome, an announced parallel batch, or an announced inline fallback recorded in its `**Executed:**` field
- [ ] Every parallel-batch step merged only through §4's cited merge gates, conflicts and surface escapes falling back to serial delegation; no per-merge health run
- [ ] Executors wrote no task-folder file and no status; batches recorded (`**Executed:**` fields, checkpoint `**Merged:**` lines) and worktrees removed after merge
