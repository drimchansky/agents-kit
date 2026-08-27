# Skill Conventions: How Behavior Varies

The kit varies a skill's behavior two ways — a **composite** skill that runs phases in order, and a
single-letter **flag** on one skill. **This file is the single source of truth for which mechanism a
given behavior takes.** When a new behavior is added, or an existing one is reclassified, decide it
here first and propagate to the skills. Everything else about a skill — its protocol, its output, its
write surface — lives in the skill file; this file only rules on the *shape* the variation takes.

The file carries two conventions that are not variations at all: the **invocation gate** and the
**cold-citation marker**, which rule on *who may start a skill* and on *when* a file a skill cites
is loaded, rather than on how the skill behaves. Both sit here for the same reason — decided once,
then propagated to the skills.

The rule covers variations of **one skill's** behavior. Sibling skills that share a method but own
different deliverables — `implement-task` and `implement` (the same execution loop against a task
folder's plan vs. an ask framed in the session) — are two skills, not a base plus a variation, and
sit outside this file; each carries its full contract.

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
cap, the exit criterion, and the per-pass display economy live in the composite's own file. A write
surface doesn't decide the shape either — per this file's intro it lives in the skill files, with
the member that performs the edits.

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
- `review-pr-triage-verify-reconcile` — run the verified review of a PR or branch (`review-pr-triage-verify`), then append one plan step per Confirmed finding the engineer accepts to a task folder's `plan.md`, recording the append in `result.md`. Composite rather than a flag on the base pipeline: the write runs entirely after phase 3's Output is complete and printed, so there is a clean seam to split at, and the base pipeline stays whole, unaware, and read-only — its CRITICAL end-to-end read-only guarantee is what a conditional write inside it would have broken, and the "(only when a task is in play)" branches through its Setup, phase 3, Output, and checklist are this file's own tell for a misclassified flag. Its write surface is task docs only, and narrower than its `*-reconcile` siblings': `plan.md` and `result.md`, never the other two core files. Its reconcile phase is the second member of the session → docs reconciliation direction, and the one whose finding set is pinned to a producing phase rather than derived from the folder or the session.

A composite passes a phase's own modal flags through to that phase unchanged — the flags below stay
where they are rather than being re-implemented at the pipeline level.

### Modal flags — interleaved behavior

- `-x` cross-vendor engine (`review-pr`, `review-commit`, `review-docs`, `review-task`,
  `implement-task`, `implement`, `fix-findings`) — one meaning kit-wide: use the cross-vendor engine
  for this skill's fan-out, a read-only probe where the skill fans out read-only
  (`./probe-cross-check.md`) and a write-mode executor where it fans out write-mode
  (`./executor-contract.md` § *Write-mode engine registry*); the role follows the skill's fan-out
  mode, not the letter — and by the pass-through rule above, a composite's `-x` is its review
  phase's and never makes a writing phase cross-vendor. A flag on both halves: read-only, the
  probe merges into the pass *before* its verdicts finalize, so it has no seam to run after;
  write-mode, it chooses how one phase executes — which engine a unit the write-mode posture
  already delegates runs on — and changes nothing about *which* units delegate, so no consumer's
  posture and none of its exceptions move. Its own documentation is one `Flags` entry, one engine
  line, and one record field per skill; the placement, degrade, and cleanup conditionals that
  follow it into a consumer are the engine registry's, not the flag's.
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

## The invocation gate

A skill is reachable two ways: the user names it (`/<name>`), or the model reaches for it from the
description. **A skill closes the second door when it is a terminal filing or publishing step — the
act that takes finished work out of the session and puts it somewhere permanent — and carries no
confirmation gate of its own.** Where the skill already previews the act and waits for a yes, that
gate is the consent, and closing invocation would only withhold a tool the model can use safely.

**A counted choice is the second sanctioned gate form**, alongside preview-and-confirm. Where a skill
presents the act itself as a choice whose options each name the exact payload they would write and
how much of it there is, and where writing nothing is one of those options, selecting one is both the
preview and the yes — the label carries what a preview would have shown, at the granularity the
decision turns on. The enumeration is what makes it a gate, not the mechanism: a numbered list in
chat qualifies exactly as a host's structured question tool does. A choice that names options without
their payload, or payloads without their size, or that leaves no way to write nothing, is not one —
it collects a preference about a write the user has not agreed to, which is the agreement a closed
door exists to obtain. Nor is a choice of *target* — which task to file, which of several candidates
to act on: the act was settled before the question, and the answer only aims it.

**A skill also closes it when its run reaches past the current project** — across every registered
root, or into installed state — because the premise the open door rests on, that the work still
sits in front of the user where a `git diff` shows it, does not hold there. A per-change gate does
not reopen the door in that case: the gate covers what the run writes, never the sweep an unasked
run performs to decide what to write.

Closing it takes both host mechanisms together, since `setup.ts` deploys every skill to both homes:
`disable-model-invocation: true` in the SKILL.md frontmatter (Claude Code) and an
`agents/openai.yaml` carrying `policy.allow_implicit_invocation: false` beside it (Codex). One
without the other leaves the skill open on the other host.

**Gated skills:**

- `commit` — writes a commit.
- `update-pr-description` — replaces a live PR body.
- `archive-task` — files a task into `Archive/`.
- `backlog-task` — files a task into `Backlog/`.
- `maintain` — sweeps and rewrites installed state across every registered root.
- `init-config` — walks the home project parents and writes the machine's root registry.

Opening or closing a door is recorded in this list in the same change that flips the frontmatter
and the policy file; the entry, or its removal, is what keeps this list and the two host mechanisms in step.

Two skills write past the session and are deliberately **not** members. `publish-pr-review` mutates
a PR, but its step 4 is a counted choice: each severity tier it could post is offered with the
number of comments that selection would write, posting nothing is one of the options, and nothing
reaches the PR but the selection. `create-notion-page` has no such gate — it drafts and creates in
one pass — but the page lands parentless in the user's Private section, visible to them alone and
cheap to delete, and the skill never shares it or changes its permissions, so an unasked run
publishes to nobody. Every other skill either authors or changes work that still sits in front of
the user — working-tree code a `git diff` shows, task docs, a chat report — or previews and confirms
its own write, as `decompose-task` does.
Resolving a named task across the registered roots is not the reach above either: the reach is a run
that ranges over them to decide what to act on.

**Which door a run came through is read, never inferred.** A user's invocation arrives as the typed
command in the turn that opens the run — Claude Code renders it as a `<command-name>` block ahead of
the skill body. A run carrying no such marker, or running on a host that leaves the two
indistinguishable, counts as **model-invoked**: the split exists to withhold a write nobody asked
for, so an unreadable signal resolves the way that asks rather than the way that writes.

**An open skill that reads its own invocation as consent states the user/model split where it makes
that claim**, not here — `./reconciliation.md` § *Consent model* for the reconcilers,
`./executor-contract.md` § *Write-mode routing* for the write-mode consumers. Each states what the
answer buys; the test above is where they get it. This section rules on which door is closed and on
how a run tells which one it came through.

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
