---
name: update-pr-description
description: Use when asked to update a PR's description on GitHub after review-code drafted one with -d. Follow-up to /review-code -d or /review-code-triage-verify -d; the user provides no description.
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

**Model invocation:** requires a confirmed proposal (`./references/workflow/skill-conventions.md` § *The invocation gate*).

Applies the PR body drafted by `/review-code -d`. Invocation by command, or by a confirmed proposal that named the PR, the drafted body, and the base fetch below, authorizes replacing that body and fetching the declared base, nothing else (`./references/workflow/skill-conventions.md` § *The invocation gate*). Edit no code, title, state, or comments; merge and push nothing.

## Preconditions — stop if unmet

- Check the latest review's object before searching for a draft. `Reviewed paths` conclusively refuses this operation. A Reviewed range refuses only when accompanied by `-d refused: <reason>`; a range carrying a draft is valid. Name the rejected object in one line, rather than requesting another refused `-d` run. Borderline objects: `../review-code/SKILL.md` § *Setup*. <!-- cold -->
- Recover this conversation's most recent body-only fenced description from `/review-code -d` or `/review-code-triage-verify -d`. If absent, request `/review-code -d` followed by this skill. Do not draft one here.
- If any `<…>` placeholder remains, stop for the user's value. Do not delete it, invent it, infer it from the branch, or publish it.
- Find an open PR by the draft's own Reviewed head through `./references/workflow/pr-lookup.md`, taking its stop outcome. Request `baseRefName` alongside its standard fields. Do not use the current branch or an intervening review's head. A head absent from GitHub requires a push and rerun; an existing head without an exact open PR requires fresh `/review-code -d`.
- A model-invoked run (`./references/workflow/skill-conventions.md` § *The invocation gate*) proposes the run here as one question: the PR by number and title, the drafted body that replaces its live one, and the fetch of `<baseRefName>` from the PR's remote where the base may be stale. Nothing is fetched or written before the confirmation; a user-invoked run has passed it.
- Recompute `git merge-base <baseRefName> <head-sha>`, fetching the declared base first if potentially stale. Require equality with the draft's Reviewed merge-base. On mismatch, request fresh `/review-code -d`, or correction of a wrongly retargeted PR before that review.

## Process

1. Take the recovered draft verbatim, including its Task/links header. Do not rewrite or reformat it.
2. Write a scratch file and run `gh pr edit <number> --body-file <file>`. Replace the entire body exactly; add no AI/tool attribution footer, even under an environment default. Remove the scratch file on success or failure. Report an edit failure and stop.
3. Report the PR number, title, and URL returned by lookup.
