---
name: review-pr-triage-verify
description: Use when asked for a verified review of a PR or branch — one command that reviews the diff against its base, batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[-x (cross-vendor second review)] [-p (parallel lens probes + gap sweep)] [-d (draft PR description)] — passed through to the review phase'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the full review pipeline: review the current branch against its base (`review-pr`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, uncolored by the session that wrote the findings. The final display is the triage frame with one verdict per finding.

`./references/workflow/verify-pipeline.md` owns the mechanics this pipeline shares with the kit's other verify composites — the pipeline-wide overrides every phase runs under among them. Read it; the sections below carry only what is specific to this one.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, posts to the PR, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end.

## Flags

`-x` (cross-vendor second review), `-p` (parallel lens probes), and `-d` (draft PR description) pass through to the review phase — see `../review-pr/SKILL.md` — with one suppression: under this composite the review phase does not launch the verify probes that would settle `-p`'s candidates (`./references/workflow/agent-fanout.md` § *Merge contract*), since phase 3 verifies every finding the review hands forward, probe-sourced ones included, and settling one twice pays twice for the same verdict. The suppression is unconditional: a finding phase 3 later scopes out of probe range takes `Unverified (out of probe scope — candidate never settled)`, so a suppressed settle is never read as a probe-budget call. Those candidates still merge as candidates — pooled by location as the lens-review shape's own merge step — and reach the batches like any other finding. The per-batch verify probes are neither `-x` nor `-p`: they run on the native engine regardless, and they verify batches after the review rather than reviewing the diff during it. The review phase runs its verification scripts as that skill specifies (always), and a script finding reaches the probes like any other — but they never re-run the check that produced it: a lint or type failure re-verifies by reading; a test failure usually can't, and lands **Inconclusive**.

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

Fan out, merge, and degrade per `./references/workflow/verify-pipeline.md` § *Fan-out and probes* and § *Merge and degrade*, under the probe and merge contracts of `./references/workflow/agent-fanout.md`, with engines per `./references/workflow/probe-engines.md` and the verify shape in `./references/workflow/probe-shape-verify.md`; this skill is a registered consumer of each.

The **review object** every probe prompt carries is the reviewed diff, `<base>...HEAD` on Setup's resolved base. Two additions to the merge: a **Withdrawn** finding is out of scope for `publish-pr-review`, and an adopted probe candidate enters the publishable list its own severity names — **Findings** at Major/Critical, **Minor findings** at Minor — besides **Batches** and the **Verified** count.

## Output

Lists, never tables.

- **Summary** — what changed, intent, and the overall assessment (approve / request changes / needs discussion) restated after verification — verdicts are evidence and may move it; the session owns the final call.
- **Batches** and **Verified** — as `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* specs them, `Batches` here taking the diff-wide scope as its no-anchor locator; with `-p`, an out-of-probe-scope verdict carries the annotation the Flags section fixes.
- **Findings** — the publishable list, in `review-pr`'s Findings format: every surviving Major/Critical finding — verdict Confirmed, Inconclusive, or Unverified — with its severity, `file:line`, and original text verbatim. A verdict other than Confirmed rides along as a closing note on the entry — `(Inconclusive: <what's missing>)` / `(Unverified: <reason>)` — and counts as part of the finding's text downstream, so `/publish-pr-review` posts the caveat with the claim instead of giving an unsettled finding a confirmed one's authority. Withdrawn findings are excluded here; their evidence lives in Batches. `/publish-pr-review` consumes this section and **Minor findings** below, one severity tier each; write `none` when nothing survives — a `none` here is what lets the follow-up approve rather than request changes.
- **Minor findings** — the same publishable list at Minor severity, in `review-pr`'s Findings format and under the Findings rules above: every surviving Minor — verdict Confirmed, Inconclusive, or Unverified — with its severity, `file:line`, and original text verbatim, a non-Confirmed verdict riding along as the same closing note (`(Inconclusive: <what's missing>)` / `(Unverified: <reason>)`) and counting as part of the finding's text downstream for the same reason. `(Unverified: out of probe scope)` is that note where a large set had the probes scoped to Major/Critical, and it travels like any other. Withdrawn findings are excluded here too; their evidence lives in Batches. Minors are listed individually and never capped, exactly as `review-pr` carries them — a collapsed block is a tier the follow-up cannot count. Write `none` when no Minor survives.
- **Cross-check** (only with `-x`), **Lens probes** (only with `-p`), **Improvements**, **Inaccessible context** (only if any), **PR description** (only with `-d`) — forwarded from the review phase as `review-pr` specs them. Improvements are non-blocking suggestions, not findings — they pass through unverified.
- **Reviewed** — the provenance line exactly as `review-pr` specs it, so `/publish-pr-review` can anchor: `Reviewed at <head-sha> (merge-base <base-sha>) by <model>`.

**Next:** `/publish-pr-review` offers the **Findings** and **Minor findings** lists above, and **Improvements**, as severity tiers and posts the one you select — Withdrawn are already excluded from both lists, and with nothing in any of them it posts a short approval instead of asking. With `-d`, `/update-pr-description` applies the drafted **PR description** to the PR. Or address the batches with `/implement-task` or `/review-commit`.

## Verification

Confirm `./references/workflow/verify-pipeline.md` § *Shared checklist* — its phases here are `review-pr`, `triage-findings`, and probes on `verify-issue`, and its read-only item covers posting to the PR — plus these:

- [ ] Setup's working-tree check ran before the review, and it plus the head and merge-base still held at the probes — or the pipeline stopped and said so
- [ ] Output carries the Reviewed line, the Findings list (surviving Major/Critical) and the Minor findings list (surviving Minors) — Withdrawn excluded from both, non-Confirmed verdicts noted on their entries, neither list capped or collapsed
