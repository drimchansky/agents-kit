---
name: implement-task
description: Use when asked to implement, execute, run, or carry out a task's plan from a task folder (canonically under `.agents/tasks/`) — by task folder path, or the current task if one is already in context.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`execution.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill executes a plan written by `plan-task` (or any `plan.md` in a task folder — canonically under `.agents/tasks/`, though a task folder anywhere on disk works the same — that follows the same format). It implements the work, updates a companion **result file** as it goes, marks each step `DONE` in the plan with a link back to the result section, and runs a final **acceptance gate** against the goals before flipping the plan to `done`.

The plan is the **contract for how**; the goals are the **contract for what done means**; the result file is the **record** — a rewritable `## Current state` digest above an append-only log; `CONTEXT.md` is the **static grounding context** for the task; the optional `ticket.md` is the **product-facing ask** the goals derive from. They live side by side in the resolved task folder:

- Ticket: `ticket.md` (optional; read-only for this skill)
- Context: `CONTEXT.md` (read-only for this skill)
- Goals: `goals.md` (read-only for this skill)
- Plan: `plan.md`
- Result: `result.md`

**CRITICAL**: The plan and result files are mutated by this skill; `CONTEXT.md`, the goals, and the ticket are not. The plan is mutated _only_ to flip step checkboxes (`- [ ]` → `- [x]`), append result links, update the `Status:` header, and (when necessary) revise scope or steps. Everything else about the plan stays as written. The result file is the place for narrative — what shipped, what surprised you, what diverged. The goals file is the user's contract; if it needs to change, surface that to the user — never edit it from this skill.

## References

Before working, read `./references/workflow/execution-loop.md` — the loop, its gates, and its failure discipline, with this skill's parameters in its `implement-task` binding. Then load the resolved domain's pack and read the files this skill leans on — `execution.md` (how to carry out a step) and `verification.md` (what its gates run) — plus any per-surface checklists that apply. When the domain is code, that's `./references/engineering/`, and the checklists matter most here since this is the skill that produces the actual work product. If the domain has no pack, run the neutral loop and say so. See `./references/workflow/domain-packs.md`.

## When to Use

**Use when:**

- The user asks to implement, execute, run, or carry out a task or its plan
- The user points at a task folder (e.g. `.agents/tasks/add-csv-export/`) or its `plan.md`
- A task is already established in this session and the user wants to start (or resume) executing it
- A plan exists in a task folder and the user wants to start (or resume) work on it

**Skip when:**

- No task folder exists yet — direct the user to `plan-task` first
- The work is small enough that a plan would be overhead — use `implement`, which runs the same loop against an ask framed in the session
- The plan is still being iterated on and not yet finalized
- The plan's `**Status:**` is `skipped` — it was deliberately abandoned. Confirm the user wants to revive it before executing; don't silently run an abandoned plan. On confirmation, §3 takes the registered `skipped → executing` revive (`./references/workflow/task-lifecycle.md`).

If the user describes a task without a plan, suggest `plan-task` first when the task is non-trivial, and `implement` when it isn't.

## Process

### 0. Prepare Against Authoritative Sources

Establish ground truth before doing the work, per `./references/workflow/execution-loop.md` § *Ground truth before work* — the resolved domain's `execution.md` carries the recipe. This is the skill that produces the actual work product, so working from stale or invented facts is the biggest failure mode.

This skill's binding for the sources you find: record them in the result file's `**Sources:**` field (§5), not in code comments.

### 1. Locate and Load the Task

Discovery resolves a task folder, then reads its `plan.md`.

**Resolve the task folder** per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` — cite it, don't restate it; a full `plan.md` path is taken directly.

**Read the plan** — once the folder is resolved, read its `plan.md` (one plan per folder). If the folder has no `plan.md`, tell the user the folder exists but has no plan; suggest `plan-task` to create one.

Read **all four core artifacts** — plus the optional `ticket.md` when present — before doing anything:

- The plan in full.
- The sibling `goals.md` — the goals define the final gate this skill runs before marking the plan `done`. If the goals file is missing, stop and tell the user — `plan-task` should produce one. Do not invent goals to fill the gap.
- The sibling `CONTEXT.md` — problem statement, scope summary, key assumptions, external references. Authoritative for the task's static context; never modify it from this skill.
- The sibling `ticket.md` when present — the product-facing ask the goals derive from; read-only context (the acceptance gate runs against `goals.md`, not the ticket).
- The companion `result.md` if it exists — work may have been partially done in a prior session. Pick up where it left off; do not redo completed steps. If the plan is `blocked`, read the result file's `**Blocked:**` section and resume only once the blocker has cleared — then flip both plan and result back to `executing` before continuing. If the plan is `in-review`, read the result file's `**In review:**` section — it lists the pending `(external)` goals; don't re-run the whole plan, jump to the acceptance gate (§7) for just those goals against the external confirmation the user now provides, then finalize per §8 (to `done` if confirmed, or back to `executing` if review sent work back). See `./references/workflow/task-lifecycle.md`.

Treat the goals, `CONTEXT.md`, and `ticket.md` as read-only. If implementation reveals a goal is wrong or missing, surface it to the user and let them edit the goals file — don't edit it from here; likewise a changed product ask is the user's to update in the ticket.

### 2. Decide Execution Mode

Ask the user (or infer from the request):

- **Step-by-step** — Execute one step, update both files, pause for the user to inspect or decide before continuing. Default for risky / large plans.
- **Full plan** — Execute every step end-to-end, then write a single combined result. Default for small plans (≤3 steps) or when the user explicitly asks to "just run the whole thing."

Respect step `Depends on:` ordering regardless of mode.

Both modes execute steps through the delegation default (§4) — step-by-step simply pauses after each step's gates. The automatic parallel batch applies only in full-plan mode: step-by-step's per-step pause is the opposite contract — the user inspects between steps, and a batch would collapse those pause points into the checkpoint.

### 3. Initialize Execution State

Status values used in this skill and their transitions are registered in `./references/workflow/task-lifecycle.md` — the single source of truth. If anything here disagrees with the registry, the registry wins.

Create `<task-dir>/result.md` (when it doesn't already exist) with this header:

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

The `## Current state` block is derived header metadata (contract in `./references/workflow/task-lifecycle.md`): ≤1 KB, rewritten **in place** as work progresses — never appended to — and never claiming a stronger lifecycle state than the `**Status:**` header. Everything below its closing `---` is the append-only log. A pre-existing result file without the block gains one at this run's first write.

Update the plan's `**Result:**` line to link to this file (`./result.md`), and flip the plan's `**Status:**` from `to-do` to `executing` to mark that work has begun — then, since this is a `**Status:**` change, regenerate the store index if the store has one (the §8 walk-up rule).

**Reviving a `skipped` plan** — only after the explicit confirmation the *Skip when* gate requires.

First check **where the folder sits**. A bare slug falls back to `.agents/tasks/Archive/<slug>/` when no active folder matches (`./references/workflow/task-layout.md`), and skipped tasks are exactly the ones that get archived — so a revive can land inside `Archive/`. A live task must never sit there: archived folders are absent from every active listing, so the revived task would be stranded outside the lists `resume-task` and `review-task` build, and `archive-task` would refuse it as non-terminal though it already sits in the archive. If the resolved folder is under `Archive/`, **stop**: tell the user to move it back out first (a manual `mv` — `archive-task` is one-way), then re-run.

Otherwise flip the plan's `**Status:**` from `skipped` to `executing` (the registered revive edge) and continue as a normal run. If the plan's optional result file already exists — the record of why the work was dropped — ensure its `**Status:**` is `executing`, the pairing rule's value for a live plan (the result has no `to-do` state); a result left in any other state would pair with the revived plan as drift. The append-only rule holds, so that record stays and this run's sections append after it (§5).

### 4. Execute Steps

Run the loop in `./references/workflow/execution-loop.md` — the five beats, both verify gates, Stop-the-Line when either fails, and the integration-gate discipline — with this skill's parameters as its `implement-task` binding states them. Read it before starting.

What this skill binds:

- **Source** — one unit is one plan step; its verify criterion is the step's plan-defined `Verify` line. Stay inside the plan's defined scope, and respect step `Depends on:` ordering regardless of execution mode.
- **Record** — append a section to the result file (§5) as each step finishes.
- **Mark done** — flip `- [ ]` to `- [x]` for that step and append the result-section link:

    ```markdown
    - [x] **What:** <unchanged> ([result](./result.md#step-1--add-csv-writer))
    ```

- **Pause or continue** — in step-by-step mode, stop after each step and report progress; in full-plan mode, continue to the next.
- **Blocked** — when Stop-the-Line can't be cleared this session, set the plan and result `**Status:**` to `blocked`, add a `**Blocked:**` section to the result file naming the cause (what failed, what was tried, and what's needed — or what's awaited), and rewrite `## Current state` naming the blocker. Then stop; don't skip ahead — but regenerate the store index if the store has one (the §8 walk-up rule). See `./references/workflow/task-lifecycle.md`.
- **Integration gates** — the plan's `### Checkpoint after Step N` headings between step blocks, each a **mandatory gate** after marking step N done, not an optional summary. A checkpoint is not a step, has no `- [ ]` marker, and is never flipped. Run its assertions per the shared loop, append a checkpoint section to the result file (§5), and in step-by-step mode pause there just as at a step boundary.

#### Execution strategy: delegated by default

Execute each step through an **executor** per the write-mode contract in `./references/workflow/agent-fanout.md` — read it before the first step. The default is the contract's **serial shape**: one executor per step, in plan order, editing the shared tree, launched with a self-contained prompt (the step's What/Verify text, the goals it cites, the edit surface, the relevant `CONTEXT.md` excerpts, absolute paths) on the contract's executor-model default. After the executor reports, re-run both verify gates on the tree yourself — the executor's pass is advance evidence, not the gate — then record the step (§5).

Take the contract's **inline fallback** when delegation clearly doesn't pay (a trivial step, mid-step user interaction, debugging-heavy work) — announce it in chat and record it in the step's `**Executed:**` field. A failed or hung executor degrades the same way: report it, execute the step inline, continue.

The strategy is the same in both execution modes; step-by-step pauses after each step's gates, exactly as before.

#### Automatic parallel batch (full-plan mode)

In full-plan mode, execute eligible independent steps concurrently per the contract's parallel shape in `./references/workflow/agent-fanout.md`. No flag is involved: when a batch qualifies under the eligibility below, launch it and **announce it in chat** — which steps, and why they're eligible — so automatic parallelism is never silent. The contract's invariants hold throughout: the coordinator (this session) owns the shared tree, both task files, and every status; executors never touch the task folder, and parallel executors never touch the shared tree.

**Eligibility — mechanical, all conditions required.** Steps may share a batch only when:

- they sit in the same checkpoint-bounded batch (between the last checkpoint and the next);
- no `Depends on:` path connects them, directly or transitively;
- each declares a `**Touches:**` surface and the declared sets are pairwise disjoint — the core rule "do not parallelize sequential edits to the same artifact" (CORE_RULES.md), made checkable;
- each step's `Verify` can run in an isolated copy.

A step with no `**Touches:**` line (or with `**Touches:** none`) runs serially-delegated — an absent declaration is a serial default, not an invitation to infer one. When in doubt about disjointness, run the doubtful step serially: a wrongly-serial step costs minutes, a wrongly-parallel one costs the merge.

**Run.** In a mixed batch, serial steps that depend on a batch step — directly or transitively — run after the merge, on the integrated tree; every other serial step runs before the batch launches; both in plan order. Launch one executor per eligible step, each with a self-contained prompt per the contract, on the contract's executor-model default — a pinned tier where the host supports one (`./references/workflow/agent-fanout.md` § *Write-mode engines*). While a batch is in flight the shared tree is frozen: the coordinator monitors and runs no step of its own.

**Merge — at the batch's bounding checkpoint, in plan order.** For each batch step, in plan order:

1. **Surface check** — confirm the worktree diff stays inside the step's declared `**Touches:**` surface. A violation is the contract's surface-escape case: discard that worktree and re-execute the step through serial delegation.
2. **Merge** the worktree into the shared tree. A conflict means the disjointness claim was wrong: discard that worktree and re-execute the step through serial delegation on the integrated tree. Never resolve a batch conflict by hand-editing inside a worktree.
3. **Re-verify on the integrated tree** — the step's `Verify` plus health verify, the same two gates as serial execution. Executor-reported success is provisional; these gates are the ones that count.
4. **Record** — flip the step's checkbox and append its result section (with its `**Executed:**` field, §5), exactly as in serial execution.

Run the checkpoint's assertions only once every step in the batch has executed — every batch step merged or fallen back to serial delegation, every post-merge serial step run. The checkpoint is the batch's integration gate; a failure is Stop-the-Line on the integrated tree. When no checkpoint follows the batch, merge the same way at its natural bound — before the first serial step that depends on a batch step, or, for the plan's tail, before the acceptance gate; each step's integrated re-verify above plus §7's goal verification and §8's pre-presentation checks serve as the integration gate. Don't invent an implicit checkpoint.

Remove merged worktrees before continuing — they're scratch, per the contract.

### 5. Result File: Per-Step Section Template

```markdown
## Step N — <step title>

**Verified:** <how the step's verify criterion was satisfied — command output, test name that passed, behavior observed>

**Shipped:**

- <file:line or path> — <what changed>
- <file:line or path> — <what changed>

**Sources:** <official-doc URLs / deep links grounding any framework-specific code in this step; otherwise omit>

**Executed:** <only when execution deviated from the default serial delegation — for a parallel-batch step, "parallel batch (<executor engine>), merged in plan order at/before <the batch's merge point>", the merge point being its bounding checkpoint, the first post-merge serial step in a checkpoint-free plan, or the acceptance gate for a tail batch; or "inline (<reason>)" for an inline fallback; omit for serially-delegated steps>

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

**Sources:** <official-doc URLs / deep links grounding any framework-specific code; otherwise omit>

**Executed:** <only when a folded step deviated from serial delegation — "Step N inline (<reason>)" per such step; omit otherwise>

**Deviations from plan:** <if any>

**Notes:** <surprises, gotchas, follow-ups>

---
```

In full-plan mode, still flip every step's `- [ ]` to `- [x]` in the plan, with each linking to the same `#full-run--<date>` anchor (note the double hyphen — the em-dash in the header drops out and both surrounding spaces become hyphens).

Merged parallel-batch steps are the exception on both counts: each keeps its own per-step section (its merge gates and `**Executed:**` record are per-step — §4's merge step 4), and its checkbox links to that section instead of the `#full-run` anchor. Only the batch's serially-executed steps fold into the combined block.

**Checkpoint section template:**

```markdown
## Checkpoint after Step N

**Asserted:** <which assertions ran — test command, build command, e2e flow exercised>
**Outcome:** passed
**Merged:** <parallel-batch steps merged at this gate in plan order — e.g. "Steps 3, 4 from the parallel batch"; omit when no batch>
**Notes:** <surprises, near-misses, anything important; otherwise omit>

---
```

If the checkpoint failed, record `**Outcome:** failed` and the failure details, then follow Stop-the-Line. Do not move on.

**After appending any section** — step, full-run, or checkpoint — rewrite the `## Current state` block to match: `_Updated:_` refreshed, status gloss, `**Pointers:**` (the branch/PR/SHA/ticket currently in play), `**Next:**`; ≤1 KB, superseded detail dropped. **When a step records a decision**, append a dated one-liner to the `## Decision log` section (creating it directly below the `## Current state` block's closing `---` when absent, as the first section of the append-only log): `- YYYY-MM-DD — <decision> (→ <result anchor / CONTEXT section / plan step / DECISIONS.md #N>)` — a pointer to where the decision is recorded, never the decision text itself (see `./references/workflow/task-lifecycle.md`).

### 6. Plan Revisions Mid-Execution

When implementation reveals the plan is wrong — a step is infeasible, scope was wrong, a new step is needed, or a step turns out too large to land in one slice — apply the scope-change rules in `./references/workflow/execution-loop.md` § *Scope changes mid-execution*, including its splitting strategies. This skill's binding for what surfacing and recording mean against a plan:

- **Update the plan in place** — revise the affected step or scope; add new steps if needed; remove obsolete steps. Keep step numbers stable when possible (insert as `Step 3a`, `Step 3b` rather than renumbering).
- **Record the divergence in the result file** under the affected step's `**Deviations from plan:**` field, including _why_ the plan changed.
- In step-by-step mode, pause and confirm the revision with the user before continuing.
- **If the right call is to abandon the task** rather than revise it, surface that to the user and get explicit confirmation first — `implement-task` never sets `skipped` on its own (see `./references/workflow/task-lifecycle.md`). On confirmation, set the plan's `**Status:**` to `skipped` (record why in the result file) and stop — don't delete the plan or leave it dangling in `executing`.

### 7. Acceptance Gate

After the last step is marked done but **before** flipping either file's `**Status:**` to `done`, run the acceptance gate against `goals.md`, applying the acceptance discipline in `./references/workflow/execution-loop.md`. This skill's binding: the criteria are `goals.md`'s `G<n>` goals, and the verdict goes in an `## Acceptance` section of the result file.

For each goal in `goals.md` (by its `G<n>` ID), **tag the outcome** as `met`, `met with caveats`, `unmet`, `out of scope`, or `pending external`. Tag `out of scope` **only when the plan's `## Scope` lists this goal ID in its deferred partition** — confirm the ID is actually there. If a goal you'd call out-of-scope isn't in the deferred set, it drifted in after the plan was written; surface it to the user rather than silently dropping it under a label the scope never authorized. Tag `pending external` **only for a goal carrying the `(external)` marker** whose verification you genuinely can't perform in-session (a human/client sign-off, or a live/production state you can't drive) — record what's awaited and who/what will verify it. `pending external` is never a substitute for `unmet`: if the agent-verifiable work behind the goal isn't done, it's `unmet`.

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

**If any goal is `unmet`, do not finalize.** Apply Stop-the-Line: localize the gap, decide whether it's a missed step (revise the plan, add steps, return to execution) or a goals misunderstanding (surface to the user, let them edit the goals file, then re-run the gate).

**If any goal is `met with caveats`, secure explicit user acknowledgement before finalizing.** Surface each caveat — what's caveated and why — and confirm the user accepts shipping with it; this is the same provenance `out of scope` carries at tag time. Record the acknowledgement in the result file's `## Acceptance` entry for that goal. An unacknowledged `met with caveats` is not a pass — treat it like `unmet` and do not finalize.

**If any goal is `pending external`, do not finalize to `done` — park at `in-review`.** These are `(external)` goals whose verification happens outside the session; every *other* goal must be `met` / acknowledged-caveat / out-of-scope first. Then finalize per §8's `in-review` branch. This is the mechanism that stops a task reaching `done` on code-complete alone.

### 8. Finalize

The gate produces one of two session-terminal outcomes — `done` or `in-review`.

**Park at `in-review`** when every agent-verifiable goal is `met` (or `met with caveats` / `out of scope` with explicit user acknowledgement) **but one or more `(external)` goals are `pending external`**:

- Update **both** the plan's and the result file's `**Status:**` to `in-review`
- Add an `**In review:**` section to the result file listing each pending goal — `- G<n> — <what's awaited, who/what verifies it>` — and **do not** add a `**Completed:**` line
- Run the shared loop's *Before presenting* step (`./references/workflow/execution-loop.md`); its summary additionally names which agent-verifiable goals are `met`, and exactly what external verification is outstanding and how to confirm it

**Finalize to `done`** only after the acceptance gate is fully `met` (or every gap is `met with caveats` / `out of scope` with explicit user acknowledgement) **and no goal is `pending external`**:

- Update the plan's `**Status:**` to `done`
- Update the result file's `**Status:**` to `done` and add a closing `**Completed:** YYYY-MM-DD` line
- Run the shared loop's *Before presenting* step — the domain's pre-presentation checks over the full changed surface, then the summary of what shipped, acceptance results, deviations, and open follow-ups (`./references/workflow/execution-loop.md`)

In **both** terminal branches, rewrite `## Current state` last — at `in-review` its `**Next:**` names the awaited external verification; at `done` the block stays frozen as the final digest. Then regenerate the store index when the store has one: walk up from the task folder for `scripts/generate-index.mjs`; run `node <that-root>/scripts/generate-index.mjs`; skip silently when the script or `node` is absent (`./references/workflow/task-layout.md` § *Store-level artifacts*).

**Reaching `done` from `in-review` (a later re-run).** When the user reports the external verification happened — a confirmation, a receipt, or the observed live state — re-run the gate on each `pending external` goal against that **best-available proxy** (per `./references/workflow/acceptance-criteria.md`): the user-reported confirmation *is* the sanctioned evidence for an `(external)` goal. Update its `## Acceptance` line from `pending external` to `met` (noting the proxy), then finalize to `done` as above (adding the `**Completed:**` line). If the review instead surfaced problems, flip both files back to `executing` and resume — don't force `done`.

## Don't Rationalize

The shared loop's *Don't Rationalize* list applies in full (`./references/workflow/execution-loop.md`). These are this skill's own:

- "I'll update the result file at the end" — Update it as you go. End-of-task batching loses the surprises and reasoning that are worth recording.
- "The worktree verify passed, merging is a formality" — The executor's pass is provisional by contract. Integration is where parallel work breaks; the merge gates are the ones that count.
- "These steps look independent, I'll parallelize them without declarations" — Undeclared means serial. The `Touches:` declaration is the eligibility evidence, not paperwork.
- "Delegating this step is overhead, I'll just do it myself" — The default is delegation because context economy compounds over the run. Inline is the contract's named exception — announced and recorded — not a quiet drift back to doing everything in-session.

### Red flags

The shared loop's red flags apply in full. When the domain is code, also watch the engineering red flags in `./references/engineering/execution.md` (writing >100 lines without verify, framework code without a doc citation, a bug-step without a failing reproduction, a step marked done while typecheck/lint/suite is red).

## Verification

Confirm the protocol invariants before finishing:

- [ ] All four core artifacts read before starting (plus `ticket.md` when present); a missing `goals.md` surfaced to the user, never invented
- [ ] Result file initialized and kept paired with the plan per `./references/workflow/task-lifecycle.md` — statuses flip together, `**Completed:**` line only at `done`
- [ ] `## Current state` rewritten at every status flip, after every appended section, and at finalize — ≤1 KB, consistent with `**Status:**`, never claiming more than it
- [ ] Every completed step: its plan-defined `Verify` criterion actually run and passed, health verify green, checkbox flipped with a link to its result section
- [ ] Every checkpoint run and recorded; no step started over a failing gate
- [ ] Acceptance gate ran every goal by `G<n>` ID against live behavior and wrote the `## Acceptance` section — no goal left `unmet` at finalize, `pending external` only on `(external)` goals (parking the task at `in-review`)
- [ ] Deviations and plan revisions recorded in the result file; `goals.md` and `CONTEXT.md` never edited from this skill
- [ ] Domain pre-presentation checks re-run on the full changed surface (for code: typecheck, linter, tests, consumer grep; framework code cited to `**Sources:**` or marked `// UNVERIFIED:`)
- [ ] Every step executed through the delegation default — a serial executor with the coordinator's re-run gates, an announced parallel batch, or an announced inline fallback recorded in its `**Executed:**` field
- [ ] Every parallel-batch step merged only through the gates — surface check, conflict-free merge, integrated re-verify, the batch's checkpoint (or the §7/§8 tail gate) — with conflicts and surface escapes falling back to serial delegation
- [ ] Executors wrote no task-folder file and no status; batches recorded (`**Executed:**` fields, checkpoint `**Merged:**` lines) and worktrees removed after merge
