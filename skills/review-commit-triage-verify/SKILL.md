---
name: review-commit-triage-verify
description: Use when asked for a verified review of staged changes — one command that reviews the staged diff (or, with -w, the whole uncommitted change), batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding plus the drafted commit message. Reads and displays only; never edits code, never stages, never commits.
argument-hint: '[-w (review the uncommitted change instead of the index)] [-x (cross-vendor second review)] — both passed through to the review phase'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the pre-commit pipeline: review the staged diff (`review-commit`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, uncolored by the session that wrote the findings. The final display is the triage frame with one verdict per finding, plus the drafted commit message, which the default path hands to `/commit` and `-w` does not.

Each phase executes its skill file — read the sibling `SKILL.md` and run its full protocol. Three overrides apply pipeline-wide, to every phase:

- **Core Rules blocks** — the composite's own block above covers the pipeline; inner skills' AGENTS.md read is already satisfied and doesn't repeat.
- **Chat display** — findings render once, in the final Output; phases print only what their section below allows.
- **Next pointers** — inner skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where its own section below says so — never by improvisation.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, stages anything, creates the commit, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end. The commit itself stays with `/commit`.

## Flags

`-w` (review the uncommitted change instead of the index) passes through to the review phase unchanged — see `../review-commit/SKILL.md`, which resolves the object against `./references/engineering/review.md` § *Working-tree review target*. Everything downstream in this pipeline follows that object: Setup below, phase 3's identity re-check, and the probes' review object. Nothing is staged under it, so the composite's **Next** changes too.

`-x` (cross-vendor second review) passes through to the review phase unchanged — see `../review-commit/SKILL.md`. The per-batch verify probes are not `-x`: they run on the native engine regardless. The review phase runs its verification scripts as that skill specifies (always), and a script finding reaches the probes like any other — but they never re-run the check that produced it: a lint or type failure re-verifies by reading; a test failure usually can't, and lands **Inconclusive**.

## Setup

Before phase 1, confirm the working tree agrees with the index on every staged path: no path from the staged set `git diff --cached --name-only` also appears in the working-tree-divergence set — the union of `git diff --name-only` (tracked paths whose working-tree content differs from the index) and `git ls-files --others --exclude-standard` (untracked files, e.g. a staged path deleted from the index but re-created untracked in the tree). A path in both is partially staged — `git add -p`, an edit made after staging, or an untracked re-creation of a staged-deleted path — and the phase-3 probes read the live working tree, so they would verify content the staged diff never carried.

This is a precondition, not a drift check: it can be false from the first moment. Catching it here costs nothing; catching it at phase 3 would waste the whole review. Fails → stop, name the diverging paths, and say they need staging or stashing first. Passing here is also what makes phase 3's re-run a genuine drift check.

`/review-commit` alone carries no such constraint — it reads the index, never the tree. This one belongs to the verify phase, so it binds only this composite.

**Under `-w` this precondition does not run at all** — and its absence is not a relaxation. It guards against the probes reading a tree that diverges from the review object; when the review object *is* the live tree, per the cited contract, that divergence class cannot occur. There is nothing to stage or stash, and a partially-staged tree is an ordinary `-w` review rather than a refusal.

## Phase 1 — Review

Execute `../review-commit/SKILL.md` end to end against the object its Setup resolves — the staged diff, or the working-tree target under `-w`. An empty object means inform the user and stop, per that same Setup. As the phase completes, print its **Reviewed** provenance line; hold the findings, Cross-check, and the drafted commit message for the final Output. If a later phase fails hard, print the held sections before stopping — the review is never lost to a dead pipeline.

**No findings** → phases 2–3 are vacuous: skip them and render the Output without **Batches**, its Verified line reading `Verified: no findings to verify`.

## Phase 2 — Triage

Execute `../triage-findings/SKILL.md` with the source pinned to the phase-1 findings — no PR-comment merge, no other sources; a merged triage is the manual chain's job. Expect everything **open** (the code hasn't changed since the review); the classify step still applies, and anything landing outside open keeps its bucket into the final display. Print one progress line — the concern zones and their counts — and hold the batch detail for the final Output.

## Phase 3 — Verify

First re-confirm the reviewed identity, both halves of it: recompute the staged-set digest (`git diff --cached | git hash-object --stdin`) and check it still matches the Reviewed line, and re-run Setup's working-tree check. Both held when the review started, so a mismatch now is genuine drift — the index or the tree moved under the pipeline. Either → stop and report: probes read the live working tree, and a moved index or tree verifies code the review didn't see.

**Under `-w` this is one half, not two.** Recompute the identity digest the cited contract defines and check it against **this run's own** Reviewed line — the one captured at this pass's review start, never one carried from an earlier pass of an outer loop, which the contract scopes within-pass precisely because a fix phase is expected to move the tree between passes. Setup's working-tree check has no `-w` counterpart to re-run, having never run. A mismatch is the same drift and the same stop.

Fan out per `./references/workflow/agent-fanout.md` — its probe contract, engine registry, and merge contract all bind here; this skill is a registered consumer. One probe per batch on the **native** engine, launched in parallel — a zone's findings share one investigation context; merging two small zones into one probe is fine when their concerns overlap. Default to probing every finding, because a wrong minor finding still costs the author time; on a large review, scoping probes to Major/Critical is fair economy — scoped-out findings take the verdict `Unverified (out of probe scope)`.

Each probe prompt follows the **verify shape** in the Probe prompt skeleton of `./references/workflow/agent-fanout.md`: self-contained, carrying the batch's findings verbatim, the phase-1 review object, and the absolute path of this skill's sibling `../verify-issue/SKILL.md` for the probe to apply. That object is the staged diff (`git diff --cached`) by default and the working-tree target under `-w`, handed the way `../review-commit/SKILL.md` hands it to its own `-x` probe — quoted from the cited contract, never recalled. It is load-bearing here above all: an uncommitted change is in no commit, so a probe not handed it sees the tree as undifferentiated code and cannot judge what the change added, dropped, or left out.

**Merge** per the fan-out merge contract, plus one turn specific to this composite: a probe's **Not an issue** contradicts the session's own review — re-check that spot before accepting it. Accepted → the finding is **Withdrawn**, displayed with the probe's evidence — it no longer blocks the handoff at **Next**. Rejected → the finding stands, with a note on what the probe missed. Never silently drop either way. A finding the probe surfaces on its own — `verify-issue`'s scope step routinely turns up the same pattern elsewhere — is a candidate per that contract, not a verdict: verify it against the phase-1 review object, then adopt it into its batch's zone as an open finding, verdict and all, so **Batches** and the **Verified** count carry it like any other.

**Degrade**: a probe that has failed or died never blocks the pipeline — verify that batch inline by the same `verify-issue` protocol and mark its verdicts `verified inline (probe failed: <reason>)`. Slowness alone is not failure, per the probe contract: a probe still making progress is waited on with its status reported, and calling a stalled one off is the user's decision — a called-off batch verifies inline the same way, marked `verified inline (probe called off)`. Inline verdicts lose the cold-eyes property; the mark keeps that visible.

## Output

Lists, never tables.

- **Batches** — the triage frame: one section per concern zone, ordered by its most severe member. Each finding renders once: original text with its severity prefix, `file:line` (or the diff-wide scope when it has no anchor), then its verdict — **Confirmed** (root cause, plus fix options targeted → thorough), **Withdrawn** (the probe's evidence), **Inconclusive** (what's missing), or **Unverified** (reason: probe and fallback failed, or out of probe scope) — or, for a finding triage landed outside open, its bucket in place of a verdict.
- **Verified** — one mandatory line: `Verified: <n> confirmed · <n> withdrawn · <n> inconclusive · <n> unverified — <k> native probes`. Two segments are conditional: ` · <n> triaged out` joins the counts only when triage landed findings outside open — the **addressed** and **verify** buckets both, since neither got a verdict here — and `, <m> inline fallbacks` joins the probe count only when a batch was verified inline (probe failed or called off). Mandatory so a skipped or failed verify phase is visible rather than ambiguous.
- **Cross-check** (only with `-x`) — forwarded from the review phase as `review-commit` specs it.
- **Reviewed** — the provenance line exactly as `review-commit` specs it, so `/commit` can confirm the set it commits is still the set reviewed: `Reviewed <digest> (<n> files) by <model> <effort>`. Under `-w` it carries that skill's marked form instead, field for field: `Reviewed (working tree) <digest> (<n> files) by <model> <effort>` — which `/commit` refuses rather than compares.
- **Commit message** — the drafted message exactly as `review-commit` specs it (imperative first line, project conventions, no AI attribution), under `-w` with that skill's note that it describes the reviewed tree rather than the index. It describes the change, not the findings, so it passes through unverified.

**Next:** once the surviving findings are addressed — Withdrawn ones don't block — run `/commit` to create the commit with this message.

Under `-w`, **Next** is `review-commit -w`'s handoff instead: nothing here was staged, so there is no commit to create. Stage what you intend to commit, run `/review-commit` (no flag) over that index, then `/commit`.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Each phase ran from its skill file (`review-commit`, `triage-findings`, probes on `verify-issue`) — none improvised from memory
- [ ] Setup's working-tree check ran before the review, and it plus the staged digest still held at the probes — or the pipeline stopped and said so. Under `-w`: that check was correctly skipped, and this pass's own working-tree identity digest still held at the probes
- [ ] Every finding renders exactly once in the final Output — open ones with exactly one verdict, non-open ones with their triage bucket; none dropped, Withdrawn ones included with evidence
- [ ] Every batch covered by a probe (merged small zones count) or a flagged inline fallback; prompts carried findings verbatim; probes read-only per the fan-out contract
- [ ] Output carries the Reviewed line — the `(working tree)`-marked form under `-w`, the plain form otherwise — the mandatory Verified line, and the commit message, with **Next** pointing at `/commit` only in the plain case
- [ ] Nothing edited, nothing staged, nothing committed — the pipeline-wide read-only guarantee held
