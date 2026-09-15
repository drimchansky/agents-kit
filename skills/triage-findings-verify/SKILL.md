---
name: triage-findings-verify
description: Use when asked for a verified triage of findings you already have. One command gathers findings from a source (a PR's review comments, a saved or pasted list, or this session's review), batches them by concern, verifies each open batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[source: PR number/URL, file path, or pasted findings; defaults to session findings]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Findings-first pipeline: gather and batch findings you already have (`triage-findings`), then verify each **open** batch in an isolated read-only probe running the `verify-issue` protocol, one verdict per finding. There is no review phase, so the `verify` and `addressed` buckets can be populated and are shown.

`./references/workflow/verify-pipeline.md` carries the shared mechanics and the pipeline-wide overrides; the sections below carry only what is specific to this composite.

The whole pipeline reads and displays. No phase edits code, posts to a PR, resolves a thread, or writes to any source.

## Source

There are no flags. The only argument is the triage source, passed to phase 1.

Phase 1 runs `../triage-findings/SKILL.md` § *Sources* in full, with no pinning and no source narrowing.

There is no working-tree precondition and no drift re-check: the findings pre-exist, and the `triage-findings` classify step routes a finding whose anchored code changed into **verify**. If the source yields nothing to triage, phase 1 says so and stops.

## Phase 1 — Triage

Execute `../triage-findings/SKILL.md` end to end. Print its **Overview** as the one progress line (`./references/workflow/user-facing-messages.md` § *Blocks*); hold the batch detail for the final Output.

**No open findings** makes phase 2 vacuous: skip it and render the Output without probe verdicts, its **Verified** line reading `Verified: no open findings to verify`, non-open findings still shown under their buckets.

## Phase 2 — Verify

Fan out under `./references/workflow/agent-fanout.md`, `./references/workflow/probe-engines.md`, and `./references/workflow/probe-shape-verify.md`; fan out, merge, and degrade per `./references/workflow/verify-pipeline.md`. The merge's session-review contradiction turn binds only where the source is this session's own review; a probe's **Not an issue** withdraws a PR or saved-list finding directly.

The **review object** depends on the source:

- **PR mode:** the PR's diff (`gh pr diff <number>`).
- **This session's review findings:** the reviewed diff (`<base>...HEAD`, or `<merge-base>...<b>` on a range); for a `paths` review, the reviewed path set and the head from `review-code`'s **Reviewed** line.
- **A file, pasted text, or any standalone finding:** no diff. Say so in the prompt; the probe verifies each finding as a claim against current code.

A batch spanning change-based and standalone findings is split along that line.

## Output

Lists, not tables.

- **Overview:** the source(s) triaged and the counts: N open, N to verify, N addressed.
- **Batches** and **Verified:** per `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line*, `Batches` taking a short quote as its no-anchor locator.
- **Inaccessible context** (only if any): sources or links triage could not fetch, with the reason.

**Next:** `/implement-task` or `/fix-findings` applies the confirmed fixes, `/commit` commits them, and `/review-code` reviews them before merge.
