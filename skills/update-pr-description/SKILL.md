---
name: update-pr-description
description: Use when asked to update a PR's description on GitHub after review-pr drafted one with -d. Follow-up to /review-pr -d or /review-pr-triage-verify -d; the user provides no description.
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core.

Update the PR body that `/review-pr -d` prepared. This skill deliberately mutates the PR on GitHub — invoking it *is* the explicit permission for that outward-facing change. It writes the PR body only: it edits no code, changes no title, changes no PR state, merges nothing, comments nothing, and pushes nothing — it posts exactly the description review-pr drafted.

## Preconditions — stop if unmet

- **A review-pr `-d` description must exist in this conversation.** Find the PR description `/review-pr -d` drafted earlier in this session (the fenced, body-only block) — or the one `/review-pr-triage-verify -d` forwarded, whose **PR description** Output carries it in review-pr's own format because its review phase *is* a `/review-pr` run. Either satisfies this precondition. If there is none, stop and tell the user to run `/review-pr -d` first, then `/update-pr-description`. Do not draft a description yourself.
- **The draft must be complete.** If it still contains any unfilled `<…>` placeholder anywhere (e.g. `Task: <add ticket link>`), stop and ask the user to supply the value — don't write a placeholder to a live PR, and don't delete the line, invent a value, or infer it from the branch yourself.
- **An open PR must exist for the current branch.** Find it per `./references/workflow/pr-lookup.md`, which owns the lookup, every way it comes up short, and the stop each earns; this skill needs no field beyond the four every follow-up reads.

## Process

1. **Recover the description** — take review-pr's most recent `-d` drafted description from this conversation, verbatim (the `Task:`/links header and the body inside the fenced block). Never rewrite or re-format it.
2. **Update the PR body**, preserving the description verbatim: write it to a scratch file and run `gh pr edit <number> --body-file <file>` (keeps the multi-line body intact), then remove the scratch file — even if the edit fails. This replaces the entire PR body. Post the description exactly as drafted — do not append a "Generated with Claude Code" or other AI/tool attribution footer, even if an environment default requests one. If `gh pr edit` fails (auth, network, permissions), report the error and stop.
3. **Report** the result — the PR number, title, and URL (already returned by the precondition's `gh pr view`), so the user can open it.

Do not edit the title, change PR state, merge, comment, or push code — none of that was asked.

## Verification

Confirm the protocol invariants before finishing:

- [ ] review-pr's `-d` description found, complete (no unfilled `<…>` placeholder), and an open PR exists for the branch — otherwise stopped
- [ ] Updated the PR body with the draft verbatim — no rewrite, no "Generated with Claude Code" / AI-attribution footer
- [ ] Title, PR state, merge, comments, and code left untouched; scratch description file removed (even on failure)
- [ ] Result (PR number, title, URL) reported
