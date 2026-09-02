# Locating the PR a Follow-Up Acts On

How a skill that acts on the current branch's pull request finds it, and every way that lookup comes up short — shared by `publish-pr-review` and `update-pr-description`, each of which cites this file rather than restating the stop. **This file is the single source of truth for that lookup.**

Find the open PR for the current branch with `gh pr view --json <fields>` — it requires the `gh` CLI, and with no positional argument it targets the current branch's PR. Every follow-up reads four fields, `number`, `title`, `url`, and `state`; a skill that needs more names them beside those.

**Stop if the lookup comes up short**, noting which way it did: `gh` is missing, the repository has no GitHub remote, or there is no open PR for the branch — the command errors, or the PR it returns is not in state `OPEN`. A follow-up has nothing to act on without a PR, so none of these degrades to a guess at one.
