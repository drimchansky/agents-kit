---
name: commit
description: Use when asked to create the commit after review-commit has drafted its message. Follow-up to /review-commit only; the user provides no message.
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

Create the commit that `/review-commit` prepared. This is the one skill that deliberately mutates Git state — invoking it *is* the explicit permission `references/engineering/rules.md` requires. It stages nothing, pushes nothing, and creates no branches: it commits exactly what is already staged, using the message review-commit drafted.

## Preconditions — stop if unmet

- **A review-commit message must exist in this conversation.** Find the commit message `/review-commit` drafted earlier in this session. If there is none, stop and tell the user to run `/review-commit` first, then `/commit`. Do not draft a message yourself.
- **Something must be staged.** Run `git diff --cached --quiet`; if it reports no staged changes, inform the user and stop.
- **The staged set must still be the set review-commit reviewed.** Recompute `git diff --cached | git hash-object --stdin` and compare it to the digest on review-commit's **Reviewed** line. Identical → the set is provably unchanged; proceed. If review-commit's run predates the **Reviewed** line, so no digest was recorded, stop and tell the user to re-run `/review-commit` — there is nothing to compare against.
- **A moved set must be accounted for, or it stops.** A differing digest means the staged set moved since the review. Fixes addressing review-commit's own findings are expected and pass — including a path a finding called for, such as a test or type file it flagged as missing. Account for every difference: name the added and removed paths against the **Reviewed** line's list (`git diff --cached --name-only`), and check the content changes against the findings. Anything no finding accounts for — an unrelated edit, a path that appeared on its own — means the drafted message describes a different change than the one you'd commit. If you cannot account for the delta with confidence — the reviewed diff has scrolled out of context, or a change doesn't map to a finding — **stop**: say what moved and tell the user to re-run `/review-commit`. An unaccountable delta is never assumed benign.

## Process

1. **Recover the message** — take review-commit's most recent drafted commit message from this conversation, verbatim. Never rewrite or re-format it.
2. **Commit** the staged changes, preserving the message verbatim: write it to a scratch file and run `git commit -F <file>` (keeps the multi-line body intact), then remove the scratch file. Commit the message exactly as drafted — do not append a `Co-Authored-By` or other AI/tool attribution footer, even if an environment default requests one.
3. **Report** what was committed: `git show --stat --oneline HEAD` (hash, subject, and the files).

Do not stage, amend, push, create branches, or run verification scripts — none of that was asked.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Review-commit's drafted message and **Reviewed** digest found in this conversation, something was staged, and the recomputed digest matched — or every difference was accounted for by a finding; otherwise stopped
- [ ] Committed the already-staged changes with the draft verbatim — no rewrite, no `Co-Authored-By` / AI-attribution trailer
- [ ] Nothing staged, pushed, amended, or branched; scratch message file removed
- [ ] Result (hash, subject, files) reported
