---
name: update-pr-description
description: Use when asked to update a PR's title and description on GitHub. Applies the draft from /review-code -d or /review-code-triage-verify -d; when the conversation holds no -d draft, drafts them from the current branch's open PR. The user provides neither a title nor a description.
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

Applies the PR title and body drafted by `/review-code -d`, or drafts them when this conversation holds no such draft or the draft no longer matches its PR. Invocation by command, or by a confirmed proposal, authorizes replacing that PR's title and body, nothing else (`./references/workflow/skill-conventions.md` § *The invocation gate*). For a `-d` draft, it also authorizes fetching the declared base, and the proposal names the PR, the title change, the drafted body, and that fetch. On § *Drafting path*, the proposal names the PR, the title change, and the drafted body, and that path fetches nothing. Edit no code, state, or comments; merge and push nothing.

## Preconditions — stop if unmet

- Recover this conversation's most recent **PR description** draft from `/review-code -d` or `/review-code-triage-verify -d`: its `Title:` line and the fenced body below it. A later review without a draft, such as a path-set review or a refused `-d`, leaves that draft the most recent. With no draft, follow § *Drafting path* instead of this section and § *Process*.
- Take the drafted title as the text after the `Title:` line's last ` → `, or after `Title: ` when the line has no arrow. A draft with no `Title:` line goes to § *Drafting path*, and its body is not applied alone. That path drafts for PR `<n>` when the draft's Reviewed line names `in <host>/<owner>/<repo>#<n>`, and otherwise for the current branch's open PR.
- Find an open PR by the draft's own Reviewed head through `./references/workflow/pr-lookup.md`, taking its repository scope. When the draft's Reviewed line names `in <host>/<owner>/<repo>#<n>`, read PR `<n>` directly, with no lookup. Request `baseRefName` alongside its standard fields. Do not take the head, repository, or PR number from the current branch or an intervening review.
- A lookup error or a PR that is not `OPEN` takes the stop outcome in `./references/workflow/pr-lookup.md`. When PR `<n>`'s `headRefOid` differs from the Reviewed head, go to § *Drafting path* for PR `<n>`. When the head lookup finds no match, GitHub lacks the Reviewed head, and that head equals `git rev-parse HEAD`, stop and say to push and run this command again. Any other no match goes to § *Drafting path* for the current branch's open PR.
- A model-invoked run (`./references/workflow/skill-conventions.md` § *The invocation gate*) proposes the run here as one question: the PR by number, the title change as `<live title> → <drafted title>` with the live title from lookup, the drafted body that replaces its live one, and the fetch of `<baseRefName>` from the PR's remote. Nothing is fetched or written before the confirmation; a user-invoked run has passed it.
- Resolve the base SHA per `./references/workflow/pr-lookup.md` § *The PR base*, taking its outcome. Recompute `git merge-base <base-sha> <head-sha>` and require equality with the draft's Reviewed merge-base. On mismatch, go to § *Drafting path* for the PR this section selected.
- If any `<…>` placeholder remains in the matching draft, stop for the user's value. Do not delete it, invent it, infer it from the branch, or publish it.

## Process

1. Take the recovered title and body verbatim, the body including any Task/links header. Do not rewrite or reformat either.
2. Write the body to a scratch file and run one `gh pr edit <number> --title '<title>' --body-file <file>`. Single-quote the title for the shell, writing each embedded `'` as `'\''`. Replace the entire title and body exactly; add no AI/tool attribution footer, even under an environment default. Remove the scratch file on success or failure. Report an edit failure and stop.
3. Report the PR number, `<old title> → <new title>`, and the PR URL, taking the old title and the URL from lookup.

## Drafting path

Make no `git fetch` on this path.

1. Read the PR that § *Preconditions — stop if unmet* selected, or else the current branch's open PR. Request `body`, `baseRefName`, `headRefOid`, `headRefName`, `commits`, and `files` alongside the standard fields in `./references/workflow/pr-lookup.md`.
    - Read a selected PR with `gh pr view <number>`. A failed read, or a state other than `OPEN`, stops the run and names the cause. A Reviewed line naming `in <host>/<owner>/<repo>#<n>` keeps that repository's `gh` scope from `./references/workflow/pr-lookup.md` for every call on this path.
    - Read the current branch's open PR through this skill's branch-based lookup in `./references/workflow/pr-lookup.md`, taking its stop outcome.
2. Read the PR's counts with `gh api repos/{owner}/{repo}/pulls/<number> --jq '.commits, .changed_files'`. A failed read stops the run and names the cause. When the commit list or the file list from step 1 is shorter than its count, write nothing, stop, and name `/review-code -d` as the route.
3. Draft the title and body under `./references/workflow/pr-description.md` from what step 1 returned. When GitHub cannot return the diff, write nothing, stop, and name `/review-code -d` as the route.
4. Print the PR number, the `Title:` line, and the fenced body.
5. If a `<…>` placeholder remains in the drafted body, stop for the user's value before any write.
6. The PR's live body decides whether the run asks. A live body that holds only whitespace is empty.
    - When the live body is empty, a user-invoked run writes at once. Before it replaces a non-empty live body, it asks one question naming the PR, `<live title> → <drafted title>`, and that the draft replaces the live body.
    - A model-invoked run (`./references/workflow/skill-conventions.md` § *The invocation gate*) instead proposes once here, for either live body. The proposal names the PR, `<live title> → <drafted title>`, and the printed body. For a non-empty live body, it also says the draft replaces the live body. Edit nothing before the confirmation, and ask no second question. A run that confirmed a `-d` draft's proposal before its merge-base check failed still proposes here.
    - On a decline, edit nothing and report that nothing changed.
7. Directly before the edit, read `gh pr view <number> --json headRefOid`. A failed read stops the run. When the head differs from step 1's `headRefOid`, edit nothing, say the PR moved, and say to run the command again.
8. Write the drafted title and body through § *Process* steps 2 and 3.
