---
name: update-pr-description
description: Use when asked to update a PR's title and description on GitHub after review-code drafted them with -d. Follow-up to /review-code -d or /review-code-triage-verify -d; the user provides neither a title nor a description.
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

Applies the PR title and body drafted by `/review-code -d`. Invocation by command, or by a confirmed proposal that named the PR, the title change, the drafted body, and the base fetch below, authorizes replacing that title and body and fetching the declared base, nothing else (`./references/workflow/skill-conventions.md` § *The invocation gate*). Edit no code, state, or comments; merge and push nothing.

## Preconditions — stop if unmet

- Check the latest review's object before searching for a draft. `Reviewed paths` conclusively refuses this operation. A Reviewed range refuses only when accompanied by `-d refused: <reason>`; a range carrying a draft is valid. Name the rejected object in one line, rather than requesting another refused `-d` run. Borderline objects: `../review-code/SKILL.md` § *Setup*. <!-- cold -->
- Recover this conversation's most recent **PR description** draft from `/review-code -d` or `/review-code-triage-verify -d`: its `Title:` line and the fenced body below it. If absent, request `/review-code -d` followed by this skill. Do not draft one here.
- Take the drafted title as the text after the `Title:` line's last ` → `, or after `Title: ` when the line has no arrow. If the draft has no `Title:` line, request a fresh `/review-code -d` followed by this skill. Do not apply the body alone.
- If any `<…>` placeholder remains, stop for the user's value. Do not delete it, invent it, infer it from the branch, or publish it.
- Find an open PR by the draft's own Reviewed head through `./references/workflow/pr-lookup.md`, taking its repository scope and stop outcome. When the draft's Reviewed line names `in <host>/<owner>/<repo>#<n>`, read PR `<n>` directly, with no lookup, and require `headRefOid` equal to the Reviewed head. A head mismatch there requires the redraft that **Rerun a PR-form review** in `./references/workflow/pr-lookup.md` names. Request `baseRefName` alongside its standard fields. Do not use the current branch or an intervening review's head, repository, or PR number. A head absent from GitHub requires a push and rerun; an existing head without an exact open PR requires fresh `/review-code -d`.
- A model-invoked run (`./references/workflow/skill-conventions.md` § *The invocation gate*) proposes the run here as one question: the PR by number, the title change as `<live title> → <drafted title>` with the live title from lookup, the drafted body that replaces its live one, and the fetch of `<baseRefName>` from the PR's remote. Nothing is fetched or written before the confirmation; a user-invoked run has passed it.
- Resolve the base SHA per `./references/workflow/pr-lookup.md` § *The PR base*, taking its outcome. Recompute `git merge-base <base-sha> <head-sha>` and require equality with the draft's Reviewed merge-base. On mismatch, request fresh `/review-code -d`, or correction of a wrongly retargeted PR before that review. For a Reviewed line naming a PR, request that redraft per **Rerun a PR-form review** in `./references/workflow/pr-lookup.md`.

## Process

1. Take the recovered title and body verbatim, the body including its Task/links header. Do not rewrite or reformat either.
2. Write the body to a scratch file and run one `gh pr edit <number> --title '<title>' --body-file <file>`. Single-quote the title for the shell, writing each embedded `'` as `'\''`. Replace the entire title and body exactly; add no AI/tool attribution footer, even under an environment default. Remove the scratch file on success or failure. Report an edit failure and stop.
3. Report the PR number, `<old title> → <new title>`, and the PR URL, taking the old title and the URL from lookup.
