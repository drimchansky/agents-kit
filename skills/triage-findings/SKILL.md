---
name: triage-findings
description: Use when asked to triage, sort, or batch findings from a review in this session, a PR's review comments, or a pasted or saved list. Surfaces which are still unaddressed and groups them by concern. Reads and displays only; does not edit code or post anywhere.
argument-hint: '[source: PR number/URL, file path, or pasted findings; defaults to session findings]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Gather findings from a source, filter to the ones still unaddressed, cluster them by concern, and display the batches.

This skill only reads and displays: no code edits, no `gh pr comment` or `gh pr review`, no thread resolution, no edit to the findings file. `/fix-findings` takes these batches as a source.

## Sources

Resolve the source in this order:

1. **Explicit argument wins.** A PR number or URL selects PR mode. An existing file path is parsed. Pasted text or a session pointer selects those findings.
2. **No argument:** triage this session's most recent review findings. With none, fall back to the open PR for the current branch.
3. **Several sources named:** one merged view, one entry per issue citing each source. When sources disagree on whether an issue is addressed, put it in **Verify** with the disagreement noted; on severity, lead with the most severe.

## Fetch

**PR mode.** Use the given number or URL, else `gh pr view --json number,url,title,state` for the current branch's open PR. If `gh` is missing or the repo has no GitHub remote, say so and stop.

Fetch all three comment sources:

- **Review threads:** `node <kit-root>/scripts/pr-comments.ts <pr-number-or-url>`, with `<kit-root>` per `./references/workflow/task-store.md` § *Resolving `<kit-root>`* <!-- cold -->. Read its JSON per `./references/scripts/pr-comments.md`. Resolution status has no other source: if the kit root, the script, `node`, or `gh` is unavailable, say so and stop. `paginationComplete: false` means a prefix of the review: report the gap under **Inaccessible context**, never as a clean fetch.
- **Review summary bodies** and **general PR comments:** `gh pr view <target> --json reviews,comments`. They carry no resolution state; treat a non-empty body as **open** unless a later comment clearly supersedes it.

**Session findings.** Take each finding as the review emitted it: severity, `file:line`, recommendation. Do not re-review or re-rank.

**File or pasted text.** Parse the findings-shaped list, preserving wording and any severity prefix or marker. With no discernible findings, say so and stop.

## Classify addressed vs unaddressed

Every finding lands in exactly one bucket: **open**, **verify**, or **addressed**. Never drop one silently.

- PR thread `isResolved: true` → **addressed** (counted only).
- Unresolved thread whose last comment is the PR author acknowledging the fix → **Verify**.
- Any anchored finding whose code changed after it was produced (thread `isOutdated: true`, blame on those lines, or a quoted snippet that no longer matches) → **Verify**. Code unchanged, or nothing to establish "after" by → **open**.
- No anchor and no resolution state → **open**, unless its own source shows it superseded → **addressed**.

## Batch

Cluster open findings into named concern zones (error handling, naming, tests, …), keeping same-file findings together within a zone. Preserve each finding's wording and severity; do not rewrite or re-rank. A legacy text prefix is valid input and renders as its canonical marker (`./references/workflow/user-facing-messages.md` § *Markers*).

## Output

Lists, not tables.

- **Overview:** the source(s) triaged, and counts: N open, N to verify, N addressed.
- **Batches:** one section per concern zone, ordered by most severe member. Each entry is a finding entry (`./references/workflow/user-facing-messages.md` § *Blocks*): its canonical severity marker, its anchor (GitHub permalink, `path:line`, or a short quote), the original text, and who raised it, citing every source that raised it.
- **Verify** (only if any): likely-handled findings with the reason (author said done, code changed, thread outdated).
- **Inaccessible context** (only if any): sources or links that could not be fetched, with the reason. Do not fabricate what is behind them.
