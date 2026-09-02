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

`-x` (cross-vendor second review) passes through to the review phase — see `../review-commit/SKILL.md` — with one suppression: the review phase collects the probe and records its `Cross-check:` line, but does not verify its novel candidates; phase 3 does, once, as for every finding the review hands forward. The rest of what a review-phase flag carries into this pipeline is `./references/workflow/verify-pipeline.md` § *Flags through the review phase*.

## Setup

Before phase 1, confirm the working tree agrees with the index on every staged path: no path from the staged set `git diff --cached --name-only` also appears in the working-tree-divergence set — the union of `git diff --name-only` (tracked paths whose working-tree content differs from the index) and `git ls-files --others --exclude-standard` (untracked files, e.g. a staged path deleted from the index but re-created untracked in the tree). A path in both is partially staged — `git add -p`, an edit made after staging, or an untracked re-creation of a staged-deleted path — and the phase-3 probes read the live working tree, so they would verify content the staged diff never carried.

That is this composite's instance of the shared tree-agreement precondition — its standing, what catching it early buys, and why `/review-commit` alone carries no such constraint are `./references/workflow/verify-pipeline.md` § *The tree-agreement precondition*. The diverging paths named on a failure here need staging or stashing first. A caller that stages the whole change immediately before invoking it satisfies the check by construction — tree and index then agree on every staged path — so what the check bites on is a run over a partly staged tree, which is the case it exists to catch.

## Phase 1 — Review

Run it per `./references/workflow/verify-pipeline.md` § *The review phase*, which owns the delegated pass and its fallback, the suppressed standalone settle — the two intake checks of `./references/workflow/reviewer-contract.md` § *The settle* still run first — and the no-findings shortcut. The review skill is `../review-commit/SKILL.md`, executed end to end against the object its Setup resolves — the staged diff; an empty object means inform the user and stop, per that same Setup. The two lines this phase prints are its **Reviewed** provenance line and its **Review pass** line.

## Phase 2 — Triage

`./references/workflow/verify-pipeline.md` § *The triage phase* is the whole of it, run over the findings phase 1 held.

## Phase 3 — Verify

First re-confirm the reviewed identity, both halves of it: recompute the staged-set digest (`git diff --cached | git hash-object --stdin`) and check it still matches **this run's own** Reviewed line — the one phase 1 printed — and re-run Setup's working-tree check. Both held when the review started, so a mismatch now is genuine drift — the index or the tree moved under the pipeline. Either → stop and report: probes read the live working tree, and a moved index or tree verifies code the review didn't see.

This skill fans out under `./references/workflow/agent-fanout.md`, `./references/workflow/probe-engines.md`, and `./references/workflow/probe-shape-verify.md`. Fan out, merge, and degrade per `./references/workflow/verify-pipeline.md`, handing every probe prompt the staged diff (`git diff --cached`) as its **review object**, the way `../review-commit/SKILL.md` hands it to its own `-x` probe: named concretely in the prompt, so the probe assembles the same object at the repo root. It is load-bearing here above all: an uncommitted change is in no commit, so a probe not handed it sees the tree as undifferentiated code and cannot judge what the change added, dropped, or left out. One addition to the merge: a **Withdrawn** finding no longer blocks the handoff at **Next**.

## Output

Lists, never tables.

- **Batches** and **Verified** — as `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* specs them, `Batches` here taking the diff-wide scope as its no-anchor locator.
- **Cross-check** (only with `-x`) — forwarded from the review phase as `review-commit` specs it.
- **Reviewed** — the provenance line exactly as `review-commit` specs it, so `/commit` can confirm the set it commits is still the set reviewed: `Reviewed <digest> (<n> files) by <model> <effort>`.
- **Review pass** and **Divergence** — forwarded from the review phase exactly as `review-commit` specs each, on the terms `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* adds.
- **Commit message** — the drafted message exactly as `review-commit` specs it (imperative first line, project conventions, no AI attribution): the session's own draft on either pass, since that skill owns the drafting whatever ran the review pass. It describes the change, not the findings, so it passes through unverified.

**Next:** once the surviving findings are addressed — Withdrawn ones don't block — run `/commit` to create the commit with this message.

## Verification

Confirm `./references/workflow/verify-pipeline.md` § *Shared checklist* — its phases here are `review-commit`, `triage-findings`, and probes on `verify-issue`, and its read-only item covers staging and committing — plus these:

- [ ] Setup's working-tree check ran before the review, and it plus the staged digest still held at the probes — or the pipeline stopped and said so
- [ ] Output carries the Reviewed line, the `Review pass:` line, and the commit message, with **Next** pointing at `/commit`
