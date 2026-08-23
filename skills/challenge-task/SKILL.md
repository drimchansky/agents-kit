---
name: challenge-task
description: Use when asked to challenge a task's plan for proportionality — whether the complexity it commits to is justified by what the task actually has to achieve, or whether it is overengineered; names what could be dropped, collapsed, or deferred, and never designs an alternative. Read-only.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. It resolves no pack from the task's `**Domain:**` header — its passes are calibrated for `engineering` only; on a task in another domain, say so before running.

This skill audits a plan through a single lens — **proportionality**: is the complexity the task commits to justified by what it actually has to achieve? It works by subtraction, challenging the task's framing, then its goals, then its plan steps, and naming what could be dropped, collapsed, or deferred, with the evidence for each.

It sits after `plan-task` and before `review-task`. `review-task` asks whether the plan *can* be executed; this skill asks whether it *should* be, at that size.

**CRITICAL**: Do not implement. Do not author an alternative design — approach design belongs to `plan-task`, and a challenge implying a materially different shape names that shape in one sentence and routes there. The output is advisory chat output: nothing gates on it, and no file in the task folder is created or modified.

## Locate the Task

Resolve a task folder per the **resolve-or-ask** discovery rules in `./references/workflow/task-layout.md` — cite it, don't restate it; a full `plan.md` path is taken directly.

Once the folder is resolved, read its `CONTEXT.md`, `goals.md`, and `plan.md` in full, plus `ticket.md` when present. `CONTEXT.md` holds the problem the work exists to solve (its section names are the ones `./references/workflow/context-schema.md` registers), `goals.md` the testable contract for what "done" means, and `plan.md` the complexity committed to reach it — a proportionality judgment needs all three, since the question is only ever asked of one against the others. A folder without a `goals.md` halts the challenge up front — both bar tests are undefined without the goal contract — say so and route to `plan-task` to produce one.

Those reads are also the cold re-derivation's inputs: with them in hand and the run past § *The Size Bar*, launch that probe before the first pass when the inputs are direction-blind — § *The Cold Re-derivation* below.

The codebase is the fifth input: the two code-priced yardsticks (new dependencies or patterns, blast radius) are measurable only against what the repo already carries, so read the code the plan touches before pass 3.

## When to Challenge

**Use when:**

- A plan was just written by `plan-task` and its size should be questioned before `review-task` verifies its details
- The user asks whether a plan is overengineered, or wants a proportionality audit of what it commits to
- The plan reads as more elaborate than its problem — many steps, many goals, a new dependency or pattern, a blast radius wider than the outcome

**Skip when:**

- The question is whether the plan can be executed as written — feasibility, grounding of the plan's claims against reality, goal coverage, cross-file drift → `review-task`
- The plan needs a different approach designed rather than a smaller one identified → `plan-task`
- There is no plan yet — this challenges committed work, not an intention

## The Size Bar

The plan has **eight or more steps**, or this skill does not run: no pass renders, no probe launches, and the whole output is one line.

`Not challenged — plan.md carries <n> steps, below the size bar; the challenge would cost more than it could save.`

The threshold is corpus-derived: across the six-plan calibration run (2026-08-10), the smallest plan that produced an actionable finding had eight steps. Below it the skill owes itself the proportionality test it applies to everything else. The user's explicit ask is the one override — asked to challenge a below-bar plan anyway, run in full.

## Challenge Process

Three passes, run in order. Each asks one question at a different level — **what does this cost if it is absent?** — and answers it against the Problem Statement, never against a plan you would have written instead. A divergence that is merely different is not a finding — `./references/engineering/review.md:101` ("equally valid alternatives" is not a review finding) is the standard, and the bar below is the test that enforces it.

The passes run top-down, each taking the previous one's survivors as its input: a goal challenged in an earlier pass is not re-tested in a later one, and a step that exists only to serve it is named in pass 3 as a consequence of that finding rather than as an independent one. A pass whose input was largely challenged above still renders — it states what it took as given, so the reader sees what the assessment did and did not test.

Every finding takes one form:

`challenge: <what could be dropped, collapsed, or deferred> — <what its absence would cost, tested against the Problem Statement>; <the yardstick it wins on> (<citation>)`

Cite the evidence as `file:line` — task files by name (`plan.md:54`, `CONTEXT.md:16`), code by its repo-relative path. An uncited claim is an opinion; drop it rather than print it. The yardstick is one of the four the bar names below. There is no severity and no verdict tier: nothing gates on this output, so a finding is either worth printing or it isn't.

The inline passes read the codebase for exactly what the bar's yardsticks price — whether a dependency or pattern already exists, what the edit surface actually touches — per `./references/engineering/exploration.md`; grounding the plan's reality claims stays `review-task`'s job.

A pass that clears nothing prints, in place of findings:

`No challenge — <one clause naming why the size at this level is justified>.`

### The Bar: When a Challenge Fires

A candidate becomes a printed `challenge:` finding only when **both** tests hold. The bar is the gate on what the output carries, not a separate opinion — it governs every finding all three passes produce.

- **Simpler on a named yardstick.** One of: fewer steps, fewer goals, fewer new dependencies or patterns, smaller blast radius. The finding names the one it wins on; "cleaner", "clearer", and "more idiomatic" name none of them.
- **Coverage still holds.** Every goal in `goals.md` is still covered after the drop, collapse, or deferral — every *surviving* goal, for a finding that challenges a goal itself (that goal's own absence-cost is pass 2's test) or a commitment that goals exist only to serve (those goals fall with it as consequences, per § 1).

A candidate failing either test is discarded silently: it is never printed — not as a finding, not as a hedge, not as an aside naming what was considered. Merely different is the case that discard exists for.

Every yardstick is measured against what the surviving goals require, never against an absolute threshold:

- **Steps and goals.** Eight steps delivering eight goals that each price out as necessary are proportionate; three steps delivering one goal the problem never asked for are not. A count on its own is not a finding.
- **Splitting for checkpoints is bookkeeping, not inflation.** A collapse finding names what the split *costs* — a false stopping point, a checkpoint that can assert nothing — not merely that fewer steps would do.
- **New dependencies or patterns** prices only what the plan introduces that the codebase does not already carry. An established kit or house pattern is not a new pattern.
- **Blast radius** prices the edit surface against the outcome's reach. A wide surface for a wide requirement is proportionate.

### The Cold Re-derivation

A pass that has already read `plan.md` cannot un-read it. So a run also launches one **plan-blind** probe: it gets the problem and the goals, never the plan or the direction, and derives the simplest approach that meets those goals from the codebase itself. Where its derivation and the plan diverge is evidence passes 1 and 3 cannot produce on their own — a smaller shape proposed by something with no stake in the one that was written.

**Only when the inputs are direction-blind.** The inputs travel verbatim, so a chosen direction recorded inside any of them — the Problem Statement, the ticket, or a goal in `goals.md` — reaches the probe as an authorized input no matter what the folder withholds: the derivation would follow the direction it was handed, and its agreement would read as independent corroboration. Launch nothing there and record `skipped (direction embedded in inputs)`.

**Launch early, merge late.** Launch on `native` as soon as the folder's inputs are read and the bar is cleared (§ *Locate the Task*), run the three passes while it works, and collect before the output renders. The prompt is the **re-derivation shape** in `./references/workflow/probe-shape-re-derivation.md`, which owns what it carries, what it withholds, and how it degrades: a dead or unavailable probe is `skipped (<reason>)` and never a block, and slowness alone is not failure. That shape has the probe restate its inputs first — when the restatement names anything beyond the ones handed to it, the derivation was not blind; discard it whole and record `skipped (probe read the task folder)` rather than merging a corroboration that proves nothing.

**The bar is the merge rule.** Diff the derivation against `plan.md` and put each divergence through § *The Bar* above, both tests unchanged: simpler on a named yardstick, and every surviving goal in `goals.md` still covered — the bar's own carve-outs included. One that passes both is printed as an ordinary `challenge:` finding in the pass it belongs to — framing for a different direction, steps for a smaller step set — naming its yardstick and citing `plan.md` like any other. Everything else is discarded silently, and a derivation that is merely different, or naive about a constraint the codebase imposes, is exactly what that discard is for. The derivation is evidence for the bar, never a second opinion that outranks it.

**The outcome line.** Exactly one `Cold re-derivation:` line per run past the bar, in one of three forms:

- `merged: <what the derivation added or contested, and how it settled>` — a divergence cleared the bar and is printed above as a finding
- `clean` — the derivation corroborates the plan's shape; nothing it diverged on survived the bar
- `skipped (<reason>)` — no probe ran: `skipped (direction embedded in inputs)` for the blindness auto-skip, and the engine's own reason otherwise

The line is mandatory in every run, so a forgotten or failed probe is visible rather than ambiguous. It never names a discarded divergence: naming one is the hedge the bar forbids, and `clean` is what covers a derivation that diverged and lost.

### 1. Challenge the Framing

Is `CONTEXT.md`'s Recommended Direction the simplest direction that solves its own Problem Statement — and the `ticket.md` behind it, when one exists?

- Test each commitment the direction makes — a new component, a new seam, a standalone artifact where an existing one could carry the behavior — by asking what the Problem Statement loses without it. A commitment whose absence costs nothing the problem requires is the finding.
- A goal that exists only to serve a challenged commitment falls with it: name it in the finding as a consequence, the way pass 3 names steps. It counts as challenged for the bar's coverage test, and passes 2 and 3 take it as a non-survivor.
- Weigh the direction's stated exclusions too. A "Not Doing" entry that removes work is not a finding; scope the direction claims as in-MVP that the problem never asked for is.
- Naming a simpler direction is where this pass drifts into redesign. State the shape in one sentence and route to `plan-task` — do not draft it, compare it, or carry it into the later passes.

**Skip rule.** When `CONTEXT.md` carries a scaffolded origin marker — the `drafted-by-plan-task` and `seeded-by-decompose-task` markers registered in `./references/workflow/task-lifecycle.md` — *and* its Recommended Direction is still placeholder text, no direction has been chosen to challenge and this pass prints instead:

`Skipped — <marker>, Recommended Direction still a placeholder; no direction was chosen to challenge.`

The marker alone does not trigger the skip: a scaffolded `CONTEXT.md` the user has since enriched carries a real direction and is challenged normally — and enrichment counts wherever it lives, since a chosen direction is sometimes recorded in the Problem Statement or "Not Doing" while the Recommended Direction section stays placeholder. The skip fires only when no direction is recorded anywhere in the file. Passes 2 and 3 run either way, taking the direction as given.

### 2. Challenge the Goals

Per goal in `goals.md`: **what actually happens if this is not shipped?** And across the set: is this the smallest goal set that solves the stated problem?

- A goal whose absence costs nothing the Problem Statement requires is the finding — dropped outright, or deferred to a later task when it is real but not yet load-bearing.
- Two goals that always ship together, and that no step delivers separately, may be one goal. Name the collapse when the split is what inflates the plan, not when it is only tidier bookkeeping.
- A goal that survives because the direction demands it rather than because the problem does belongs to pass 1's finding, not this one; when no pass-1 finding challenged that commitment, the goal is tested here like any other.

**Not a goal-quality audit.** A vague goal cannot be tested for necessity — "the export works well" names no absence to price. Say so for that goal and move on; `review-task` § *Audit Goal Quality* owns testability, specificity, and singularity, and duplicating it here is the seam failure this skill is written to avoid:

`not testable — G<n> names no outcome whose absence can be priced; routed to review-task's goal-quality audit (goals.md:<n>)`

A `No challenge` line asserts only what the pass tested. When a goal was set aside as not testable, name it in that line so the clearance is not read as covering it.

### 3. Challenge the Steps

What is the smallest subset of `plan.md`'s steps that still covers every **surviving** goal — and which steps exist only to serve a goal challenged in an earlier pass?

- Read each step's `**Goal:**` citation to find which surviving goals it serves. That mapping is input here, not an audit: uncovered goals, orphan steps, and an incomplete `## Scope` partition are `review-task`'s coverage check.
- A step whose every cited goal was challenged above is named as a consequence, citing the earlier finding it follows from — pass 1 for a goal that fell with a framing commitment, pass 2 otherwise — not as a second independent challenge.
- **Collapse** two steps that always land together, share one verify criterion, or split a single edit across one surface. **Defer** a step delivering a goal the problem does not need in this task. **Drop** a step whose absence costs nothing any surviving goal requires.
- A step you would restructure rather than remove is not a finding. Scaffolding, tests, and checkpoints that carry a surviving goal's verify criterion are load-bearing — their cost is the price of that goal, so challenging them means challenging the goal in pass 2.

## Output Structure

Advisory chat output, in pass order, closing on the re-derivation's record. No gate, no verdict rollup, no severity.

### Lead-in

One or two lines naming what was challenged: the task, and the size under test — goal count and step count — so the reader knows the assessment's subject before reading its findings.

### Framing / Goals / Steps

One section per pass, in that order, each carrying its `challenge:` findings or its `No challenge` line — and, for framing only, its `Skipped` line when the skip rule fires.

**Every pass renders, every run past the bar.** A run that finds nothing prints all three `No challenge` lines rather than collapsing to a summary. Silence is a regression, not a pass: a reader cannot tell an unchallenged plan from a pass that never ran, and the second is what this rule exists to catch.

### Cold re-derivation

Last, one line, every run past the bar — the probe's outcome in one of the three forms § *The Cold Re-derivation* fixes. It closes the output rather than opening a fourth pass, because it records what fed the three above, and whatever it merged is already printed there as a finding.

Example:

```
Challenged: add-csv-export — 4 goals, 9 steps.

Framing
- No challenge — the direction adds one export route to an existing controller; nothing smaller covers the Problem Statement's "download without filing a support ticket" (CONTEXT.md:8).

Goals
- challenge: G3 (scheduled exports) could be deferred — the Problem Statement asks only for on-demand download, and no other goal depends on scheduling; one fewer goal (CONTEXT.md:8, goals.md:11).
- not testable — G4 names no outcome whose absence can be priced; routed to review-task's goal-quality audit (goals.md:12).

Steps
- challenge: Steps 5 and 6 exist only to serve G3, challenged above — both go with it; two fewer steps (plan.md:71, plan.md:79).
- challenge: Steps 2 and 3 could collapse — both edit the same serializer and share one verify criterion, and the split buys no separate checkpoint since Step 2's verify can assert nothing until Step 3 lands; one fewer step (plan.md:52, plan.md:60).

Cold re-derivation: clean
```

## Don't Rationalize

- "The plan looks thorough" — thoroughness is evidence of effort, not of necessity. Price each piece against the Problem Statement.
- "Removing this feels risky" — name what breaks. An unnamed risk is not a reason to keep a step, and naming it is the fastest way to find out whether it is real.
- "This pass had nothing to say" — then it prints its `No challenge` line. An omitted pass is indistinguishable from one that never ran.
- "There's a cleaner way to build this" — that is a redesign, not a challenge. One sentence naming the shape, then route to `plan-task`.
- "Everything is justified" — say why, per pass, against the problem. A blanket clearance is the rubber stamp this skill exists to replace.

## Verification

Confirm the protocol invariants before finishing — below the size bar, only the first two apply:

- [ ] `CONTEXT.md`, `goals.md`, and `plan.md` read in full (plus `ticket.md` when present) before any pass ran
- [ ] The step count tested against § *The Size Bar* before the first pass; below it, the one `Not challenged` line was the whole output, unless the user asked for the challenge anyway
- [ ] All three passes rendered in order, each carrying findings, its `No challenge` line, or — framing only — its `Skipped` line
- [ ] Every finding names what could be dropped, collapsed, or deferred, what its absence would cost against the Problem Statement, and a `file:line` citation
- [ ] Every printed finding cleared both bar tests and names the yardstick it won on; every candidate failing either test was discarded silently rather than hedged
- [ ] Yardstick claims on new dependencies/patterns or blast radius carry repo-relative code citations
- [ ] The cold re-derivation launched exactly when the travelling inputs recorded no chosen direction, on a prompt carrying the Problem Statement, `ticket.md` when present, and `goals.md` verbatim and nothing from `plan.md` or the Recommended Direction
- [ ] Every divergence it raised went through both bar tests, and those that failed are absent from the output — findings, hedges, and the outcome line alike
- [ ] Exactly one `Cold re-derivation:` line, last in the output, in one of the three forms
- [ ] Every finding is a necessity claim; gaps, vague goals, and pattern conflicts left to `review-task`
- [ ] Nothing written — no file in the task folder created or modified, no alternative design authored, any materially different shape named in one sentence and routed to `plan-task`
