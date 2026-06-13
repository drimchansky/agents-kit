---
name: review-task
description: Use when asked to review, validate, or sanity-check a task's plan — confirms the direction is right and still in sync with CONTEXT.md, the spec, and current reality, and surfaces any drift between task artifacts (CONTEXT, spec, plan, result) and the work itself.
argument-hint: '[task directory path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for (`exploration.md`, `verification.md`, …). If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill validates a plan against current reality before execution begins. It catches infeasible steps, missing details, pattern conflicts, and implicit assumptions — producing a clear assessment with targeted questions.

The user provides a plan — typically the output of `plan-task`, written to `<task-dir>/<task-slug>.plan.md`. Your job is to determine whether the plan can be executed as written given how things actually are, and surface anything that needs resolution first.

**CRITICAL**: Do not implement. Do not redesign the solution. Validate the plan. The output is a feasibility assessment with questions, not a revised plan or code.

## Locate the Plan

Resolve a task directory first, then the plan inside it:

- **If the user gave a task directory path or slug** (e.g. `.agents/tasks/add-csv-export/` or `add-csv-export`), resolve it against active task directories per `./references/workflow/task-layout.md`: standalone `.agents/tasks/<slug>/` first, then project task subdirectories `.agents/tasks/*/<slug>/`, excluding `archive/`. If exactly one matches, use it. If none match, look inside `archive/`. If multiple match, ask.
- **If the user gave a full plan path**, use it directly and derive the task directory from its parent — this targets one specific plan inside a multi-plan directory.
- **If the user gave nothing**, list active task directories per `./references/workflow/task-layout.md` and ask which.

Once the directory is resolved, pick the plan from its `*.plan.md` files (skip `*.spec.md` and `*.result.md` — those are inputs and execution records). If multiple plans exist, list them and ask which one to review.

Task directories may be standalone or grouped under a project with a shared `PROJECT.md`, and finished tasks may sit in an `archive/` subdirectory. Exclude `archive/` when listing; descend into a project group's task subdirectories; look inside `archive/` when resolving a finished task. See `./references/workflow/task-layout.md`.

Read the plan, the sibling `<task-slug>.spec.md`, **and** the sibling `CONTEXT.md` in full before assessing anything. If `CONTEXT.md` carries a `**Project:**` header, read the linked `PROJECT.md` too.

- **`CONTEXT.md`** carries the shared problem statement, scope summary, key assumptions, and external references that apply to every plan in the directory.
- **`PROJECT.md`** (when `CONTEXT.md` has a `**Project:**` header) carries the shared project-level context across sibling tasks — charter, decision log, plan registry, cross-task references. Authoritative for cross-task concerns; read it for grounding and for drift checks that span more than one task.
- **`<task-slug>.spec.md`** carries the acceptance criteria — the testable contract for what "done" means for this plan. The plan's steps must collectively cover every criterion.

Both are authoritative input for grounding, not optional. If the spec file is missing, flag it as a gap up front — `plan-task` is expected to produce one and the acceptance coverage check below cannot run without it.

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

### 4. Audit Spec Quality

Before mapping criteria to steps, assess the criteria themselves. Coverage is meaningless if the criteria are vague — a perfectly-covered plan can still ship the wrong thing because "the export works well" maps cleanly to a step that builds the wrong export.

Apply `./references/workflow/acceptance-criteria.md` to every bullet in `<task-slug>.spec.md`. Tag each criterion with one of:

- **good** — passes every check (testable, specific, outcome-oriented, singular, bounded, stated as behavior)
- **weak** — passes overall but loses points on one dimension; note which (treated as feedback, not a blocker)
- **vague-or-untestable** — fails one or more checks; the criterion must be revised (or marked `_(unresolved: ...)_`) before execution
- **unresolved** — already marked `_(unresolved: ...)_` in the spec; record it here and lift it into Questions

Surface every `weak`, `vague-or-untestable`, and `unresolved` finding into the Questions section. For each, name the **specific failing dimension** ("not testable — no observable behavior named") and suggest a rewrite where you can ("'export is fast enough' → 'p95 export latency under 2s for the largest staging tenant'"). Don't paraphrase the failing dimension — point at the checklist line that didn't pass.

If the spec is missing entirely, skip this step and treat the missing spec as the highest-priority finding in the coverage section below.

### 5. Check Acceptance Coverage

For each acceptance criterion in `<task-slug>.spec.md`, identify which step(s) deliver it. The mapping must be explicit — if you can't point at a step (or set of steps) that produces the criterion's observable outcome, that criterion is **uncovered**.

Tag each criterion with one of:

- **Covered** — A specific step or set of steps clearly delivers the criterion. Name them.
- **Partially covered** — Some steps contribute but a piece of the criterion is missing. Name what's missing.
- **Uncovered** — No step delivers this criterion. The plan must add a step (or revise an existing one) before execution.
- **Out of scope** — The criterion is in the spec but the plan explicitly excludes it in `Scope: Out of scope`. Flag the inconsistency for the user — either the spec or the scope is wrong.

Also flag the inverse — **plan steps with no matching criterion**. Steps that don't contribute to any acceptance criterion are either scope creep, infrastructure not the spec captured, or a sign the spec is incomplete. Surface them; don't silently accept them.

Note any criterion marked `_(unresolved: ...)_` from the spec — these are deferred clarifying questions and should be lifted into the Questions section of this review's output.

### 6. Check Cross-File Drift

Per-step feasibility and acceptance coverage both assume the four task artifacts agree with each other. They often don't. A criterion can be added to the spec after the plan was written; CONTEXT's "Not Doing" list can quietly exclude a behavior the plan now ships; a result file can record work that no longer matches the plan's status. Surface these mismatches as their own class of finding — they are not the same as a missing or vague step.

Compare the artifacts pairwise. For each pair, name the kind of drift the comparison is looking for; only flag actual contradictions, not stylistic differences.

- **CONTEXT.md ↔ `<task-slug>.spec.md`** — Does any acceptance criterion describe behavior CONTEXT's "Not Doing" list excludes, or behavior outside CONTEXT's MVP scope? Does the spec contradict CONTEXT's Recommended Direction or Key Assumptions?
- **CONTEXT.md ↔ `<task-slug>.plan.md`** — Does the plan's Scope (in / out / boundaries) contradict CONTEXT's MVP scope or "Not Doing"? Does the plan reference assumptions CONTEXT marked still-to-validate as if they were settled?
- **`<task-slug>.spec.md` ↔ `<task-slug>.plan.md`** — Is a criterion excluded by the plan's `Out of scope` (already surfaced in Acceptance Coverage as `out of scope` — repeat it here to make the inconsistency explicit)? Does the plan's `In scope` extend beyond what any criterion requires?
- **`<task-slug>.plan.md` ↔ `<task-slug>.result.md`** (only if `result.md` exists) — Does the result claim a step done while the plan's checkbox is still `- [ ]`? Does the result reference a step number the plan doesn't have (a sign of a stale rename)? Does the **pairing rule** in `./references/workflow/task-lifecycle.md` hold — plan `executing` requires result `executing`, plan `blocked` requires result `blocked` with a `**Blocked:**` section, plan `done` requires result `done`, while a `skipped` plan may have no result or an explanatory result that remains `executing`?
- **Status field consistency** — Does CONTEXT carry a valid origin marker, the plan a valid lifecycle state, and the result (if present) a valid lifecycle state compatible with the pairing rule? Reject anything outside the vocabulary registered in `./references/workflow/task-lifecycle.md`.

If `<task-slug>.result.md` is absent, skip the last two pair checks — that absence is expected for plans in `to-do` or `skipped`.

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

### Spec Quality

A short list giving each criterion a quality verdict (`good` / `weak` / `vague-or-untestable` / `unresolved`) with the failing dimension where one applies. Always render this section — when every criterion is `good`, say so explicitly (absence is a regression, not silence).

Example:

```
- Criterion 1 — good
- Criterion 2 — weak (singular: bundles "user can export" with "and the file downloads"; consider splitting)
- Criterion 3 — vague-or-untestable (specific: "fast enough" has no yardstick; suggest "p95 < 2s in staging")
- Criterion 4 — unresolved (lifted from spec — see Questions)
```

If `<task-slug>.spec.md` is missing entirely, state that here and skip; the missing spec is the highest-priority finding overall.

### Acceptance Coverage

A short list mapping each acceptance criterion in the spec to the step(s) that deliver it. Tag each criterion `covered` / `partially covered` / `uncovered` / `out of scope`. Then list any plan steps that don't map to any criterion.

Example:

```
- Criterion 1 — covered by Step 2, Step 4
- Criterion 2 — partially covered by Step 3 (missing the empty-state behavior)
- Criterion 3 — uncovered (no step produces the export endpoint)
- Step 5 — no matching criterion (likely scope creep or spec gap)
```

If `<task-slug>.spec.md` is missing entirely, state that here and skip the per-criterion mapping; treat the missing spec as the highest-priority gap.

### Cross-File Drift

A short list of contradictions between artifacts, grouped by the file pair the contradiction lives in. Render the section header even when no drift is found — state "no drift detected" explicitly so the absence is informative rather than ambiguous. Skip pairs that include `<task-slug>.result.md` if no result file exists yet.

Example:

```
- CONTEXT ↔ spec — drift: spec criterion 4 ("user can export archived rows") describes behavior CONTEXT's "Not Doing" excludes. Resolve by either lifting the exclusion or dropping the criterion.
- CONTEXT ↔ plan — no drift detected.
- spec ↔ plan — drift: plan's `In scope` includes "audit-log integration" but no criterion requires it (already flagged in Acceptance Coverage as a step with no matching criterion; surfacing here too because the scope wording itself is wrong).
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

## Don't Rationalize

- "The plan looks reasonable" — Check every integration point in the code. Reasonable isn't verified.
- "This can probably be reused" — Inspect the actual thing. Names don't guarantee reusability.
- "I'll note the gaps during implementation" — Surface them now. That's the entire point of review.
- "Everything looks good" — Rubber-stamping isn't review. Every integration point needs code-level verification.
- "That's a theoretical concern" — Only flag real issues, but don't dismiss concerns without checking the code.
- "The criteria look fine to me" — Run them through `./references/workflow/acceptance-criteria.md`. Without an explicit pass, this skill rubber-stamps vague criteria, the structural coverage check gives false confidence, and the failure surfaces inside the acceptance gate where it's most expensive.

## Verification

- [ ] `CONTEXT.md` and `<task-slug>.spec.md` read in full alongside the plan; missing spec flagged as a gap
- [ ] When `CONTEXT.md` has a `**Project:**` header, the linked `PROJECT.md` read for cross-task grounding
- [ ] Every integration point verified against actual source code
- [ ] Each step has a clear verdict with evidence
- [ ] Each step's verify criterion assessed for concreteness
- [ ] Each criterion in the spec assessed against `./references/workflow/acceptance-criteria.md`; `weak` / `vague-or-untestable` / `unresolved` findings appear in Questions with the specific failing dimension (and a suggested rewrite where possible)
- [ ] acceptance coverage section maps every spec criterion to a step (or marks it `uncovered` / `out of scope`); plan steps with no matching criterion also flagged
- [ ] Cross-file drift assessed across CONTEXT ↔ spec, CONTEXT ↔ plan, spec ↔ plan, plan ↔ result (when result exists), and status-field consistency against `./references/workflow/task-lifecycle.md`; section rendered even when no drift is found
- [ ] Deferred criterion clarifications (`_(unresolved: ...)_` in the spec) lifted into Questions
- [ ] Checkpoints (if plan >5 steps) assessed for placement and concrete end-to-end assertion
- [ ] Questions are targeted and explain why the answer matters
- [ ] Gaps grouped by category with specific details
- [ ] No redesign or implementation proposed — review only
