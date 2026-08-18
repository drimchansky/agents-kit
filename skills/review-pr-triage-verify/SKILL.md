---
name: review-pr-triage-verify
description: Use when asked for a verified review of a PR or branch — one command that reviews the diff against its base, batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[-x (cross-vendor second review)] [-p (parallel lens probes)] [-d (draft PR description)] — passed through to the review phase'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the full review pipeline: review the current branch against its base (`review-pr`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, uncolored by the session that wrote the findings. The final display is the triage frame with one verdict per finding.

Each phase executes its skill file — read the sibling `SKILL.md` and run its full protocol. Three overrides apply pipeline-wide, to every phase:

- **Core Rules blocks** — the composite's own block above covers the pipeline; inner skills' AGENTS.md read is already satisfied and doesn't repeat.
- **Chat display** — findings render once, in the final Output; phases print only what their section below allows.
- **Next pointers** — inner skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where its own section below says so — never by improvisation.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, posts to the PR, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end.

## Flags

`-x` (cross-vendor second review), `-p` (parallel lens probes), and `-d` (draft PR description) pass through to the review phase unchanged — see `../review-pr/SKILL.md`. The per-batch verify probes are neither `-x` nor `-p`: they run on the native engine regardless, and they verify batches after the review rather than reviewing the diff during it. The review phase runs its verification scripts as that skill specifies (always), and a script finding reaches the probes like any other — but they never re-run the check that produced it: a lint or type failure re-verifies by reading; a test failure usually can't, and lands **Inconclusive**.

## Setup

Resolve the base branch per `../review-pr/SKILL.md`'s Setup, and hand it to phase 1 so it isn't resolved twice — the check below needs it.

Then confirm the working tree carries no uncommitted change — staged, unstaged, or untracked — to a path the branch touches: no path from the reviewed set `git diff --name-only <base>...HEAD` appears in the working-tree change set, the union of `git diff HEAD --name-only` (every tracked change, either side of the index) and `git ls-files --others --exclude-standard` (untracked files, including a reviewed path deleted on the branch but re-created untracked in the tree). The phase-3 probes read the live tree, so an uncommitted edit — or an untracked re-creation — at a reviewed path means they verify content the branch's diff never carried.

This is a precondition, not a drift check: mid-work edits make it false from the first moment. Catching it here costs nothing; catching it at phase 3 would waste the whole review, and with `-x` a cross-vendor probe with it. Fails → stop, name the diverging paths, and say they need committing or stashing first. Passing here is also what makes phase 3's re-run a genuine drift check.

`/review-pr` alone carries no such constraint — it reads committed history, never the tree. This one belongs to the verify phase, so it binds only this composite.

## Phase 1 — Review

Execute `../review-pr/SKILL.md` end to end against the current branch, on Setup's already-resolved base. As the phase completes, print its **Summary** and its **Reviewed** provenance line; hold the findings and remaining sections for the final Output. If a later phase fails hard, print the held findings before stopping — the review is never lost to a dead pipeline.

**No findings** → phases 2–3 are vacuous: skip them and render the Output without **Batches**, its Verified line reading `Verified: no findings to verify`.

## Phase 2 — Triage

Execute `../triage-findings/SKILL.md` with the source pinned to the phase-1 findings — no PR-comment merge, no other sources; a merged triage is the manual chain's job. Expect everything **open** (the code hasn't changed since the review); the classify step still applies, and anything landing outside open keeps its bucket into the final display. Print one progress line — the concern zones and their counts — and hold the batch detail for the final Output.

## Phase 3 — Verify

First re-confirm the reviewed identity: `git rev-parse HEAD` still matches the reviewed head, the merge-base recomputed against Setup's base still matches the reviewed merge-base (both halves of the Reviewed line, the same re-check `publish-pr-review` runs), and Setup's working-tree check still passes. All three held when the review started, so a mismatch now is genuine drift — something moved under the pipeline. Any → stop and report: probes read the live tree, verdicts against a moved tree describe code the review didn't see, and a moved merge-base means the reviewed diff is no longer the branch's diff.

Fan out per `./references/workflow/agent-fanout.md` — its probe contract and merge contract bind, with engines and prompt shapes per `./references/workflow/probe-engines.md` here; this skill is a registered consumer. One probe per batch on the **native** engine, launched in parallel — a zone's findings share one investigation context; merging two small zones into one probe is fine when their concerns overlap. Default to probing every finding, because a wrong minor finding still costs the author time; on a large review, scoping probes to Major/Critical is fair economy — scoped-out findings take the verdict `Unverified (out of probe scope)`.

Each probe prompt follows the **verify shape** in the Probe prompt skeleton of `./references/workflow/probe-engines.md`: self-contained, carrying the batch's findings verbatim, the reviewed diff (`<base>...HEAD`, on Setup's resolved base) as the review object, and the absolute path of this skill's sibling `../verify-issue/SKILL.md` for the probe to apply. Without the diff a probe judges a finding about the change — a dropped guard, a regressed default — against current contents that look correct in isolation.

**Merge** per the fan-out merge contract, plus one turn specific to this composite: a probe's **Not an issue** contradicts the session's own review — re-check that spot before accepting it. Accepted → the finding is **Withdrawn**, displayed with the probe's evidence, out of scope for `publish-pr-review`. Rejected → the finding stands, with a note on what the probe missed. Never silently drop either way. A finding the probe surfaces on its own — `verify-issue`'s scope step routinely turns up the same pattern elsewhere — is a candidate per that contract, not a verdict: verify it against the reviewed diff, then adopt it into its batch's zone as an open finding, verdict and all, so **Batches**, **Findings** at Major/Critical, and the **Verified** count all carry it like any other.

**Degrade**: a probe that has failed or died never blocks the pipeline — verify that batch inline by the same `verify-issue` protocol and mark its verdicts `verified inline (probe failed: <reason>)`. Slowness alone is not failure, per the probe contract: a probe still making progress is waited on with its status reported, and calling a stalled one off is the user's decision — a called-off batch verifies inline the same way, marked `verified inline (probe called off)`. Inline verdicts lose the cold-eyes property; the mark keeps that visible.

## Output

Lists, never tables.

- **Summary** — what changed, intent, and the overall assessment (approve / request changes / needs discussion) restated after verification — verdicts are evidence and may move it; the session owns the final call.
- **Batches** — the triage frame: one section per concern zone, ordered by its most severe member. Each finding renders once: original text with its severity prefix, `file:line` (or the diff-wide scope when it has no anchor), then its verdict — **Confirmed** (root cause, plus fix options targeted → thorough), **Withdrawn** (the probe's evidence), **Inconclusive** (what's missing), or **Unverified** (reason: probe and fallback failed, or out of probe scope) — or, for a finding triage landed outside open, its bucket in place of a verdict.
- **Findings** — the publishable list, in `review-pr`'s Findings format: every surviving Major/Critical finding — verdict Confirmed, Inconclusive, or Unverified — with its severity, `file:line`, and original text verbatim. A verdict other than Confirmed rides along as a closing note on the entry — `(Inconclusive: <what's missing>)` / `(Unverified: <reason>)` — and counts as part of the finding's text downstream, so `/publish-pr-review` posts the caveat with the claim instead of giving an unsettled finding a confirmed one's authority. Withdrawn findings are excluded here; their evidence lives in Batches. This is the section `/publish-pr-review` consumes; write `none` when nothing survives — that's what makes the follow-up post an approval.
- **Verified** — one mandatory line: `Verified: <n> confirmed · <n> withdrawn · <n> inconclusive · <n> unverified — <k> native probes`. Two segments are conditional: ` · <n> triaged out` joins the counts only when triage landed findings outside open — the **addressed** and **verify** buckets both, since neither got a verdict here — and `, <m> inline fallbacks` joins the probe count only when a batch was verified inline (probe failed or called off). Mandatory so a skipped or failed verify phase is visible rather than ambiguous.
- **Cross-check** (only with `-x`), **Lens probes** (only with `-p`), **Improvements**, **Inaccessible context** (only if any), **PR description** (only with `-d`) — forwarded from the review phase as `review-pr` specs them. Improvements are non-blocking suggestions, not findings — they pass through unverified.
- **Reviewed** — the provenance line exactly as `review-pr` specs it, so `/publish-pr-review` can anchor: `Reviewed at <head-sha> (merge-base <base-sha>) by <model>`.

**Next:** `/publish-pr-review` posts the **Findings** list above — Withdrawn are already excluded from it, and `none` posts as a short approval. With `-d`, `/update-pr-description` applies the drafted **PR description** to the PR. Or address the batches with `/implement-task` or `/review-commit`.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Each phase ran from its skill file (`review-pr`, `triage-findings`, probes on `verify-issue`) — none improvised from memory
- [ ] Setup's working-tree check ran before the review, and it plus the head and merge-base still held at the probes — or the pipeline stopped and said so
- [ ] Every finding renders exactly once in Batches — open ones with exactly one verdict, non-open ones with their triage bucket; none dropped, Withdrawn ones included with evidence
- [ ] Every batch covered by a probe (merged small zones count) or a flagged inline fallback; prompts carried the findings verbatim; probes read-only per the fan-out contract
- [ ] Output carries the Reviewed line, the mandatory Verified line, and the Findings list (surviving Major/Critical only — Withdrawn excluded, non-Confirmed verdicts noted on their entries)
- [ ] Nothing edited, nothing posted — the pipeline-wide read-only guarantee held
