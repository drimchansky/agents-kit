---
name: review-code-triage-verify
description: Use when asked for a verified review of a PR, branch, range, or file set. Reviews, batches, and verifies findings; classifies change risk, retains evidence for user-visible changes, and requests engineer sign-off where risk or evidence requires it before approval. Capture may build and start the app in a disposable checkout and drive a browser. Edits no code and posts nowhere.
argument-hint: '[scope, or an open PR as #<n> or its URL; defaults to the current branch against its base] [-n N (independent reviewers, default 1)] [-x [N] (cross-vendor second reviews, default 1)] [-d (draft PR description)]'
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Full review pipeline: review the object (`review-code`), batch the findings by concern (`triage-findings`), then verify each batch in an isolated read-only probe running the `verify-issue` protocol, one verdict per finding.

Apply `./references/workflow/verify-pipeline.md` with this composite's specific rules below.

The pipeline reads and displays findings and retains local review evidence. The review phase's Git writes follow `../review-code/SKILL.md` § *Setup*: the PR-form head fetch (`FETCH_HEAD` only), the base fetch, and PR-form worktree addition and removal. User-invoked and model-invoked runs both make these writes. Capturing evidence may add and remove a disposable detached worktree, build and start the app there, and drive a browser. No phase edits code, posts to the PR, or writes to any source.

## Flags

`-n N` passes through to the review phase. The standing returns pool by location inside phase 1 (`./references/workflow/verify-pipeline.md` § *The review phase*), so phase 2 batches one candidate per distinct claim with its `cited by k/N` marker.

`-x`, with its count when given, and `-d` pass through to the review phase (`../review-code/SKILL.md`; `./references/workflow/verify-pipeline.md` § *Flags through the review phase*). The review phase pools the `-x` probes' novel candidates, one per distinct claim, without verifying them (`./references/workflow/verify-pipeline.md` § *The review phase*). Phase 3 verifies each, and one it scopes out takes `Unverified (out of probe scope — candidate never settled)`.

## Setup

Resolve the object per `../review-code/SKILL.md`'s Setup and hand it to phase 1.

On the PR form, keep the worktree that Setup's **Resolve the PR** adds until Phase 3 ends. Remove it from the caller's checkout with `git worktree remove --force <path>` after Phase 3, or where the run ends sooner: a stop, a failure, or the no-findings route. Before removing it, collect each finished `-x` probe and stop each one still running in it, each through its own background command (`./references/workflow/delegated-waiting.md` §§ *Per-host primitives* and *Shell commands*). Remove only a worktree this run's Setup added; when its `worktree add` failed, remove nothing.

Then confirm no path of the reviewed set appears in the working-tree change set: the union of `git diff HEAD --name-only` and `git ls-files --others --exclude-standard --full-name`. The reviewed set is `git diff --name-only <merge-base>...<head>` on a `pr` object and `git ls-files --full-name --error-unmatch -- <paths>` on a `paths` object. Run every command at the effective root; `--full-name` keeps both listings root-relative. On the PR form, skip this check. Setup populated the PR-form worktree from the reviewed head, and the PR checkout rule in `./references/engineering/review-evidence.md` § *Capture* allows no working-tree read there.

A range needs one condition more: `b` is an ancestor of `HEAD`, and no commit in `b..HEAD` touches a reviewed path. A range on another branch fails it; review that one with the branch checked out, or with standalone `/review-code`. This is the composite's instance of `./references/workflow/verify-pipeline.md` § *The tree-agreement precondition*: on failure, name the diverging paths, which need committing or stashing first.

## Phase 1 — Review

Run `./references/workflow/verify-pipeline.md` § *The review phase* with `../review-code/SKILL.md` as the review skill. A usable phase prints three lines: its **Summary**, its **Reviewed** provenance line, and its **Review pass** line with every `reviewer <i> dropped` entry. A safety-blocked terminal phase prints only the blocked `Review pass:` line and any unattached `Cross-check:` evidence, then stops the composite.

Retain the review phase's Evidence field and artifact directory. Suppress its sign-off question; this composite presents final evidence after verification.

## Phase 2 — Triage

Run `./references/workflow/verify-pipeline.md` § *The triage phase* over the findings phase 1 held.

## Phase 3 — Verify

First re-confirm the reviewed identity at the effective root, the PR-form worktree on that form, in the form its kind takes:

- **`branch`:** `git rev-parse HEAD` still resolves to the reviewed head, and the merge-base recomputed against Setup's own base (not the PR's `baseRefName`) still matches.
- **`range`:** re-run Setup's ancestry condition; the recorded SHAs are constants, so comparing them proves nothing.
- **`paths`:** re-run Setup's ancestry condition with the reviewed head as `b`, and confirm the digest recomputed over Setup's pathspecs still matches. When a commit in `b..HEAD` touches a reviewed path, name each such path.

Setup's working-tree check still passes on every kind outside the PR form, which skips it again. Any mismatch is drift: stop and report.

Fan out under `./references/workflow/agent-fanout.md`, `./references/workflow/probe-engines.md`, and `./references/workflow/probe-shape-verify.md`, per `./references/workflow/verify-pipeline.md`. The review object is the reviewed diff from Setup's base to the reviewed head on a `pr` object, and the reviewed paths at the reviewed head SHA on a `paths` one. Each probe prompt's working root is the effective root. On the PR form, each probe prompt carries the PR checkout line per `./references/workflow/probe-shape-verify.md`.

## Output

Lists, not tables.

After Phase 3, or after the vacuous triage/verify route with no findings, present the retained evidence and request sign-off under `./references/engineering/review-evidence.md` § *Presentation and sign-off*. Apply `./references/engineering/review-evidence.md` § *Approval eligibility* to the final assessment. Verification verdicts do not replace evidence or confirmation.

- **Summary:** what changed, intent, and the code assessment restated after verification and evidence eligibility. When CI is unknown on the PR form, report the assessment without an approval recommendation. A forwarded **Review pass** showing `scripts: skipped (fork PR)` also leaves the assessment without an approval recommendation. On a `paths` object retain the health verdict `review-code` fixes.
- **Evidence:** forward the retained field and artifact links, updating confirmation and eligibility from this composite's final presentation. The no-findings route still reports it.
- **Batches** and **Verified:** per `./references/workflow/verify-pipeline.md` § *Output: Batches and the Verified line*; `Batches` takes the whole reviewed object as its no-anchor locator and carries one entry per distinct claim with its `cited by k/N` marker. Batches is the only render of the findings: no separate Findings list follows it.
- **Cross-check** (only with `-x`), **Improvements**, **Inaccessible context** (only if any), **PR description** (only with `-d`): forwarded from the review phase as `review-code` specs them. Improvements pass through unverified.
- **Reviewed:** the provenance line exactly as `review-code` specs it, in its kind's form; `/publish-pr-review` reads it to anchor and to pick its currency-check base.
- **Review pass** and **Divergence:** forwarded from the review phase as `review-code` specs each.

Close with the Handoff block (`./references/workflow/user-facing-messages.md` § *Blocks*):

- **Done:** the verified assessment and verdict counts, pointing at **Summary** and the **Verified** line; with `-d`, the drafted description, pointing at **PR description**.
- **Know:** what the verdicts leave unsettled: Inconclusive and Unverified entries, and the unverified **Improvements** where the review returned any. Name what narrowed the review: batches verified inline, an inline or degraded **Review pass**, **Divergence** entries, a **Cross-check** disagreement or dropped probe, or **Inaccessible context**. Name the reviewed object, any PR it sits on, and retained evidence directory. On the PR form, name what leaves CI unknown, as `../review-code/SKILL.md` § *Output* Know lists it.
- **Awaiting you:** evidence prerequisites from `./references/engineering/review-evidence.md` § *Approval eligibility*, pointing at **Evidence**. When **PR description** holds a draft, add its leftover placeholders as `../review-code/SKILL.md` § *Output* Awaiting you names them.
- **Next:** the options are `/publish-pr-review` on a `pr` object, `/fix-findings`, and `/implement-task`. Publication remains subject to evidence eligibility. `/fix-findings` addresses the batches and commits each one; `/implement-task` addresses them through a task plan, then `/commit`. `/fix-findings-reconcile` takes the place of `/fix-findings` when the reviewed object is provably the session task's work, as `../fix-findings-reconcile/SKILL.md` § *When to Use* defines proof. Without that proof but with a session task, list both fix routes and prefer `/fix-findings` to `/fix-findings-reconcile`. On the PR form, name a same-repository PR's `headRefName` beside each fix and task-plan route as the checkout that route must run in. When the PR form names a fork PR (`isCrossRepository` true), say this run has no pushable checkout for those routes, and offer none of them. A `paths` object sits on no PR, leaving the fix and task-plan routes. When **PR description** holds a draft, also name `/update-pr-description` with the reviewed-head condition and redraft route that `../review-code/SKILL.md` § *Output* Next states. When `-d` was refused, name the no-argument `-d` review on the branch instead, as that Next states.
