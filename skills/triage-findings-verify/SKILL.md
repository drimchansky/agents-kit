---
name: triage-findings-verify
description: Use when asked for a verified triage of findings you already have — one command that gathers findings from a source (a PR's review comments, a saved or pasted list, or this session's review), batches them by concern, verifies each open batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[source: PR number/URL, file path, or pasted findings — defaults to session findings; passed to the triage phase]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

One command for the findings-first pipeline: gather and batch findings you already have (`triage-findings`), then verify each **open** batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, one verdict per finding. Unlike the review composites (`review-pr-triage-verify`, `review-commit-triage-verify`), there is no review phase: the findings come from an external source that triage resolves — a PR's review comments, a saved or pasted list, or a review run earlier this session. So triage's `verify` and `addressed` buckets can be genuinely populated, and this skill shows them rather than assuming everything is open.

`./references/workflow/verify-pipeline.md` owns the mechanics this pipeline shares with the kit's other verify composites — the pipeline-wide overrides every phase runs under among them. Read it; the sections below carry only what is specific to this one.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, posts to a PR, resolves a thread, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end. Addressing the findings is a separate, manual follow-up.

## Source

There are no flags — `-x`/`-p`/`-d` belong to the review phase the review composites carry, and this one has none; the per-batch verify probes run on the **native** engine regardless. The only argument is the triage source, passed straight to phase 1.

Phase 1 runs `../triage-findings/SKILL.md`'s **full** source resolution — an explicit argument wins (a PR number/URL → PR mode, a file path → that file, pasted text → those findings); with no argument it takes this session's review findings, else falls back to the open PR for the current branch; several named sources merge into one view. This is the departure from the review composites, which pin triage to their own phase-1 review and forbid other sources — here there is no in-session review to pin to, so triage resolves the source itself.

There is **no working-tree precondition and no drift re-check**. The review composites guard a reviewed-diff identity — a head/merge-base or staged digest their probes must not diverge from — because their probes read the live tree and the findings were produced from a snapshot in that same session. This composite has no such snapshot: the findings pre-exist and may already be partly addressed, and `triage-findings`' classify step already routes any finding whose anchored code changed since it was written into the **verify** (outdated) bucket. If the source yields nothing to triage, phase 1 says so and stops.

## Phase 1 — Triage

Execute `../triage-findings/SKILL.md` end to end, with its full source resolution above — no pinning, no source narrowing. It classifies every finding into exactly one bucket (**open** / **verify** / **addressed**) and batches the open ones by concern. Print its **Overview** — the source(s) triaged and the counts — as the one progress line; hold the batch detail for the final Output.

**No open findings** — everything landed in `verify`/`addressed`, or the source had no findings at all — makes phase 2 vacuous: skip it and render the Output without probe verdicts, its **Verified** line reading `Verified: no open findings to verify` and the non-open findings still shown under their buckets.

## Phase 2 — Verify

Fan out, merge, and degrade per `./references/workflow/verify-pipeline.md` § *Fan-out and probes* and § *Merge and degrade*, under the probe and merge contracts of `./references/workflow/agent-fanout.md`, with engines per `./references/workflow/probe-engines.md` and the verify shape in `./references/workflow/probe-shape-verify.md`; this skill is a registered consumer of each. The merge's session-review contradiction turn binds only where the source resolved to this session's own review; findings from a PR or a saved list have no session pass to contradict, so a probe's **Not an issue** withdraws them directly.

Alone among the members, this one's **review object** varies — it depends on the source triage resolved:

- **PR mode** — hand the probe the PR's diff (`gh pr diff <number>`); the findings are review comments on that change, and a finding about what the PR added or dropped can't be judged from current file contents alone.
- **This session's review findings** — hand the reviewed diff if it is recoverable from the session (`<base>...HEAD`, or `git diff --cached` for a staged review), exactly as the review composites do.
- **A file, pasted text, or any standalone finding with no associated change** — there is no diff; the probe verifies each finding as a standalone claim against current code, which is `verify-issue`'s native single-issue mode. Say so in the prompt, so the probe investigates the claim rather than hunting for a change that was never its subject.

When triage merged several sources, one concern batch can span these — some findings from a change, some standalone. The review object is then per finding, not per batch: give a probe only the diff its change-based findings came from, verify the standalone ones as claims against current code, and where a single batch spans both, split it along that line so no probe is handed a diff that doesn't correspond to some of its findings — worse than none, per the skeleton.

## Output

Lists, never tables.

- **Overview** — the source(s) triaged and the counts: N open, N to verify, N addressed. This names the provenance — which source was and wasn't covered; there is no review `Reviewed at <sha>` line here.
- **Batches** and **Verified** — as `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line* specs them, `Batches` here taking a short quote as its no-anchor locator.
- **Inaccessible context** (only if any) — sources or links triage couldn't fetch, with the reason, forwarded from phase 1.

**Next:** address the confirmed findings — `/implement-task` for a scoped fix, or `/review-commit` once you've made changes. Withdrawn findings need no action.

## Verification

Confirm `./references/workflow/verify-pipeline.md` § *Shared checklist* — its phases here are `triage-findings` and probes on `verify-issue`, and its read-only item covers posting to a PR and resolving a thread — plus these:

- [ ] Phase 1 ran `triage-findings` with its full source resolution, and the source(s) are named in the Overview
- [ ] Every probe prompt carried the right review object — the diff when the source has one, none for standalone findings
- [ ] Output carries the Overview provenance
