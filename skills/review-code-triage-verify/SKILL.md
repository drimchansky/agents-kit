---
name: review-code-triage-verify
description: Use when asked for a verified review of a PR or branch against its base, a commit range, or a set of paths as they stand. One command reviews the object, batches the findings by concern, verifies each batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[scope; defaults to the current branch against its base] [-n N (independent reviewers, default 1)] [-x (cross-vendor second review)] [-d (draft PR description)]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Full review pipeline: review the object (`review-code`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol, one verdict per finding.

`./references/workflow/verify-pipeline.md` carries the shared mechanics and the pipeline-wide overrides; the sections below carry only what is specific to this composite.

The whole pipeline reads and displays. No phase edits code, posts to the PR, or writes to any source.

## Flags

`-n N` passes through to the review phase. The standing returns pool by location inside phase 1 (`./references/workflow/verify-pipeline.md` § *The review phase*), so phase 2 batches one candidate per distinct claim with its `cited by k/N` marker.

`-x` and `-d` pass through to the review phase (`../review-code/SKILL.md`; `./references/workflow/verify-pipeline.md` § *Flags through the review phase*). The review phase does not verify the `-x` probe's novel candidates itself; phase 3 does, and one it scopes out takes `Unverified (out of probe scope — candidate never settled)`.

## Setup

Resolve the object per `../review-code/SKILL.md`'s Setup and hand it to phase 1.

Then confirm no path of the reviewed set appears in the working-tree change set: the union of `git diff HEAD --name-only` and `git ls-files --others --exclude-standard --full-name`. The reviewed set is `git diff --name-only <merge-base>...<head>` on a `pr` object and `git ls-files --full-name --error-unmatch -- <paths>` on a `paths` object. Run every command at the effective root; `--full-name` keeps both listings root-relative.

A range needs one condition more: `b` is an ancestor of `HEAD`, and no commit in `b..HEAD` touches a reviewed path. A range on another branch fails it; review that one with the branch checked out, or with standalone `/review-code`. This is the composite's instance of `./references/workflow/verify-pipeline.md` § *The tree-agreement precondition*: on failure, name the diverging paths, which need committing or stashing first.

## Phase 1 — Review

Run `./references/workflow/verify-pipeline.md` § *The review phase* with `../review-code/SKILL.md` as the review skill. A usable phase prints three lines: its **Summary**, its **Reviewed** provenance line, and its **Review pass** line with every `reviewer <i> dropped` entry. A safety-blocked terminal phase prints only the blocked `Review pass:` line and any unattached `Cross-check:` evidence, then stops the composite.

## Phase 2 — Triage

Run `./references/workflow/verify-pipeline.md` § *The triage phase* over the findings phase 1 held.

## Phase 3 — Verify

First re-confirm the reviewed identity in the form its kind takes:

- **`branch`:** `git rev-parse HEAD` still resolves to the reviewed head, and the merge-base recomputed against Setup's own base (not the PR's `baseRefName`) still matches.
- **`range`:** re-run Setup's ancestry condition; the recorded SHAs are constants, so comparing them proves nothing.
- **`paths`:** `git rev-parse HEAD` still matches the reviewed head, and the digest recomputed over Setup's pathspecs still matches.

Setup's working-tree check still passes on every kind. Any mismatch is drift: stop and report.

Fan out under `./references/workflow/agent-fanout.md`, `./references/workflow/probe-engines.md`, and `./references/workflow/probe-shape-verify.md`, per `./references/workflow/verify-pipeline.md`. The review object is the reviewed diff from Setup's base to the reviewed head on a `pr` object, and the reviewed paths at the reviewed head SHA on a `paths` one. An adopted probe candidate also enters the publishable list its severity names.

## Output

Lists, not tables.

- **Summary:** what changed, intent, and the overall assessment restated after verification; the session owns the final call. On a `paths` object the assessment is the health verdict `review-code` fixes.
- **Batches** and **Verified:** per `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line*; `Batches` takes the whole reviewed object as its no-anchor locator and carries one entry per distinct claim with its `cited by k/N` marker.
- **Findings** and **Minor findings:** the publishable lists, Major/Critical and Minor, in `review-code`'s Findings format: every surviving finding with severity, `file:line`, and original text verbatim, never capped. A non-Confirmed verdict rides as a closing note, `(Inconclusive: <what's missing>)` or `(Unverified: <reason>)`, and counts as part of the finding's text downstream. Withdrawn findings are excluded; their evidence lives in Batches. Write `none` for an empty list.
- **Cross-check** (only with `-x`), **Improvements**, **Inaccessible context** (only if any), **PR description** (only with `-d`): forwarded from the review phase as `review-code` specs them. Improvements pass through unverified.
- **Reviewed:** the provenance line exactly as `review-code` specs it, in its kind's form; `/publish-pr-review` reads it to anchor and to pick its currency-check base.
- **Review pass** and **Divergence:** forwarded from the review phase as `review-code` specs each.

**Next:** on a `pr` object, `/publish-pr-review` posts the tier you select (**Findings**, **Minor findings**, or **Improvements**), or a short approval when all three are empty; with `-d`, `/update-pr-description` applies the drafted description. A `paths` object sits on no PR. Either way, `/fix-findings` or `/implement-task` addresses the batches, then `/commit`.
