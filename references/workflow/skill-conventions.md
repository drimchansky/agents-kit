# Skill Conventions: How Behavior Varies

The kit varies a skill's behavior two ways — a **composite** skill that runs phases in order, and a
single-letter **flag** on one skill. **This file is the single source of truth for which mechanism a
given behavior takes.** When a new behavior is added, or an existing one is reclassified, decide it
here first and propagate to the skills. Everything else about a skill — its protocol, its output, its
write surface — lives in the skill file; this file only rules on the *shape* the variation takes.

The file carries one convention that is not a variation at all: the **cold-citation marker** in the
last section, which rules on *when* a file a skill cites is loaded rather than on how the skill
behaves. It sits here for the same reason — decided once, then propagated to the skills.

The rule covers variations of **one skill's** behavior. Sibling skills that share a method but own
different deliverables — `refine-idea` and `refine-idea-chat` (a saved one-pager feeding `plan-task`
vs. a chat-only one) — are two skills, not a base plus a variation, and sit outside this file; each
carries its full contract.

## The rule

**Sequential phases compose; modal or interleaved behavior flags.**

Default to this because the two mechanisms have genuinely different seams. A sequential phase is a
whole unit of work with a clean boundary: the first phase's output is complete before the second
begins, so the second can live in its own file and cite the first. Modal behavior has no such
boundary — it changes what happens *inside* a phase, so pulling it into a separate file would mean
restructuring or deleting the capability rather than relocating it.

Deviate when a sequential phase is small enough that a second skill file costs more than the seam is
worth — a phase of two or three sentences that no one would invoke on its own. Say so in the skill
rather than leaving the classification implicit.

**Iteration doesn't change the shape.** A composite may repeat its phase sequence under a stated
cap — each pass is still whole phases with clean seams, so the classification stays composite; the
cap, the exit criterion, and the per-pass display economy live in the composite's own file.
`review-commit-fix-loop` is the worked example, and every one of those three is its own: three
review passes, an exit on a pass leaving no open Confirmed finding of **any** severity, and one
progress line per pass. Iteration adds one decision a linear composite never faces — which passes
receive a forwarded flag — and the composite states that policy in its Flags section. A write
surface likewise doesn't decide the shape — per this file's intro it lives in the skill files, with
the member that performs the edits. That composite, the first iterated one, is thus also the kit's
first composite that writes **code**; it writes working-tree code only and mutates no Git state. The
reconcile composites wrote before it and write still, but they write task docs.

### The diagnostic

Ask where the behavior sits relative to the base skill's protocol:

- **Runs entirely before or entirely after it**, with the base skill's output complete and printed at
  the seam → **composite**. The base skill stays whole and unaware; the composite owns the ordering.
- **Changes what happens within a phase** — merging into a pass before its verdicts finalize, running
  checks inside the review that produces findings, reusing an intermediate the phase built, or
  choosing how one phase executes → **flag**. There is nothing to split at.

The reliable tell for a misclassified flag is **conditionals scattered through the base skill**. When
a skill accumulates "(only with `-X`)" branches across its steps, output template, and checklist, the
branches are there because a separate phase is wearing a mode's clothes — the behavior wanted a
composite. A genuinely modal flag touches the one phase it modifies and nothing else.

## Current members

### Composites — sequential phases

- `review-commit-triage-verify` — review the staged diff, then batch findings, then verify each batch.
- `review-pr-triage-verify` — the same pipeline over a PR or branch diff.
- `triage-findings-verify` — findings-first: batch findings you already have, then verify each batch.
- `maintain` — format sweep, then the health sweep, then the active-task listing, then the session analysis. Every phase inline; it delegates to no skill and reconciles no task content, handing that to `resume-task-reconcile` in its **Next**. Registered for its phase ordering, not as a variation of a base skill — the one member with none, which is why step 2 below admits an inline phase.
- `resume-task-reconcile` — print the resume brief, then reconcile the docs to it.
- `review-task-reconcile` — print the plan assessment, then reconcile the docs and fold in answers.
- `decompose-task` — propose the cut of an approved source into ordered sibling parts, then materialize each confirmed part (`prepare-ticket` per part + a seeded `CONTEXT.md`).
- `review-commit-fix-loop` — iterated: review the uncommitted change (`review-commit-triage-verify -w`), fix the Confirmed findings (`fix-findings`), review again — until a pass leaves no open Confirmed finding of any severity, a fix phase applies nothing, or 3 review passes have run. The kit's one composite that writes **code**, and working-tree code only: nothing staged, nothing committed, the index never touched. Reviewing the working tree rather than the index is what lets each pass see the previous pass's fixes, the new files among them.
- `review-pr-triage-verify-reconcile` — run the verified review of a PR or branch (`review-pr-triage-verify`), then append one plan step per Confirmed finding the engineer accepts to a task folder's `plan.md`, recording the append in `result.md`. Composite rather than a flag on the base pipeline: the write runs entirely after phase 3's Output is complete and printed, so there is a clean seam to split at, and the base pipeline stays whole, unaware, and read-only — its CRITICAL end-to-end read-only guarantee is what a conditional write inside it would have broken, and the "(only when a task is in play)" branches through its Setup, phase 3, Output, and checklist are this file's own tell for a misclassified flag. Its write surface is task docs only, and narrower than its `*-reconcile` siblings': `plan.md` and `result.md`, never the other two core files. Its reconcile phase is the second member of the session → docs reconciliation direction, and the one whose finding set is pinned to a producing phase rather than derived from the folder or the session.

A composite passes a phase's own modal flags through to that phase unchanged — the flags below stay
where they are rather than being re-implemented at the pipeline level.

### Modal flags — interleaved behavior

- `-x` cross-vendor probe (`review-pr`, `review-commit`, `review-docs`, `review-task`) — the probe
  merges into the pass *before* its verdicts finalize, so it has no seam to run after.
- `-w` working-tree review target (`review-commit`) — it changes the object Setup resolves, and
  every later phase reads that same object; there is no seam to run a second skill after. Forwarded
  unchanged through `review-commit-triage-verify`, and always passed by `review-commit-fix-loop`.
- `-p` lens-probe fan-out (`review-pr`) — the probes merge into the pass *before* findings
  finalize, the same seamlessness as `-x`, and both halves of the lens set — the triggered
  per-surface checklists and the derived correctness angles — come from the change map the review
  has already built. One composite departs from the pass-through rule above:
  `review-pr-triage-verify` suppresses the cold settling of this flag's candidates, since its own
  phase 3 verifies every finding the review hands forward and would pay twice for one verdict.
- `-d` draft PR description (`review-pr`) — built from the change map the review has already
  assembled; a separate phase would rebuild it from scratch.
- `-f` fact verification (`proofread`) — verification runs inside the analysis pass, merging into
  the same errors/improvements list before it finalizes; there is no seam to split.

## Adding a behavior

1. Run the diagnostic above and classify it.
2. Composite → a new skill folder whose phases execute the sibling skill files — or run inline where
   no sibling skill owns the phase, as `maintain` does — with the pipeline-wide overrides the
   existing composites carry (one Core Rules block, one Output, the composite owning **Next**).
   Flag → document it in the host skill's `Flags` section and its `argument-hint`.
3. Record it under **Current members** here.

## Cold citations

A SKILL.md's citations are its load list, and by default every one of them is paid on every
invocation. Some are not: a file the skill opens only when a flag is set, only when a task folder is
present, only when it delegates. **A citation with the HTML comment `<!-- cold -->` on the same line
is cold — not read on the typical invocation path.** Every unmarked citation is hot, loaded the
moment the skill runs, and a skill's own SKILL.md and its core-rules citation (`AGENTS.md`) stay hot
whatever a marker says.

**The marker classifies; it never states the condition.** The condition a cold file loads on — the
flag, the file's presence, the non-default branch — is named in the prose beside the citation, which
stays its one home. A marker with nothing named beside it tells the reader a file is skippable
without telling them when, which is worse than no marker at all.

One marker governs its whole line. A line whose citations do not share a gating gets split into one
line per gating rather than half-marked, and a file cited more than once is cold only when every one
of its citations carries the marker: a single unmarked citation loads it unconditionally, so the file
is hot.

**A condition that fires on most runs is not cold.** A read at a health boundary that all but the
smallest runs reach is hot however the sentence around it is worded, and marking it buys a smaller
reported number while every run still pays the bytes. The honest fix for such a file is to split it —
the part every run reads stays hot, the part only some runs reach becomes a cold satellite, and the
marker goes on the satellite.

A cold satellite is still loaded at run time, on its condition. That makes it a different thing from
a **non-normative maintainer-notes file**, which no run loads at all: behavior lives in the runtime
files and the notes only annotate them, so a notes file carries no marker because nothing cites it as
a load. A contract's notes sibling is named `<contract>-notes.md` beside it, and is cited
root-relative on purpose: writing it as a `./` citation would drop a never-loaded file into the
measured context of every skill that reaches this file.

`scripts/size-report.ts` reads the marker and reports each skill's hot and cold sets separately, so
moving work off the hot path shows up as a number rather than a claim.
