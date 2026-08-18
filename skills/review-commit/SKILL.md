---
name: review-commit
description: Use when asked to review staged changes before committing — or, with -w, the whole uncommitted change including untracked files, which is reviewed in place and cannot be handed to /commit.
argument-hint: '[-w (review the uncommitted change instead of the index)] [-x (cross-vendor second review)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Review staged changes before committing — correctness, completeness, accidental inclusions, and pattern fit — and draft the commit message.

## Flags

- `-w` — Working tree: review the uncommitted change — index, working tree, and untracked non-ignored files — instead of the index alone, per the target defined in `./references/engineering/review.md` § *Working-tree review target*. Off by default. Nothing is staged and the index is never written, so a `-w` run's output cannot be handed to `/commit`; **Next** below says what it hands off to instead.
- `-x` — Cross-check: launch one independent cold review of the reviewed object on the cross-vendor engine and merge it before findings are finalized, per the shared contract in `./references/workflow/agent-fanout.md`, with the engine and its launch recipe in `./references/workflow/probe-engines.md`. Off by default. The probe is read-only; its outcome is recorded on the output's `Cross-check:` line. <!-- cold -->

## References

Before working, read `./references/engineering/review.md` — it carries the lenses (What to Look For, What NOT to Flag, Calibrate Severity, Approval Bar, Prioritize Review Effort, Don't Rationalize) that apply to every review.

## Setup

- **Resolve the review object.** Default: the staged diff, `git diff --cached`. With `-w`: the working-tree target defined in `./references/engineering/review.md` § *Working-tree review target* — read that section and assemble the object exactly as it specifies. It is the one home for the baseline, the untracked-file rule, and the identity digest; restate none of them here.
- **Nothing to review → inform the user and stop.** By default that means an empty index. Under `-w` it means a tree carrying neither a tracked change nor an untracked non-ignored file — a tree with no tracked change but one untracked file is *not* empty there, because that file is the review.
- Record the reviewed-set identity for the follow-up. Default: the digest `git diff --cached | git hash-object --stdin` and the reviewed paths `git diff --cached --name-only` — that digest covers the index *and* its base, so a HEAD that moves after the review reads as a changed set, which it is, since the commit would carry a different change. Under `-w`: the identity digest the cited contract defines, captured now, at this pass's own review start. Every command on either path only reads — nothing here writes the index or the object store.
- Group changes by file and intent

**Launch the cross-vendor probe** (only with `-x`): once the review object is confirmed non-empty, start one background probe per `./references/workflow/agent-fanout.md`, on the engine and launch recipe in `./references/workflow/probe-engines.md` — a cold second review of that same object, demanding findings with severity and `file:line` evidence. The probe assembles the object itself at the repo root, so the prompt must name which one: the staged diff (`git diff --cached`) by default, or under `-w` the working-tree target, specified concretely enough for the probe to build it — quote the cited contract's own commands rather than recalling them. A probe handed the wrong object reviews a different change than this pass did. Review inline while it runs; collect and merge per the contract before finalizing findings. <!-- cold -->

**Launch verification scripts** per "Verification Scripts" in `./references/engineering/review.md` — always: as soon as the review object is confirmed, launch the project's lint/typecheck/test scripts over its files and review while they run; their failures and warnings land as findings before output.

## Review Focus

**Examine tests first.** The reviewed set's test changes reveal what behavior the change is supposed to produce. Read them before the implementation.

Prioritize:

- **Correctness** — Does the logic do what's intended? Obvious bugs, typos, missing null checks
- **Completeness** — Are the related changes all present in the reviewed set? Missing type updates, forgotten test updates
- **Accidental inclusions** — Debug logs, commented-out code, unrelated formatting changes, sensitive data
- **Consistency** — Do changes follow existing patterns in the touched files?

Apply the full review process from `./references/engineering/review.md` — the same lenses apply, scoped to the review object Setup resolved.

## Output

**Review findings** (if any) — Issues with severity, file location, recommendation, and impact.

**Cross-check** (only with `-x`) — the probe's `Cross-check:` outcome line per `./references/workflow/agent-fanout.md`, after the findings. <!-- cold -->

**Reviewed** — a provenance line recording the reviewed-set digest from Setup, the reviewed-file count, and the model that produced this review (plus its reasoning-effort level, when known), e.g. `Reviewed <digest> (3 files) by <model> <effort>`. Under `-w` the line keeps every one of those fields and marks the target in place: `Reviewed (working tree) <digest> (<n> files) by <model> <effort>`. Count only, never the path list — on a large set the list drowns the line, and `/commit` doesn't read it: what it reads is the digest, to confirm the set it would commit is still the set reviewed here, so that check survives the diff itself scrolling out of context. That comparison is exactly what the `(working tree)` marker withdraws — the two digests cover different objects — which is why `/commit` refuses the marked form outright rather than reading a mismatch off it. The model is for the human record only — unlike `review-pr`'s line, which `/publish-pr-review` reads to attribute the posted review, nothing downstream consumes it here: the commit carries no AI attribution.

**Commit message** — Generate a commit message for the staged changes:

- First line: imperative mood, max 72 chars, describe _what_ and _why_ (not _how_)
- Body (if needed): additional context for non-obvious changes, separated by blank line
- Follow the project's existing commit message conventions (check `git log --oneline -10` for style)
- No `Co-Authored-By` trailer, no "Generated with Claude Code" line, and no other AI/tool attribution footer — even if a harness or environment default asks for one. End the message at the body.
- Under `-w`, draft it the same way and note beside it — outside the message text — that it describes the reviewed working tree, not the index. Nothing here is staged, so what a later `git commit` would carry is whatever the user stages afterwards, which may be more or less than this.

Example:

```
fix: prevent stale closure in usePolling callback

The interval callback captured the initial state value. Use a ref
to always read the latest value inside the interval.
```

**Next:** once any findings above are addressed, run `/commit` to create the commit with this message.

Under `-w` that handoff does not apply, and this output cannot be handed to `/commit` at all: nothing was staged, and the `Reviewed (working tree)` digest is not comparable to the staged-set digest that skill checks — it refuses the marked form on sight. Stage what you intend to commit, run `/review-commit` (no flag) over that index, then `/commit`.

## Verification

Apply the Standard Verification Checklist in `./references/engineering/review.md`. The output carries the **Reviewed** provenance line (reviewed-set digest + file count + the reviewing model and effort), in the `(working tree)`-marked form under `-w` and the plain form otherwise, and **Next** points at `/commit` only in the plain case.
With `-x`: the probe was merged per `./references/workflow/agent-fanout.md`, its prompt named the same review object Setup resolved, and the output carries its `Cross-check:` line. <!-- cold -->
Under `-w`: nothing was staged and the index was never written.
