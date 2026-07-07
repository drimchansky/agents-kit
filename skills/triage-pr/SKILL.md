---
name: triage-pr
description: Use when asked to triage, sort, or batch the review comments on a PR — surfaces which comments are still unaddressed and groups them by concern. Reads and displays only; does not edit code or post to the PR.
argument-hint: '[PR number or URL — defaults to current branch] [-a (include already-addressed)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

Fetch every review comment on a PR, filter to the ones still unaddressed, cluster them by concern, and display the batches so the author can see the shape of the remaining work.

**CRITICAL**: This skill only reads and displays. It never edits code and never writes to the PR — no `gh pr comment`, no `gh pr review`, no resolving threads. Addressing the batches is a separate, manual follow-up (e.g. `/implement-task` or `/review-commit`).

## Flags

- `-a` — Include already-addressed (resolved) comments in the output for a full picture. Off by default: only unaddressed comments are shown; resolved ones are counted, not detailed.

## Process

**Locate the PR.** If a PR number or URL is given, use it. Otherwise find the open PR for the current branch with `gh pr view --json number,url,title,state` (requires `gh` CLI). If the command fails because `gh` is missing or the repo has no GitHub remote, note that and stop — there is nothing to triage without a PR.

**Fetch all comments** from three sources:

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

**Classify addressed vs unaddressed.** For each thread/comment:

- Thread `isResolved: true` → **addressed**. Skip it (counted only) unless `-a`.
- Unresolved, but the last comment is a reply from the PR author acknowledging the fix (e.g. "done", "fixed", "addressed in `<sha>`") → **likely handled**. List under **Verify**, not the main batches.
- Unresolved and thread `isOutdated: true`, **or** the code at `path:line` changed after the comment's `createdAt` (check with `git log`/blame on those lines) → **possibly already handled**. Also list under **Verify**.
- Unresolved and the code is unchanged → **open**. These are what gets batched.

Never drop a comment silently — every fetched comment lands in exactly one bucket (open / verify / addressed).

**Batch open comments by concern, then file.** Read the open comments and cluster them into named zones by shared concern (e.g. error handling, naming, types, tests, API surface, docs), keeping same-file comments together within a zone. Preserve each comment's original wording and any reviewer severity prefix (`Critical:` / `Major:` / `Nit:` / `Optional:` / `FYI:` — see `./references/engineering/review.md`); do not rewrite or re-rank the reviewer's judgement.

## Output

Lists, never tables.

- **Overview** — counts: N open, N to verify, N addressed (skipped), across M threads.
- **Batches** — one section per concern zone, ordered by the most severe member. Each entry lists the comment's location, the reviewer's login, the original comment text (with its severity prefix if present), and the GitHub permalink. Use `path:line` for inline review-thread comments; PR-level comments (review summary bodies, general PR comments) have no `path:line`, so anchor them by their permalink instead.
- **Verify** (only if any) — likely-handled threads with the reason (author said done / code changed / thread outdated), so the author can confirm and resolve them on GitHub.
- **Inaccessible context** (only if any) — threads or links that couldn't be fetched, with the reason (auth required, private, 404, tool unavailable). Do not fabricate what's behind them — flag the gap.

## Verification

- [ ] Echoed `✅ Core agents-kit rules applied` before any other output.
- [ ] Read `./references/engineering/rules.md`.
- [ ] Fetched all three comment sources (review threads, review bodies, general comments).
- [ ] Every fetched comment is classified into exactly one bucket — none dropped.
- [ ] No code was edited and nothing was written to the PR.
- [ ] Output uses lists, not tables.
