---
name: review-commit-triage-verify
description: Use when asked for a verified review of staged changes — one command that reviews the staged diff, batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding plus the drafted commit message. Reads and displays only; never edits code, never stages, never commits.
argument-hint: '[-x (cross-vendor second review)] — passed through to the review phase'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the pre-commit pipeline: review the staged diff (`review-commit`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, uncolored by the session that wrote the findings. The final display is the triage frame with one verdict per finding, plus the drafted commit message, which the pipeline hands to `/commit`.

`./references/workflow/verify-pipeline.md` owns the mechanics this pipeline shares with the kit's other verify composites — the pipeline-wide overrides every phase runs under among them. Read it; the sections below carry only what is specific to this one.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, stages anything, creates the commit, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end. The commit itself stays with `/commit`.

## Flags

`-x` (cross-vendor second review) passes through to the review phase — see `../review-commit/SKILL.md` — with one suppression: the review phase collects the probe and records its `Cross-check:` line, but does not verify its novel candidates; phase 3 does, once, as for every finding the review hands forward. The per-batch verify probes are not `-x`: they run on the native engine regardless. The review phase runs its verification scripts as that skill specifies (always): the reviewer runs them on a delegated pass, the session on the inline fallback. A script finding reaches the probes like any other — but they never re-run the check that produced it: a lint or type failure re-verifies by reading; a test failure usually can't, and lands **Inconclusive**.

## Setup

Before phase 1, confirm the working tree agrees with the index on every staged path: no path from the staged set `git diff --cached --name-only` also appears in the working-tree-divergence set — the union of `git diff --name-only` (tracked paths whose working-tree content differs from the index) and `git ls-files --others --exclude-standard` (untracked files, e.g. a staged path deleted from the index but re-created untracked in the tree). A path in both is partially staged — `git add -p`, an edit made after staging, or an untracked re-creation of a staged-deleted path — and the phase-3 probes read the live working tree, so they would verify content the staged diff never carried.

This is a precondition, not a drift check: it can be false from the first moment. Catching it here costs nothing; catching it at phase 3 would waste the whole review. Fails → stop, name the diverging paths, and say they need staging or stashing first. Passing here is also what makes phase 3's re-run a genuine drift check.

`/review-commit` alone carries no such constraint — its review object is the index, and its verification scripts run over the tree under the divergence bar in `./references/engineering/review.md` § *Verification Scripts*, which bounds a diverging path's evidence rather than refusing the run. This one belongs to the verify phase, so it binds only this composite. A caller that stages the whole change immediately before invoking it satisfies the check by construction — tree and index then agree on every staged path — so what the check bites on is a run over a partly staged tree, which is the case it exists to catch.

## Phase 1 — Review

Execute `../review-commit/SKILL.md` end to end against the object its Setup resolves — the staged diff. An empty object means inform the user and stop, per that same Setup. Its **Review pass** runs delegated — the sibling skill's **Launch** spawns the `reviewer` subagent — and drops to the session only where that skill's **Inline fallback** says. As the phase completes, print its **Reviewed** provenance line and its **Review pass** line; hold the findings and remaining sections for the final Output. If a later phase fails hard, print the held sections before stopping — the review is never lost to a dead pipeline.

**The standalone settle is suppressed here.** The contract's two intake checks still run first (`./references/workflow/reviewer-contract.md` § *The settle*): an `Identity` mismatch stops the phase — settle nothing, launch nothing, report the mismatch as the sibling skill's **Settle** says; a malformed return (intake check 2: an absent heading, or `None` under a heading it names never-empty) does not stop it, taking that skill's **Inline fallback** with reason `reviewer failed`, the phase continuing on that inline pass so its `Review pass:` line reads `inline (reviewer failed)`. The adopt, spot-check, and final-verdict steps do not run: every finding the reviewer returned, cited or not, is held as a candidate at the severity and `file:line` the reviewer gave it and reaches phase 2 verbatim, so phase 3 gives each exactly one verdict instead of paying twice for the same one. The `-x` probe is collected in this phase and its `Cross-check:` line recorded, but the merge contract's verify-before-adopt step is suppressed the same way: its novel candidates are held beside the reviewer's at the severity and `file:line` the probe gave them and reach phase 2 as candidates, so phase 3 gives each exactly one verdict rather than one here and another there. The `Cross-check:` line reports what the probe added or contested — a contest named with the candidate it bears on; how each settled is the Verified line's.

**No findings** → phases 2–3 are vacuous: skip them and render the Output without **Batches**, its Verified line reading `Verified: no findings to verify`.

## Phase 2 — Triage

Execute `../triage-findings/SKILL.md` with the source pinned to the phase-1 findings — no PR-comment merge, no other sources; a merged triage is the manual chain's job. Expect everything **open** (the code hasn't changed since the review); the classify step still applies, and anything landing outside open keeps its bucket into the final display. Print one progress line — the concern zones and their counts — and hold the batch detail for the final Output.

## Phase 3 — Verify

First re-confirm the reviewed identity, both halves of it: recompute the staged-set digest (`git diff --cached | git hash-object --stdin`) and check it still matches **this run's own** Reviewed line — the one phase 1 printed — and re-run Setup's working-tree check. Both held when the review started, so a mismatch now is genuine drift — the index or the tree moved under the pipeline. Either → stop and report: probes read the live working tree, and a moved index or tree verifies code the review didn't see.

Fan out, merge, and degrade per `./references/workflow/verify-pipeline.md` § *Fan-out and probes* and § *Merge and degrade*, under the probe and merge contracts of `./references/workflow/agent-fanout.md`, with engines per `./references/workflow/probe-engines.md` and the verify shape in `./references/workflow/probe-shape-verify.md`; this skill is a registered consumer of each.

The **review object** every probe prompt carries is the staged diff (`git diff --cached`), handed the way `../review-commit/SKILL.md` hands it to its own `-x` probe: named concretely in the prompt, so the probe assembles the same object at the repo root. It is load-bearing here above all: an uncommitted change is in no commit, so a probe not handed it sees the tree as undifferentiated code and cannot judge what the change added, dropped, or left out. One addition to the merge: a **Withdrawn** finding no longer blocks the handoff at **Next**.

## Output

Lists, never tables.

- **Batches** and **Verified** — as `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* specs them, `Batches` here taking the diff-wide scope as its no-anchor locator.
- **Cross-check** (only with `-x`) — forwarded from the review phase as `review-commit` specs it.
- **Reviewed** — the provenance line exactly as `review-commit` specs it, so `/commit` can confirm the set it commits is still the set reviewed: `Reviewed <digest> (<n> files) by <model> <effort>`.
- **Review pass** — the line phase 1 forwards, exactly as `review-commit` specs it: `Review pass: delegated (<model>)` or `Review pass: inline (<reason>)`. Owed on either path — a pipeline output that dropped it would read like a delegated pass whatever ran.
- **Divergence** — forwarded from the review phase as `review-commit` specs it; `None` when the tree carried the object, and any non-`None` entry is an anomaly Setup's precondition should have prevented — surfaced, never dropped.
- **Commit message** — the drafted message exactly as `review-commit` specs it (imperative first line, project conventions, no AI attribution): on a delegated pass the reviewer's returned message, on the inline fallback the session's own draft. It describes the change, not the findings, so either way it passes through unverified.

**Next:** once the surviving findings are addressed — Withdrawn ones don't block — run `/commit` to create the commit with this message.

## Verification

Confirm `./references/workflow/verify-pipeline.md` § *Shared checklist* — its phases here are `review-commit`, `triage-findings`, and probes on `verify-issue`, and its read-only item covers staging and committing — plus these:

- [ ] Setup's working-tree check ran before the review, and it plus the staged digest still held at the probes — or the pipeline stopped and said so
- [ ] Phase 1 suppressed the standalone settle — no finding the reviewer or the `-x` probe returned was settled or verified there — and every one of them got exactly one verdict in phase 3, or its triage bucket
- [ ] Output carries the Reviewed line, the `Review pass:` line, and the commit message, with **Next** pointing at `/commit`
