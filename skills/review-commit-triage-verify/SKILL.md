---
name: review-commit-triage-verify
description: Use when asked for a verified review of staged changes — one command that reviews the staged diff, batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding plus the drafted commit message. Reads and displays only; never edits code, never stages, never commits.
argument-hint: '[-x (cross-vendor second review)] — passed through to the review phase'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the pre-commit pipeline: review the staged diff (`review-commit`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, uncolored by the session that wrote the findings. The final display is the triage frame with one verdict per finding, plus the drafted commit message, which the pipeline hands to `/commit`.

`./references/workflow/verify-pipeline.md` owns the mechanics this pipeline shares with the kit's other verify composites — the pipeline-wide overrides every phase runs under among them. Read it; the sections below carry only what is specific to this one.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, stages anything, creates the commit, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end. The commit itself stays with `/commit`.

## Flags

`-x` (cross-vendor second review) passes through to the review phase unchanged — see `../review-commit/SKILL.md`. The per-batch verify probes are not `-x`: they run on the native engine regardless. The review phase runs its verification scripts as that skill specifies (always), and a script finding reaches the probes like any other — but they never re-run the check that produced it: a lint or type failure re-verifies by reading; a test failure usually can't, and lands **Inconclusive**.

## Setup

Before phase 1, confirm the working tree agrees with the index on every staged path: no path from the staged set `git diff --cached --name-only` also appears in the working-tree-divergence set — the union of `git diff --name-only` (tracked paths whose working-tree content differs from the index) and `git ls-files --others --exclude-standard` (untracked files, e.g. a staged path deleted from the index but re-created untracked in the tree). A path in both is partially staged — `git add -p`, an edit made after staging, or an untracked re-creation of a staged-deleted path — and the phase-3 probes read the live working tree, so they would verify content the staged diff never carried.

This is a precondition, not a drift check: it can be false from the first moment. Catching it here costs nothing; catching it at phase 3 would waste the whole review. Fails → stop, name the diverging paths, and say they need staging or stashing first. Passing here is also what makes phase 3's re-run a genuine drift check.

`/review-commit` alone carries no such constraint — it reads the index, never the tree. This one belongs to the verify phase, so it binds only this composite. A caller that stages the whole change immediately before invoking it satisfies the check by construction — tree and index then agree on every staged path — so what the check bites on is a run over a partly staged tree, which is the case it exists to catch.

## Phase 1 — Review

Execute `../review-commit/SKILL.md` end to end against the object its Setup resolves — the staged diff. An empty object means inform the user and stop, per that same Setup. As the phase completes, print its **Reviewed** provenance line; hold the findings, Cross-check, and the drafted commit message for the final Output. If a later phase fails hard, print the held sections before stopping — the review is never lost to a dead pipeline.

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
- **Commit message** — the drafted message exactly as `review-commit` specs it (imperative first line, project conventions, no AI attribution). It describes the change, not the findings, so it passes through unverified.

**Next:** once the surviving findings are addressed — Withdrawn ones don't block — run `/commit` to create the commit with this message.

## Verification

Confirm `./references/workflow/verify-pipeline.md` § *Shared checklist* — its phases here are `review-commit`, `triage-findings`, and probes on `verify-issue`, and its read-only item covers staging and committing — plus these:

- [ ] Setup's working-tree check ran before the review, and it plus the staged digest still held at the probes — or the pipeline stopped and said so
- [ ] Output carries the Reviewed line and the commit message, with **Next** pointing at `/commit`
