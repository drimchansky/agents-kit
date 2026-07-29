---
name: triage-findings
description: Use when asked to triage, sort, or batch findings — from a review in this session, a PR's review comments, or a pasted/saved list — surfaces which are still unaddressed and groups them by concern. Reads and displays only; does not edit code or post anywhere.
argument-hint: '[source: PR number/URL, file path, or pasted findings — defaults to session findings]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

Gather findings from a source — a review produced in this session, a PR's review comments, or a findings list in a file or pasted text — filter to the ones still unaddressed, cluster them by concern, and display the batches so the author can see the shape of the remaining work.

**CRITICAL**: This skill only reads and displays. It never edits code and never writes to any source — no `gh pr comment`, no `gh pr review`, no resolving threads, no editing the findings file. Addressing the batches is a separate follow-up — `/fix-findings` takes these batches as a source, or handle them via `/implement-task` or by hand.

## Sources

Resolve the source in this order:

1. **Explicit argument wins.** A PR number or URL → PR mode. An existing file path → parse that file. Pasted text, or a pointer like "the review above" → those findings.
2. **No argument:** if the session contains review findings (from `/review-pr`, `/review-commit`, `/audit`, `/review-docs`, …), triage those — the most recent review is the natural target. Otherwise fall back to the open PR for the current branch (PR mode).
3. **Several sources named** → one merged view. When two sources describe the same issue, keep one entry and cite each source on it — two entries for one issue split the batch's story and double the count. If the sources disagree on whether the issue is addressed, the entry lands in **Verify** with the disagreement noted; if they disagree on severity, lead with the most severe prefix.

Name the triaged source(s) in the Overview so the reader knows what was and wasn't covered.

## Fetch

**PR mode.** Locate the PR: use the given number or URL, else find the open PR for the current branch with `gh pr view --json number,url,title,state` (requires `gh` CLI). If the command fails because `gh` is missing or the repo has no GitHub remote, note that and stop — there is nothing to triage without a PR.

Fetch all comments from three sources:

- **Review threads** (inline comments on code — the primary, resolvable target). Query them with GraphQL, which is the only way to get resolution status:

    ```
    gh api graphql -F owner=<owner> -F repo=<repo> -F number=<pr> -f query='
    query($owner:String!, $repo:String!, $number:Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$number) {
          reviewThreads(first:100) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              isResolved
              isOutdated
              path
              line
              comments(first:100) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes { author { login } body createdAt url }
              }
            }
          }
        }
      }
    }'
    ```

    Derive `<owner>`/`<repo>` from `gh repo view --json owner,name` (or parse the PR URL). If `reviewThreads.pageInfo.hasNextPage` is true, paginate with `after: <endCursor>`; likewise for any thread whose `comments.pageInfo.hasNextPage` is true. `totalCount` tells you upfront whether more than the first 100 exist.
- **Review summary bodies** and **general PR comments** — `gh pr view <target> --json reviews,comments`. These carry no thread-resolution state; treat a non-empty review body or issue comment as **open** unless a later comment or reply clearly supersedes it.

**Session findings.** Take each finding as the review emitted it — severity, `file:line`, recommendation. Don't re-review or re-rank; the triage batches existing judgement, it doesn't second-guess it.

**File or pasted text.** Parse the findings-shaped list, preserving each entry's original wording and any severity prefix. If the input has no discernible findings, say so and stop rather than inventing structure.

## Classify addressed vs unaddressed

Every finding lands in exactly one bucket — **open**, **verify**, or **addressed**; never drop one silently.

- PR thread `isResolved: true` → **addressed**. Skip it (counted only).
- PR thread unresolved, but the last comment is a reply from the PR author acknowledging the fix (e.g. "done", "fixed", "addressed in `<sha>`") → **likely handled**. List under **Verify**, not the main batches.
- Any finding anchored to `path:line` in the local repo, from any source: the code at the anchor changed after the finding was produced (thread `isOutdated: true`, a `git log`/blame check on those lines, or the finding's quoted code no longer matching) → **possibly already handled**, list under **Verify**. Code unchanged, or nothing to establish "after" by (a pasted finding with no timestamp or quote) → **open**.
- A finding with no anchor and no resolution state → **open** — unless its own source shows it superseded (a later reply, a struck-through entry), then **addressed**.

## Batch

Batch open findings by concern, then file. Read them and cluster into named zones by shared concern (e.g. error handling, naming, types, tests, API surface, docs), keeping same-file findings together within a zone. Preserve each finding's original wording and any severity prefix (`Critical:` / `Major:` / `Nit:` / `Optional:` / `FYI:` — see `./references/engineering/review.md`); do not rewrite or re-rank the reviewer's judgement.

## Output

Lists, never tables.

- **Overview** — the source(s) triaged, and counts: N open, N to verify, N addressed (skipped).
- **Batches** — one section per concern zone, ordered by the most severe member. Each entry lists the finding's location, who raised it (reviewer login, review skill, or the file/paste it came from), the original text (with its severity prefix if present), and its anchor: the GitHub permalink for PR comments, `path:line` or a short quote otherwise. In a merged run, every source that raised the issue is cited on its entry.
- **Verify** (only if any) — likely-handled findings with the reason (author said done / code changed / thread outdated), so the author can confirm and resolve them.
- **Inaccessible context** (only if any) — sources or links that couldn't be fetched, with the reason (auth required, private, 404, tool unavailable). Do not fabricate what's behind them — flag the gap.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Source resolved per the order in **Sources** and named in the Overview
- [ ] PR mode: all three comment sources fetched (review threads via GraphQL with pagination, review bodies, general comments)
- [ ] Every finding classified into exactly one bucket (open / verify / addressed) — none dropped
- [ ] Merged run: each entry cites every source that raised it
- [ ] No code edited and nothing written to any source
