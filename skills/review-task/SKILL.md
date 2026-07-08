---
name: review-task
description: Use when asked to review, validate, or sanity-check a task's plan — confirms the direction is right and still in sync with CONTEXT.md, the goals, and current reality, and surfaces any drift between task artifacts (CONTEXT, goals, plan, result) and the work itself; pass `-r` to also reconcile obvious findings into the task docs and fold engineer answers into the plan.
argument-hint: '[task folder path] [-r (reconcile findings into task docs)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill validates a plan against current reality before execution begins. It catches infeasible steps, missing details, pattern conflicts, and implicit assumptions — producing a clear assessment with targeted questions.

The user provides a plan — typically the output of `plan-task`, written to `<task-dir>/plan.md`. Your job is to determine whether the plan can be executed as written given how things actually are, and surface anything that needs resolution first.

**CRITICAL**: Do not implement. Do not redesign the solution. Validate the plan. In default mode (no `-r`) the output is a feasibility assessment with questions, not a revised plan or code — no file is touched. With `-r`, after the assessment is printed, obvious findings are reconciled into the task docs and the review's Questions are put to the engineer, whose answers are folded into the plan (Step 9) — still no implementation and no redesign; a step that needs rethinking goes back to `plan-task`.

## Flags

- `-r` — Reconcile: after printing the assessment, auto-apply its obvious findings to the task docs, put the review's Questions to the engineer as one batched round, and fold their answers into the plan — per the shared contract in `./references/workflow/reconciliation.md`. Off by default; without `-r` the review is strictly read-only. Step 9 carries this skill's finding-type mapping.

## Locate the Plan

Resolve a task folder per the **resolve-or-ask** discovery rules in `./references/workflow/task-layout.md` — a bare slug (resolved in the canonical root, falling back into `archive/` for a finished task), an explicit path used verbatim anywhere on disk, a full `plan.md` path taken directly, or, when the user named nothing, list active folders and ask which.

Once the folder is resolved, read its `plan.md` (one plan per folder; its sibling `goals.md` and `result.md` are inputs and execution records).

Read the plan, the sibling `goals.md`, **and** the sibling `CONTEXT.md` in full before assessing anything.

- **`CONTEXT.md`** carries the problem statement, scope summary, key assumptions, and external references for the task.
- **`goals.md`** carries the goals — the testable contract for what "done" means for this plan. The plan's steps must collectively cover every goal (each goal ID cited by a step's `**Goal:**` line).

Both are authoritative input for grounding, not optional. If the goals file is missing, flag it as a gap up front — `plan-task` is expected to produce one and the acceptance coverage check below cannot run without it.

## When to Review

**Use when:**

- A plan was just written by `plan-task` and the user wants a sanity check before implementation
- The plan references existing code, patterns, or APIs that need to be confirmed
- The plan touches multiple modules, shared code, or introduces new patterns
- The user wants a second pass before handing off to `implement-task`

**Skip when:**

- The plan is trivial enough that review takes longer than execution
- The user has already validated the plan themselves and wants to move to implementation
- The task is a small bug fix with a clear root cause

## Review Process

### 1. Parse the Plan

Extract the concrete claims and steps:

- **Goal** — What the plan is trying to accomplish
- **Steps** — Each ordered step's "What", "Verify", "Depends on", and any "Due" / "Lead time"
- **Checkpoints** — Any `### Checkpoint after Step N` blocks: where they're placed, what assertions they list (test suite, build, named end-to-end flow)
- **Scope** — What's in / out of scope and why
- **Integration points** — What existing code, components, APIs, or patterns the plan references or depends on
- **Implicit assumptions** — What the plan takes for granted without stating (available APIs, existing components, data availability)

Restate the plan's intent in your own words to confirm understanding. If steps are ambiguous, note the ambiguity — don't silently pick an interpretation.

### 2. Ground in the Domain's Reality

**CRITICAL**: Verify the plan against what actually exists, not against its own claims. Every claim about existing behavior must be checked against the real artifacts. This is an independent pass — do not assume `plan-task`'s exploration was correct.

For each thing the plan references or integrates with:

- **Verify it exists** — the file, function, service, document, vendor, booking — whatever the plan leans on. Confirm it; don't take the name on faith.
- **Verify it does what the plan assumes** — inspect the actual thing, not just its name. A component called `ValidatorList`, or a venue described as "available," may not behave as assumed.
- **Check reusability / availability** — if the plan says "reuse X" or "use the existing Y," confirm it can actually be used as assumed (no hidden coupling, no prior commitment, no blocking constraint).
- **Map the blast radius** — what existing work will be affected by the proposed changes?

When the domain is code, follow `./references/engineering/exploration.md` for the concrete recipe (grep for the symbol, read the implementation, verify external API surface against installed versions, check the message/transaction format).

### 3. Assess Each Step

For every step, assign one of:

- **Feasible** — Can be executed as planned with existing patterns and infrastructure
- **Feasible with caveats** — Can be done, but the step is missing details or underspecifies behavior in certain cases
- **Needs clarification** — Ambiguous or underspecified — multiple interpretations exist and the choice affects implementation
- **Conflicts with what exists** — Contradicts established patterns, conventions, or constraints
- **Infeasible as stated** — Cannot be executed as described — the referenced thing doesn't exist, or can't be used as assumed, etc.

Also assess each step's **Verify** criterion: is it concrete enough to actually confirm the step worked? Flag verify criteria that are vague ("ensure it works") or untestable.

### 4. Audit Goal Quality

Before mapping goals to steps, assess the goals themselves. Coverage is meaningless if the goals are vague — a perfectly-covered plan can still ship the wrong thing because "the export works well" maps cleanly to a step that builds the wrong export.

Apply `./references/workflow/acceptance-criteria.md` to every goal in `goals.md`. Tag each goal with one of:

- **good** — passes every check (testable, specific, outcome-oriented, singular, bounded, stated as behavior)
- **weak** — passes overall but loses points on one dimension; note which (treated as feedback, not a blocker)
- **vague-or-untestable** — fails one or more checks; the goal must be revised (or marked `_(unresolved: ...)_`) before execution
- **unresolved** — already marked `_(unresolved: ...)_` in `goals.md`; record it here and lift it into Questions

Surface every `weak`, `vague-or-untestable`, and `unresolved` finding into the Questions section. For each, name the **specific failing dimension** ("not testable — no observable behavior named") and suggest a rewrite where you can ("'export is fast enough' → 'p95 export latency under 2s for the largest staging tenant'"). Don't paraphrase the failing dimension — point at the checklist line that didn't pass.

If the goals file is missing entirely, skip this step and treat the missing goals as the highest-priority finding in the coverage section below.

### 5. Check Acceptance Coverage

For each goal in `goals.md`, map its `G<n>` ID to the delivering step(s) by reading each plan step's `**Goal:**` citation. Whether a goal is covered at all is **mechanical**, not interpretive: collect the goal IDs each step's `**Goal:**` line lists; a goal ID named by no step is **uncovered**. Don't infer *coverage* from prose — read the citations. The one place a light read of the step is warranted is separating `covered` from `partially covered` below — a goal whose only citing step visibly delivers just part of it; that single judgment aside, the mapping stays citation-driven.

Tag each goal with one of:

- **Covered** — at least one step's `**Goal:**` line cites this goal ID. Name the step(s).
- **Partially covered** — a step cites this goal ID but visibly delivers only part of it; name what's missing. (This is the one verdict that needs a light read of the step, not just its citation.)
- **Uncovered** — no step's `**Goal:**` line cites this goal ID. The plan must add a step (or add the citation to an existing one) before execution.
- **Out of scope (deferred)** — the plan's `Scope` lists this goal ID in its deferred partition; no step needs to cover it (expected, not a gap). A goal neither cited by a step nor in the deferred partition is the real inconsistency — flag it.

Also flag the inverse — **orphan steps**. A step whose `**Goal:**` line cites a goal ID, or is marked `none (infra/refactor)`, is fine; a non-infra step that cites no goal — or cites a goal ID absent from `goals.md` — is scope creep, a missing goal, or a stale citation. Surface it; don't silently accept it. A step marked `**Goal:** none (infra/refactor)` is a legitimate infra/setup step, not an orphan.

Note any goal marked `_(unresolved: ...)_` from `goals.md` — these are deferred clarifying questions and should be lifted into the Questions section of this review's output.

### 6. Check Cross-File Drift

Per-step feasibility and acceptance coverage both assume the four task artifacts agree with each other. They often don't. A goal can be added to `goals.md` after the plan was written; CONTEXT's "Not Doing" list can quietly exclude a behavior the plan now ships; a result file can record work that no longer matches the plan's status. Surface these mismatches as their own class of finding — they are not the same as a missing or vague step.

Compare the artifacts pairwise. For each pair, name the kind of drift the comparison is looking for; only flag actual contradictions, not stylistic differences.

- **CONTEXT.md ↔ `goals.md`** — Does any goal describe behavior CONTEXT's "Not Doing" list excludes, or behavior outside CONTEXT's MVP scope? Do the goals contradict CONTEXT's Recommended Direction or Key Assumptions?
- **CONTEXT.md ↔ `plan.md`** — Does the plan's Scope (in / out / boundaries) contradict CONTEXT's MVP scope or "Not Doing"? Does the plan reference assumptions CONTEXT marked still-to-validate as if they were settled?
- **`goals.md` ↔ `plan.md`** — Confirm the plan's `Scope` partition is **total**: every goal ID in `goals.md` is either delivered or explicitly deferred. A goal the Scope neither delivers nor defers is the drift. (This replaces the old "criterion excluded by scope" hunt — with scope expressed as a goal-ID partition, that contradiction can't be silently authored; coverage already catches uncovered goals and orphan steps.)
- **`plan.md` ↔ `result.md`** (only if `result.md` exists) — Does the result claim a step done while the plan's checkbox is still `- [ ]`? Does the result reference a step number the plan doesn't have (a sign of a stale rename)? Does the **pairing rule** in `./references/workflow/task-lifecycle.md` hold — plan `executing` requires result `executing`, plan `blocked` requires result `blocked` with a `**Blocked:**` section, plan `in-review` requires result `in-review` with an `**In review:**` section, plan `done` requires result `done`, while a `skipped` plan may have no result or an explanatory result that remains `executing`?
- **Status field consistency** — Does CONTEXT carry a valid origin marker, the plan a valid lifecycle state, and the result (if present) a valid lifecycle state compatible with the pairing rule? Reject anything outside the vocabulary registered in `./references/workflow/task-lifecycle.md`.

If `result.md` is absent, skip the last two pair checks — that absence is expected for plans in `to-do` or `skipped`.

### 7. Identify Gaps

Look for what the plan doesn't say but executing it will need:

- **Missing edge cases** — Boundaries and failure modes the plan doesn't address (empty, zero, max, concurrent, the unhappy path)
- **Missing transitions** — How the actor gets into and out of the new flow
- **Missing inputs** — Where required information or resources come from, and whether they're actually available
- **Step ordering & timing** — Are dependencies between steps correct? Is anything required out of order? For steps carrying `Due` / `Lead time`, is the schedule feasible — does each step's lead time fit before its own (or a dependent step's) due date, and do long-lead items start early enough?
- **Checkpoint placement** — For plans with more than ~5 steps, are checkpoints present every 2–3 steps, each naming a concrete end-to-end outcome (e.g. "user can log in and see dashboard"), not a vague "core flow works"? Flag missing, misplaced, or vague checkpoints.
- **Domain constraints** — Rules, limits, or timing the work must respect

When the domain is code, also check the engineering-specific gaps in `./references/engineering/planning.md` ("Common gaps to check in a code plan": UI states, navigation, data fetching/caching/invalidation, analytics, new-pattern acknowledgement).

### 8. Check Pattern Consistency

Compare the plan's implied approach against the established patterns of the project or effort: does it match how similar work is structured, follow the same conventions, and respect the boundaries the effort enforces? Would it require something new (a dependency, a pattern, a one-off exception), and is that justified? When the domain is code, follow `./references/engineering/exploration.md`'s pattern-consistency checks (structure, data-flow patterns, naming, dependencies, module boundaries).

### 9. Reconcile the Docs (only with `-r`)

Skip this step entirely without the flag; it runs **after** the output below is printed — the assessment must be a faithful pre-reconcile snapshot, never regenerated after edits. Apply the review's findings to the task docs per the shared contract in `./references/workflow/reconciliation.md` — read it before editing. It defines the consent model (obvious fixes auto-applied; judgment items asked as one batched round of engineer questions, with only answered items applied), the write surface (`plan.md`, `result.md`, `CONTEXT.md` annotations — never `goals.md`), the weaken-never-strengthen rule, the `skipped`-plan exemption, the append-only `## Reconciliation` record, and the sequence ending in the printed change list.

Most of this review's findings need the engineer — that is what the Questions section is for. With `-r`, don't leave the Questions rhetorical: put them to the engineer (one batched round, the concrete options already attached) and write the answers into the plan — exactly the answer given, no redesign around it.

Finding-type → edit mapping (**auto** = obvious, applied unprompted; **ask** = engineer input first):

- **Status-pairing / lifecycle violations** (from the cross-file drift check) — **auto**, the downward repairs the contract defines: plan `done` + result `executing` → plan to `executing`; plan `executing` + result `blocked` with a `**Blocked:**` section → plan to `blocked`; plan `executing` + result `in-review` with an `**In review:**` section → plan to `in-review`; plan `executing` with no `result.md` → skeleton result when work is evidenced, revert to `to-do` when it is not — **ask** when the evidence is ambiguous. A status outside the registered vocabulary → **ask** (the intended state can't be inferred).
- **Plan claims a step done that the result file doesn't back** (`- [x]` with no matching result section) — **auto**: uncheck it and drop the dangling link.
- **Result records work the plan doesn't show** (result section exists, plan still `- [ ]`) — flag only: checking the box would strengthen a claim this review can't verify; name `implement-task` (or the user) to confirm and flip.
- **Scope partition not total** (a goal ID neither delivered nor deferred) — **ask**: deliver it, defer it, or drop the goal (dropping means the user edits `goals.md`); apply the chosen partition to the plan's `## Scope`.
- **Stale or orphan goal citations** (a step cites a goal ID absent from `goals.md`; a non-infra step cites nothing) — **ask**: point the citation at the right goal, mark the step `none (infra/refactor)`, or remove the step; apply the answer.
- **Vague or untestable Verify criterion** — **ask**, offering the concrete rewrite suggested in the assessment; apply the accepted wording to the step's `**Verify:**` line.
- **Gaps and needs-clarification steps** — **ask** the targeted question from the Questions section; fold the answer into the step's **What**/**Verify** (or the plan's Scope).
- **Goal quality findings** (`weak` / `vague-or-untestable` / `unresolved`) — never edited: `goals.md` is the user's contract. Print the suggested rewrite for the user to apply; an engineer answer here still goes to the user as text, not into the file.
- **CONTEXT ↔ goals / CONTEXT ↔ plan contradictions** — **ask** which side is right, but apply the resolution only where the write surface allows: the plan's Scope/steps, or an annotation in CONTEXT's `## Open Questions` recording the ruling. CONTEXT prose (MVP scope, "Not Doing", Recommended Direction) is never rewritten — if the ruling changes direction, that's re-planning; name `plan-task`.
- **Infeasible or conflicts-with-existing steps** — flag only: fixing them is redesign, out of scope even with `-r`; name `plan-task`.

## Output Structure

### Plan Summary

Restate the plan's goal and step list in your own words. This confirms mutual understanding and surfaces any misreadings early.

### Feasibility Assessment

For each step:

- The step (number and title)
- The verdict (feasible / feasible with caveats / needs clarification / conflicts / infeasible)
- Evidence — point to the specific artifact, fact, or constraint that supports the verdict
- If caveats or conflicts: what specifically needs to change in the step
- Verify-criterion check: is it concrete and testable?

### Goal Quality

A short list giving each goal a quality verdict (`good` / `weak` / `vague-or-untestable` / `unresolved`) with the failing dimension where one applies. Always render this section — when every goal is `good`, say so explicitly (absence is a regression, not silence).

Example:

```
- G1 — good
- G2 — weak (singular: bundles "user can export" with "and the file downloads"; consider splitting)
- G3 — vague-or-untestable (specific: "fast enough" has no yardstick; suggest "p95 < 2s in staging")
- G4 — unresolved (lifted from goals.md — see Questions)
```

If `goals.md` is missing entirely, state that here and skip; the missing goals file is the highest-priority finding overall.

### Acceptance Coverage

A short list mapping each goal ID in `goals.md` to the step(s) whose `**Goal:**` line cites it. Tag each goal `covered` / `partially covered` / `uncovered` / `out of scope (deferred)`. Then list any orphan steps (non-infra steps citing no goal).

Example:

```
- G1 — covered by Step 2, Step 4 (both cite `**Goal:** G1`)
- G2 — partially covered by Step 3 (cites G2 but misses the empty-state behavior)
- G3 — uncovered (no step's `**Goal:**` line cites G3)
- Step 5 — orphan (cites no goal, not marked `none (infra/refactor)`) — likely scope creep or a missing goal
```

If `goals.md` is missing entirely, state that here and skip the per-goal mapping; treat the missing goals file as the highest-priority gap.

### Cross-File Drift

A short list of contradictions between artifacts, grouped by the file pair the contradiction lives in. Render the section header even when no drift is found — state "no drift detected" explicitly so the absence is informative rather than ambiguous. Skip pairs that include `result.md` if no result file exists yet.

Example:

```
- CONTEXT ↔ goals — drift: goal G4 ("user can export archived rows") describes behavior CONTEXT's "Not Doing" excludes. Resolve by either lifting the exclusion or dropping the goal.
- CONTEXT ↔ plan — no drift detected.
- goals ↔ plan — drift: `goals.md` lists G5 but the plan's Scope partition names it in neither the delivered nor deferred set — the partition is incomplete. Either deliver G5, defer it, or drop the goal.
- plan ↔ result — drift: result file records Step 3 as shipped but the plan still shows `- [ ]`. Likely an interrupted `implement-task` run.
- Status fields — plan is `executing` but no `result.md` exists (pairing rule violated, per `./references/workflow/task-lifecycle.md`).
```

### Gaps

Missing details that the plan needs to address before implementation, grouped by category.

### Questions

Numbered list of targeted questions. Each question should:

- Reference the specific part of the plan it relates to
- Explain why the answer matters (what implementation decision depends on it)
- Suggest options when possible (not open-ended "what should I do?" but "should it be A or B? A matches the existing pattern, B gives more flexibility")

### Confirmed

Aspects of the plan that are verified and ready to execute — so the user knows what doesn't need further discussion.

With `-r`, after the assessment is printed and reconciliation has run (Step 9), additionally print the `## Reconciliation applied` change list defined in `./references/workflow/reconciliation.md` — every edit with the finding or engineer answer behind it, plus the "Not reconciled" list (or `Nothing to reconcile.` when nothing was actionable).

## Don't Rationalize

- "The plan looks reasonable" — Check every integration point in the code. Reasonable isn't verified.
- "This can probably be reused" — Inspect the actual thing. Names don't guarantee reusability.
- "I'll note the gaps during implementation" — Surface them now. That's the entire point of review.
- "Everything looks good" — Rubber-stamping isn't review. Every integration point needs code-level verification.
- "That's a theoretical concern" — Only flag real issues, but don't dismiss concerns without checking the code.
- "The goals look fine to me" — Run them through `./references/workflow/acceptance-criteria.md`. Without an explicit pass, this skill rubber-stamps vague goals, the structural coverage check gives false confidence, and the failure surfaces inside the acceptance gate where it's most expensive.
- "The engineer answered, so I'll improve the plan properly while I'm at it" — Fold in exactly the answer given. Anything more is redesign — out of scope even with `-r`.
- "The result says Step 3 shipped, I'll check the plan's box" — Reconciliation weakens stale claims; it never marks work done. Only `implement-task` checks boxes.
- "The goal is badly worded, I'll just fix goals.md" — The goals file is the user's contract. Print the suggested rewrite; never edit the file.
- "It's probably what they meant" — If a fix needs a choice, wording judgment, or intent, it isn't obvious. Ask the engineer; apply only what they answer.

## Verification

- [ ] `CONTEXT.md` and `goals.md` read in full alongside the plan; missing goals file flagged as a gap
- [ ] Every integration point verified against actual source code
- [ ] Each step has a clear verdict with evidence
- [ ] Each step's verify criterion assessed for concreteness
- [ ] Each goal in `goals.md` assessed against `./references/workflow/acceptance-criteria.md`; `weak` / `vague-or-untestable` / `unresolved` findings appear in Questions with the specific failing dimension (and a suggested rewrite where possible)
- [ ] acceptance coverage section maps every goal ID to the step(s) citing it via `**Goal:**` (or marks it `uncovered` / `out of scope`); non-infra orphan steps also flagged
- [ ] Cross-file drift assessed across CONTEXT ↔ goals, CONTEXT ↔ plan, goals ↔ plan, plan ↔ result (when result exists), and status-field consistency against `./references/workflow/task-lifecycle.md`; section rendered even when no drift is found
- [ ] Deferred goal clarifications (`_(unresolved: ...)_` in `goals.md`) lifted into Questions
- [ ] Checkpoints (if plan >5 steps) assessed for placement and concrete end-to-end assertion
- [ ] Questions are targeted and explain why the answer matters
- [ ] Gaps grouped by category with specific details
- [ ] No redesign or implementation proposed — review only (with `-r`: doc reconciliation and folded-in answers only; steps needing rethinking routed to `plan-task`)
- [ ] (`-r`) Assessment printed from pre-reconcile state before any edit; not regenerated after
- [ ] (`-r`) Only obvious, evidence-dictated fixes auto-applied; judgment items asked in one batched round with concrete options; unanswered items listed under "Not reconciled"
- [ ] (`-r`) Every edit maps to a printed finding or an engineer answer; `goals.md` untouched; no checkbox flipped to `- [x]`; no status set to `done` or `skipped`
- [ ] (`-r`) `## Reconciliation` record appended per the shared contract when `result.md` was touched; prior result sections unedited (including `## Acceptance`)
- [ ] (`-r`) "Reconciliation applied" change list printed (or `Nothing to reconcile.` — and no file written)
