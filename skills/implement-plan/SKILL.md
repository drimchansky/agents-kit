---
name: implement-plan
description: Use when asked to implement, execute, run, or carry out a plan from `.agents/plans/`.
argument-hint: '[plan file path]'
disable-model-invocation: true
---

This skill executes a plan written by `design-plan` (or any plan in `.agents/plans/` that follows the same format). It implements the work, updates a companion **result file** as it goes, and marks each step `DONE` in the plan with a link back to the result section.

The plan is the **contract**; the result file is the **append-only record**. Both live next to each other:

- Plan: `.agents/plans/<slug>.md`
- Result: `.agents/plans/<slug>.result.md`

**CRITICAL**: Both files are mutated by this skill. The plan is mutated _only_ to flip step checkboxes (`- [ ]` → `- [x]`), append result links, update the `Status:` header, and (when necessary) revise scope or steps. Everything else about the plan stays as written. The result file is the place for narrative — what shipped, what surprised you, what diverged.

## References

Before working, read any applicable checklists from `references/`. Skip ones that don't apply. This is the only skill that writes production code, so the reference checklists matter most here — use them.

## When to Use

**Use when:**

- The user asks to implement, execute, run, or carry out a plan
- A plan exists in `.agents/plans/` and the user wants to start (or resume) work on it
- The user references a plan file directly (e.g. "run `.agents/plans/add-csv-export.md`")

**Skip when:**

- No plan file exists yet — direct the user to `design-plan` first
- The work is small enough that a plan would be overhead — implement directly
- The plan is still being iterated on and not yet finalized

If the user describes a task without a plan and the task is non-trivial, suggest running `design-plan` first.

## Process

### 1. Locate and Load the Plan

- If the user gave a path, use it
- Otherwise, list `.agents/plans/*.md` and filter out any whose name ends in `.result.md`; show the remaining candidates and ask which one
- Read the plan fully before doing anything

If a companion `*.result.md` already exists, read it too — work may have been partially done in a prior session. Pick up where it left off; do not redo completed steps.

### 2. Decide Execution Mode

Ask the user (or infer from the request):

- **Step-by-step** — Execute one step, update both files, pause for the user to inspect or decide before continuing. Default for risky / large plans.
- **Full plan** — Execute every step end-to-end, then write a single combined result. Default for small plans (≤3 steps) or when the user explicitly asks to "just run the whole thing."

Respect step `Depends on:` ordering regardless of mode.

### 3. Initialize the Result File (if it doesn't exist)

Create `.agents/plans/<slug>.result.md` with this header:

```markdown
# Result: <plan title>

**Plan:** [./<slug>.md](./<slug>.md)
**Started:** YYYY-MM-DD
**Status:** in-progress

---
```

Update the plan's `**Result:**` line to link to this file.

### 4. Execute Steps

For each step (or for the whole plan, if running end-to-end):

1. **Implement** — Make the changes the step describes. Stay inside the plan's defined scope.
2. **Verify** — Run the step's `Verify` criterion. Do not skip this; do not declare a step done if the criterion didn't pass.
3. **Record the result** — Append a section to the result file (see template below).
4. **Mark the step DONE in the plan** — Flip `- [ ]` to `- [x]` for that step and append the result-section link:

    ```markdown
    - [x] **What:** <unchanged> ([result](./<slug>.result.md#step-1--add-csv-writer))
    ```

5. **Pause or continue** — In step-by-step mode, stop here and report progress. In full-plan mode, continue to the next step.

If the verify criterion fails:

- Don't mark the step done
- Investigate; either fix and re-verify, or stop and surface the blocker to the user
- Add a `**Blocked:**` section to the result file describing what failed and what's needed to unblock

### 5. Result File: Per-Step Section Template

```markdown
## Step N — <step title>

**Verified:** <how the step's verify criterion was satisfied — command output, test name that passed, behavior observed>

**Shipped:**

- <file:line or path> — <what changed>
- <file:line or path> — <what changed>

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

**Deviations from plan:** <if any>

**Notes:** <surprises, gotchas, follow-ups>

---
```

In full-plan mode, still flip every step's `- [ ]` to `- [x]` in the plan, with each linking to the same `#full-run--<date>` anchor (note the double hyphen — the em-dash in the header drops out and both surrounding spaces become hyphens).

### 6. Plan Revisions Mid-Execution

Sometimes implementation reveals the plan is wrong — a step is infeasible, scope was wrong, or a new step is needed. When this happens:

- **Stop and surface it.** Don't silently work around it.
- **Update the plan in place** — revise the affected step or scope; add new steps if needed; remove obsolete steps. Keep step numbers stable when possible (insert as `Step 3a`, `Step 3b` rather than renumbering).
- **Record the divergence in the result file** under the affected step's `**Deviations from plan:**` field, including _why_ the plan changed.
- In step-by-step mode, pause and confirm the revision with the user before continuing.

### 7. Finalize

When the last step completes:

- Update the plan's `**Status:**` to `complete`
- Update the result file's `**Status:**` to `complete` and add a closing `**Completed:** YYYY-MM-DD` line
- Run the standard pre-presentation checks from `AGENTS.md` (typecheck, linter, tests, consumer grep)
- Summarize for the user: what shipped, any deviations, any open follow-ups

## Don't Rationalize

- "I'll skip the verify step, the change is obvious" — Verification is the whole point of breaking work into steps. Don't skip it.
- "I'll update the result file at the end" — Update it as you go. End-of-task batching loses the surprises and reasoning that are worth recording.
- "The plan is wrong but I'll just do what makes sense" — Update the plan and record the divergence. Silent deviation makes the plan-result pair useless as a record.
- "This step blocks me, I'll come back to it" — Mark it blocked in the result file with what's needed. Don't let blockers vanish.
- "I'll handle this scope expansion now since I'm already here" — Stop. Either revise the plan explicitly or treat the new work as a separate task.
- "The plan said X but Y is so much easier" — If Y is genuinely better, revise the plan and record why. If it's just easier-for-now, stick to X.

## Verification

- [ ] Plan file located and read in full before starting
- [ ] Existing result file (if any) read; completed steps not redone
- [ ] Result file initialized with header pointing back to the plan
- [ ] Plan's `**Result:**` line points to the result file
- [ ] Each completed step's verify criterion was actually run and passed
- [ ] Each completed step has `- [x]` in the plan with a link to its result section
- [ ] Result file sections follow the per-step template (or full-run template)
- [ ] Plan revisions (if any) recorded in result file `**Deviations from plan:**`
- [ ] On finalize: both files' `**Status:**` updated to `complete`
- [ ] Pre-presentation checks (typecheck, linter, tests) run on changed code
