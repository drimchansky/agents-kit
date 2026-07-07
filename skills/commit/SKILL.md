---
name: commit
description: Use when asked to create the commit after review-commit has drafted its message. Follow-up to /review-commit only; the user provides no message.
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

Create the commit that `/review-commit` prepared. This is the one skill that deliberately mutates Git state — invoking it *is* the explicit permission `references/engineering/rules.md` requires. It stages nothing, pushes nothing, and creates no branches: it commits exactly what is already staged, using the message review-commit drafted.

## Preconditions — stop if unmet

- **A review-commit message must exist in this conversation.** Find the commit message `/review-commit` drafted earlier in this session. If there is none, stop and tell the user to run `/review-commit` first, then `/commit`. Do not draft a message yourself.
- **Something must be staged.** Run `git diff --cached --quiet`; if it reports no staged changes, inform the user and stop.

## Process

1. **Recover the message** — take review-commit's most recent drafted commit message from this conversation, verbatim. Never rewrite or re-format it.
2. **Commit** the staged changes, preserving the message verbatim: write it to a scratch file and run `git commit -F <file>` (keeps the multi-line body intact), then remove the scratch file.
3. **Report** what was committed: `git show --stat --oneline HEAD` (hash, subject, and the files).

Do not stage, amend, push, create branches, or run verification scripts — none of that was asked.

## Verification

- [ ] A review-commit message was found in the conversation; if not, the skill stopped and pointed to `/review-commit`
- [ ] Something was staged; if not, the skill stopped
- [ ] The committed message matches review-commit's draft verbatim (no rewrite)
- [ ] Only already-staged changes were committed — nothing staged, pushed, amended, or branched
- [ ] The result (hash, subject, files) was reported after committing
- [ ] Any scratch message file was removed
