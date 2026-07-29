# Skill Conventions: How Behavior Varies

The kit varies a skill's behavior two ways — a **composite** skill that runs phases in order, and a
single-letter **flag** on one skill. **This file is the single source of truth for which mechanism a
given behavior takes.** When a new behavior is added, or an existing one is reclassified, decide it
here first and propagate to the skills. Everything else about a skill — its protocol, its output, its
write surface — lives in the skill file; this file only rules on the *shape* the variation takes.

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
cap, the exit criterion, and the per-pass display economy live in the composite's own file. Iteration
adds one decision a linear composite never faces — which passes receive a forwarded flag — and the
composite states that policy in its Flags section. A write surface likewise doesn't decide the
shape — per this file's intro it lives in the skill files: code edits with the member that performs
them, the between-pass `git add` with the composite that owns that departure.
`review-commit-fix-loop`, the first iterated composite, is thus also the kit's first composite that
writes.

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
- `maintain` — format sweep, then index refresh, then reconcile the active tasks.
- `resume-task-reconcile` — print the resume brief, then reconcile the docs to it.
- `review-task-reconcile` — print the plan assessment, then reconcile the docs and fold in answers.
- `decompose-task` — propose the cut of an approved source into ordered sibling parts, then materialize each confirmed part (`prepare-ticket` per part + a seeded `CONTEXT.md`).
- `review-commit-fix-loop` — iterated: review the staged diff (`review-commit-triage-verify`), fix the Confirmed findings (`fix-findings`), re-stage, review again — until a pass confirms no major/critical or 3 passes have run. The kit's one composite that writes: code edits via its fix phase, `git add` of fix-touched paths between passes.

A composite passes a phase's own modal flags through to that phase unchanged — the flags below stay
where they are rather than being re-implemented at the pipeline level.

### Modal flags — interleaved behavior

- `-x` cross-vendor probe (`review-pr`, `review-commit`, `review-docs`, `review-task`) — the probe
  merges into the pass *before* its verdicts finalize, so it has no seam to run after.
- `-v` run verifications (`review-pr`, `review-commit`) — the checks run *inside* the review, and
  what they turn up becomes findings the review handles like any other.
- `-d` draft PR description (`review-pr`) — built from the change map the review has already
  assembled; a separate phase would rebuild it from scratch.
- `-p` parallel lane (`implement-task`) — an execution strategy *within* the execute phase, choosing
  which steps run concurrently. It reorders work inside a phase; it is not a phase.

## Adding a behavior

1. Run the diagnostic above and classify it.
2. Composite → a new skill folder whose phases execute the sibling skill files, with the pipeline-wide
   overrides the existing composites carry (one Core Rules block, one Output, the composite owning
   **Next**). Flag → document it in the host skill's `Flags` section and its `argument-hint`.
3. Record it under **Current members** here.
