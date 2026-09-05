---
name: review-pr-triage-verify
description: Use when asked for a verified review of a PR or branch — one command that reviews the diff against its base, batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[-x (cross-vendor second review)] [-p (parallel lens probes + gap sweep)] [-d (draft PR description)] — passed through to the review phase'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the full review pipeline: review the current branch against its base (`review-pr`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, uncolored by the session that wrote the findings. The final display is the triage frame with one verdict per finding.

`./references/workflow/verify-pipeline.md` owns the mechanics this pipeline shares with the kit's other verify composite — the pipeline-wide overrides every phase runs under among them. Read it; the sections below carry only what is specific to this one.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, posts to the PR, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end.

## Flags

`-x` (cross-vendor second review), `-p` (parallel lens probes), and `-d` (draft PR description) pass through to the review phase — see `../review-pr/SKILL.md` — with one suppression, applied to both probe flags: under this composite the review phase does not launch the verify probes that would settle `-p`'s candidates, and does not verify the `-x` probe's novel candidates on its own read (`./references/workflow/agent-fanout.md` § *Merge contract*), since phase 3 verifies every finding the review hands forward, probe-sourced ones included, and settling one twice pays twice for the same verdict. The suppression is unconditional: a finding phase 3 later scopes out of probe range takes `Unverified (out of probe scope — candidate never settled)`, so a suppressed settle is never read as a probe-budget call. Those candidates still merge as candidates — pooled by location as the lens-review shape's own merge step — and reach the batches like any other finding. The per-batch verify probes verify batches after the review rather than reviewing the diff during it. `./references/workflow/verify-pipeline.md` § *Flags through the review phase* covers what these flags carry into the pipeline beyond that suppression.

## Setup

Resolve the base branch per `../review-pr/SKILL.md`'s Setup, and hand it to phase 1 so it isn't resolved twice — the check below needs it.

Then confirm the working tree carries no uncommitted change — staged, unstaged, or untracked — to a path the branch touches: no path from the reviewed set `git diff --name-only <base>...HEAD` appears in the working-tree change set, the union of `git diff HEAD --name-only` (every tracked change, either side of the index) and `git ls-files --others --exclude-standard` (untracked files, including a reviewed path deleted on the branch but re-created untracked in the tree). The phase-3 probes read the live tree, so an uncommitted edit — or an untracked re-creation — at a reviewed path means they verify content the branch's diff never carried.

That is this composite's instance of the shared tree-agreement precondition, whose standing and whose relation to a standalone `/review-pr` run are `./references/workflow/verify-pipeline.md` § *The tree-agreement precondition*. Under `-x`, a phase-3 catch would waste a cross-vendor probe along with the review. The diverging paths named on a failure here need committing or stashing first.

## Phase 1 — Review

Run it per `./references/workflow/verify-pipeline.md` § *The review phase*, which owns the delegated pass and its fallback, the suppressed standalone settle — its two intake checks per `./references/workflow/reviewer-contract.md` § *The settle* still run first, the same trade the Flags section makes for `-p`'s candidates — and the no-findings shortcut. The review skill is `../review-pr/SKILL.md`, executed end to end against the current branch on Setup's already-resolved base. Three lines print as the phase completes: its **Summary**, its **Reviewed** provenance line, and its **Review pass** line.

With `-p`, the lens fleet still launches in this phase — after that section's two intake checks, as the sibling skill's Settle orders — and its candidates pool by location and reach phase 2 as candidates, exactly as the Flags section says; only their cold settling is suppressed.

## Phase 2 — Triage

The whole phase is `./references/workflow/verify-pipeline.md` § *The triage phase*, run over the findings phase 1 held.

## Phase 3 — Verify

First re-confirm the reviewed identity: `git rev-parse HEAD` still matches the reviewed head, the merge-base recomputed against Setup's base still matches the reviewed merge-base (both halves of the Reviewed line, the same re-check `publish-pr-review` runs), and Setup's working-tree check still passes. All three held when the review started, so a mismatch now is genuine drift — something moved under the pipeline. Any → stop and report: probes read the live tree, verdicts against a moved tree describe code the review didn't see, and a moved merge-base means the reviewed diff is no longer the branch's diff.

This skill fans out under `./references/workflow/agent-fanout.md`, `./references/workflow/probe-engines.md`, and `./references/workflow/probe-shape-verify.md`. Fan out, merge, and degrade per `./references/workflow/verify-pipeline.md`, handing every probe prompt the reviewed diff — `<base>...HEAD` on Setup's resolved base — as its **review object**. Two additions to the merge: a **Withdrawn** finding is out of scope for `publish-pr-review`, and an adopted probe candidate enters the publishable list its own severity names — **Findings** at Major/Critical, **Minor findings** at Minor — besides **Batches** and the **Verified** count.

## Output

Lists, never tables.

- **Summary** — what changed, intent, and the overall assessment (approve / request changes / needs discussion) restated after verification — verdicts are evidence and may move it; the session owns the final call.
- **Batches** and **Verified** — as `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* specs them, `Batches` here taking the diff-wide scope as its no-anchor locator; with `-p`, an out-of-probe-scope verdict carries the annotation the Flags section fixes.
- **Findings** — the publishable list, in `review-pr`'s Findings format: every surviving Major/Critical finding — verdict Confirmed, Inconclusive, or Unverified — with its severity, `file:line`, and original text verbatim. A verdict other than Confirmed rides along as a closing note on the entry — `(Inconclusive: <what's missing>)` / `(Unverified: <reason>)` — and counts as part of the finding's text downstream, so `/publish-pr-review` posts the caveat with the claim instead of giving an unsettled finding a confirmed one's authority. Withdrawn findings are excluded here; their evidence lives in Batches. `/publish-pr-review` consumes this section and **Minor findings** below, one severity tier each; write `none` when nothing survives — a `none` here is what lets the follow-up approve rather than request changes.
- **Minor findings** — the same publishable list at Minor severity, in `review-pr`'s Findings format and under the Findings rules above: every surviving Minor — verdict Confirmed, Inconclusive, or Unverified — with its severity, `file:line`, and original text verbatim, a non-Confirmed verdict riding along as the same closing note (`(Inconclusive: <what's missing>)` / `(Unverified: <reason>)`) and counting as part of the finding's text downstream for the same reason. `(Unverified: out of probe scope)` is that note where a large set had the probes scoped to Major/Critical, and it travels like any other. Withdrawn findings are excluded here too; their evidence lives in Batches. Minors are listed individually and never capped, exactly as `review-pr` carries them — a collapsed block is a tier the follow-up cannot count. Write `none` when no Minor survives.
- **Cross-check** (only with `-x`), **Lens probes** (only with `-p`), **Improvements**, **Inaccessible context** (only if any), **PR description** (only with `-d`) — forwarded from the review phase as `review-pr` specs them. Improvements are non-blocking suggestions, not findings — they pass through unverified.
- **Reviewed** — the provenance line exactly as `review-pr` specs it, so `/publish-pr-review` can anchor: `Reviewed at <head-sha> (merge-base <base-sha>) by <model>`.
- **Review pass** and **Divergence** — forwarded from the review phase exactly as `review-pr` specs each, on the terms `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* adds.

**Next:** `/publish-pr-review` offers the **Findings** and **Minor findings** lists above, and **Improvements**, as severity tiers and posts the one you select — Withdrawn are already excluded from both lists, and with nothing in any of them it posts a short approval instead of asking. With `-d`, `/update-pr-description` applies the drafted **PR description** to the PR. Or address the batches with `/implement-task` or `/fix-findings`, then `/commit`; the PR's next review pass certifies them.

## Verification

Confirm `./references/workflow/verify-pipeline.md` § *Shared checklist* — its phases here are `review-pr`, `triage-findings`, and probes on `verify-issue`, and its read-only item covers posting to the PR — plus these:

- [ ] Setup's working-tree check ran before the review, and it plus the head and merge-base still held at the probes — or the pipeline stopped and said so
- [ ] Output carries the Reviewed line and the `Review pass:` line, the Findings list (surviving Major/Critical) and the Minor findings list (surviving Minors) — Withdrawn excluded from both, non-Confirmed verdicts noted on their entries, neither list capped or collapsed
