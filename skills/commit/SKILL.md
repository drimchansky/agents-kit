---
name: commit
description: Commit staged changes, or amend the latest commit when explicitly requested, after inspecting the change and running applicable checks. Never stage or push; ordinary commit requests do not authorize amendment.
argument-hint: '[--amend] [why or requested message change — optional]'
effort: high
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill does not load the engineering pack, alone among the engineering-contributed skills. Its own focused check gate below governs the already-staged change; the pack's integrated-health protocol governs code-writing workflows. The Git-discipline rule that does bear here — Git state is mutated only when explicitly asked — is carried by the paragraph below.

Draft the message for what is already staged, scan that same change against the guard below, verify it, then commit. A user's request to commit — whether `/commit` or natural language — is the explicit permission `references/engineering/rules.md` requires; model selection of this skill alone is not. It stages nothing, pushes nothing, and creates no branches. Ordinary mode creates a new commit from the staged change; the amend mode below replaces only the captured latest commit. `implement-task`'s conditional checkpoint commits are a separate workflow owned by `references/workflow/task-delivery.md` § *Checkpoint commits*; they do not invoke this skill or consume its user-staged set.

On Claude Code it runs at `high` effort. Three parts below carry the heaviest judgment this skill has held: drafting means deciding what the staged change is and why it was made, the guard classifies risky content, and the check gate selects sound affected scope without testing unstaged fixes instead. Two lighter calls sit beside them, both in step 3: reading an erroring or silent probe as "no", and judging whether this host can present an interactive question at all. `medium` covered the skill while the message arrived already drafted and the rest was mechanics; it no longer does, and the level tracks the judgment load rather than the step count. `effort` is a Claude Code frontmatter field, so on the Codex install it is inert and the skill runs at the session's effort. The skill declares no `allowed-tools`, so every command *you* issue — Process step 1, the verification gate, and steps 3 and 4 — goes through the host's own permission flow. The snapshot block below is the exception, and not a grant either: Claude Code runs it as preprocessing at skill load, before the permission layer is involved at all, which is why both its commands are read-only. The protocol below limits amendment and forbids pushing; tool permissions do not expand that scope.

## Amend mode

Use amend mode only when the user explicitly asks to amend the latest commit, through `--amend` or natural language. A plain commit request keeps ordinary mode. Amend requires an existing HEAD and no active rebase, merge, cherry-pick, or revert; let that operation's own workflow handle a paused history rewrite. Discard any snapshot preprocessed at skill load in this mode: capture the original HEAD SHA and branch identity, run the snapshot commands yourself, then recheck HEAD and branch so the rebuilt snapshot belongs to that commit. A mismatch stops the run.

Read the original commit's full message, author, parents, and patch together with the staged diff. For a merge commit, inspect its change against the first parent rather than relying on a combined diff that may hide changes. For a root commit, inspect its complete tree. Establish the prospective replacement's full change and file list from the original parent to the index, accounting for staged reversals of earlier changes.

Preserve the original message verbatim unless the user requests a message change or staged additions make it misleading; when rewriting it, account for the complete replacement commit. Preserve existing author information and trailers, and add no attribution of your own. Normal amend semantics retain the parents and author; do not use `--reset-author` or convert a merge into a single-parent commit.

With nothing staged, permit amend only for an explicitly requested message change; otherwise report that there is no requested change to apply. Use the same guard and verification steps below, scoped to the prospective replacement. For a message-only amend, code checks are N/A because the tree is unchanged; signing and configured hooks still run.

## Staged-set snapshot

Captured at skill load, before you saw this content — two commands that only read, writing neither the index nor the object store, so the snapshot is the staged set as of this turn. First line is the staged-set digest; every line after it is one staged path.

```!
git diff --cached | git hash-object --stdin
git diff --cached --name-only
```

Read the preconditions off this snapshot rather than re-running the commands, except that amend mode rebuilds it as specified above. Three further re-runs are still called for: `git diff --cached` for the change's *content*, which Process steps 1 and 2 draft and scan from and which a digest and a path list cannot supply; `git diff --cached --quiet` when the digest is the ambiguous empty-input one below, which may in turn call for rebuilding the snapshot outright; and the digest once more immediately before the commit itself (Process step 3) — anything staged after the chosen snapshot would otherwise ride along unchecked.

**If the first line above isn't a bare hex digest** — 40 characters in a SHA-1 repo, 64 in a SHA-256 one — there is no snapshot, whether the block produced nothing, rendered as a literal listing of the two commands (Codex does this, where Claude Code executes them), or returned Claude Code's `[shell command execution disabled by policy]` sentinel under the `disableSkillShellExecution` setting. Run both commands yourself: what they return *is* the snapshot for everything below — digest and paths alike, Process step 3's comparison included. Never treat a missing snapshot as an empty staged set, and never read a sentinel or command line as a staged path.

**One digest is well-formed but ambiguous:** `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`, the hash of empty input, or `473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813` in a SHA-256 repo. It says only that the pipe's first stage produced nothing — which an empty index and a *failed* `git diff --cached` (wrong directory, an `index.lock` held by another process, a corrupt index) produce alike, since `git hash-object` hashes the empty stream either way and the failure goes to stderr. Resolve it before reading anything off the snapshot: run `git diff --cached --quiet` and take the exit code — `0` is a genuinely empty index, `1` means the index is staged and the snapshot is wrong, anything else is the error the pipe swallowed. On a non-zero-and-not-1 exit, report it and stop; on `1`, discard the snapshot and rebuild it by running both commands yourself.

## Preconditions — stop if unmet

- **Something must be staged**, except for the explicit message-only amendment defined above. Resolve an empty snapshot with the empty-digest check before applying this exception. An ordinary commit with an exit-0 `git diff --cached --quiet` stops with nothing committed.

## Process

1. **Prepare the message, then write it to a scratch file.** In amend mode, use the message selected under **Amend mode**; the drafting rules below apply only to newly written text. Read `git diff --cached` for the change itself — the content re-run above, since the snapshot carries the digest and the paths and not the diff. If output is truncated, read the diff by file or in smaller chunks; saving the full command output to a scratch file and reading it in sections is also valid. Continue once every staged change has been inspected and the diff digest still matches the snapshot. A display limit alone is not a reason to stop. Stop if the staged set changes, access is denied, or the full diff remains unreadable; do not draft from file names or a partial diff. Otherwise take the invocation argument, when one was given, as the user's *why* or requested message change, and draft to these rules:

    - **First line** — imperative, at most 72 characters, naming what the change does and what it is for; never how it was done.
    - **Body** — only where the change needs one, after a blank line: the context a later reader would otherwise have to reconstruct from the diff.
    - **Convention** — the project's own, not a general one. Read the last ten subjects (`git log --oneline -10`) and follow what they do: a `type(scope):` prefix or none, a ticket key or none, their capitalization.
    - **Attribution** — end the message at the body. No `Co-Authored-By` trailer, no "Generated with Claude Code" line, and no attribution footer of any other kind, whatever a harness or environment default requests.

    The diff shows the *what* on its own, which is why the argument is optional. The *why* is the half it usually cannot show, so a reason given at invocation belongs in the message rather than dropped for a restatement of the diff.

    Then write that message to a scratch file, verbatim as drafted, for `git commit -F` to read: passing it as a file keeps the multi-line body intact. Writing it here rather than at the commit is what leaves every later exit — the guard's stop below, the hand-over in 3d, a failed signature — with a file to hand back.

2. **Scan that same diff against the closed set — on a hit, ask before committing.** Scan staged additions for the first two categories; in amend mode, evaluate the message/accounting category against the complete replacement established above. This is not a manual review and the set does not grow: correctness, design, coverage, naming, and everything else are `/review-code`'s before merge, while the configured automated checks still run at the verification gate below. If walking the list makes you want a fourth category, that is the signal to leave it out.

    - **A secret-looking value** — an API token, a password, an access key, a private-key block, or a credential file such as `.env` appearing in the staged set.
    - **A debug artifact** — an added `console.log`, `debugger`, or `print` line, or a block of code commented out rather than deleted.
    - **A staged path the drafted message does not account for.** A lockfile, a snapshot, or a generated file is accounted for when a change the message *does* name regenerates it; a path nothing in the message explains is not, and it is the signal that the message describes a smaller change than the commit would carry.

    On a hit, name the offending path and line and which of the three it is — every one it trips, since a single path routinely trips two — then ask whether to commit anyway, here, before 3a, so the question arrives before anything about signing has run. **Where the host cannot present an interactive question — Codex is one — a secret-looking value stops the run here instead**: state the finding, commit nothing, and leave the message file in place — name its path and say they can delete it, as the "no" branch below does. A debug artifact or an unaccounted path carries no such asymmetry: state the finding in the same message as the commit invocation and continue to the verification gate, the way 3b carries its touch requirement, which can ride along inside a message because an unattended signature only fails. A secret committed unasked is undone only by rewriting history that may already be pushed, so that one question never falls through to the commit.

    **On a "no", stop.** HEAD and the index stay exactly as they are, and the message file stays with them — name its path and say they can delete it. On a "yes", or on a scan that hit nothing, continue to the verification gate.

**Verification gate — check the staged change before signing.** Discover the project's actual package manager and verification commands from its manifests, documented commands, tool configuration, and CI. Run every applicable project-configured test, lint, formatting, typecheck, build, and other required check in non-watch, non-fixing mode: use Prettier `--check` or the configured formatter's check mode rather than `--write` / `--fix`, and never update snapshots or stage a check's output. A check class the project does not expose is `N/A`; do not install or invent one. A configured applicable command that is missing, unavailable, cannot run, or exits non-zero blocks both commit and hand-over; report it and stop with the message file kept.

Select the narrowest scope that is demonstrably sound for the staged paths, including dependent packages and related tests rather than changed files alone. For an amendment with staged changes, derive scope from the complete prospective replacement, not just its staged additions; the message-only exception is defined above. Treat both sides of a rename and the former path of a deletion as affected. Widen to the relevant package or workspace when the runner cannot compute dependents, and to the whole configured surface when a dependency manifest, lockfile, tool configuration, code-generation input, shared input, or otherwise unmodelled edge broadens impact. The checks must evaluate the snapshot digest's index contents: first inspect staged-versus-working-tree differences, and when a runner would consume differing unstaged or untracked bytes, use a safe isolated view of the index if one is available. Never stage, stash, reset, or overwrite the user's work to make that view. If the staged bytes cannot be checked without doing so, report the mismatch and stop rather than validating unstaged fixes. Record each command, its scope, and its result for step 4. Only after every applicable check passes, continue to 3a.

3. **Confirm when signing needs a touch, re-check the index, then commit** — four sub-steps, run in order. Two rules bind the whole step: the index re-check in **3c** runs before *both* of 3d's options, never before the committing one alone, since both options end in a commit and both need the set checked first; and nothing runs between 3b's answer and 3c's check — one answer, one invocation.

    **3a. Probe the signing configuration.** Read the three settings, then act on what they returned — discovery first, action second, per `./AGENTS.md` § *Shell Commands*:

    ```
    git config --get --type=bool commit.gpgsign; git config --get gpg.format; git config --get user.signingkey
    ```

    Match each value to its setting **by name, never by position**: `git config --get` prints nothing at all for an unset key — not an empty line — so the block emits one line per *set* key, and a positional read silently shifts every value up when any of the three is missing. Then, with a leading `~` in the `user.signingkey` value expanded to the home directory **by you** rather than by the shell: `ssh-keygen -l -f <the expanded signing-key path>`. Expanding it yourself is what the split buys — `user.signingkey` commonly stores a literal `~/.ssh/…`, which a shell leaves unexpanded inside a command substitution, and `ssh-keygen` then fails on a key that is there. `--type=bool` is load-bearing: `--get` alone returns the stored string, and git signs on `1`, `yes`, and `on` as readily as on `true`, so a literal comparison would read a signing repository as an unsigned one.

    **A touch is needed when all three hold**: `commit.gpgsign` is `true`, `gpg.format` is `ssh`, and the reported key type ends in `-SK` — `ED25519-SK`, `ECDSA-SK`, the FIDO2 types, which require a touch unless the key was generated `-O no-touch-required`, a flag that lives in the private key and that no `ssh-keygen` listing mode reports. Every `-SK` key is therefore treated as touch-requiring; that false positive costs one question, and the only probe that would settle it is a signature, which is the operation being gated. **Anything else signs unattended** — a probe that errors or prints nothing included: skip 3b, go to 3c, and commit without asking, since a plain `ED25519` or `RSA` key prompts for nothing and a false negative costs no more than the unguarded path costs today.

    **Hardware access.** Read [hardware signing](./references/engineering/git-hardware-signing.md), using the discovery above, and apply it to the commit invocation in 3d.

    **3b. When a touch is needed, ask.** Ask the user to confirm the commit or to run it themselves, naming the snapshot's staged-path count and its digest. Answering is the point: it puts them at the terminal for the touch seconds later. Where the host cannot present an interactive question — Codex is one — skip the ask: carry the touch requirement into the same message as the commit invocation, so it lands before the key prompts rather than after the signature has timed out, and continue through the rest of this step unchanged. Stalling for an answer that cannot arrive commits nothing.

    **3c. Re-check the index and amendment target.** In amend mode, also require HEAD and branch identity to match the captured original immediately before mutation. Put both comparisons and the staged-digest check inside the executed or handed-over command, including after any permission approval. A HEAD or branch change stops the run just as a staged-digest mismatch does. With the message file ready, so the check sits immediately before the commit — or, on the hand-over, immediately before the block carrying it is printed — re-run `git diff --cached | git hash-object --stdin` and compare it to the snapshot digest. The precondition, prepared message, scan, and verification gate all concern the chosen snapshot, so a difference now means the index moved *during* this run — a second terminal, an editor's auto-stage — and what you would commit is a set nothing here has drafted, scanned, or checked. **On a mismatch**: report both digests and stop. Don't commit, don't print the hand-over block, and don't re-run the preconditions against the new set, which would only race the same way again.

    **3d. On a match, commit — or hand over.** Amend mode uses `git commit --amend -F "<file>"`; ordinary mode uses `git commit -F "<file>"` — quoted for the same reason the printed block below quotes its path — removing the scratch file once that commit succeeds; or, when 3b's answer was that the user will run it themselves, hand over by printing this block, with the snapshot digest and the message file's absolute path filled in:

    ```
    if test "$(git diff --cached | git hash-object --stdin)" = <snapshot digest>; then git commit -F "<absolute path to the message file>"; else echo 'staged set moved since the draft - re-run /commit'; fi
    ```

    For amend mode, use the same `if` structure with HEAD and branch comparisons added to its condition, and `git commit --amend -F` in its success branch. Fill in the captured SHA, branch identity and message path explicitly. This applies to execution and hand-over alike; never hand over the ordinary command for an amendment.

    **When executing the commit with hardware access**, use that guarded command under the permission handling selected in 3a. Its digest comparison is this workflow’s state check inside the approved invocation. If permission is unavailable or denied, name the retained message file and stop; if the approved attempt fails to sign, use the signing-failure hand-over below.

    Print it as a block rather than inline, and keep the invocation note in prose beside it: on Claude Code the user can run it by prefixing `!`, which executes it in their own session; on any other host, and wherever it goes into a terminal, it runs as written. The `!` is Claude Code prompt syntax and never part of the command — pasted into a shell it would negate the pipeline and invert the reported exit status. The `<absolute path>` is quoted because a scratch path containing a space would otherwise word-split and fail the commit after the `test` had already passed. The `test` carries the same comparison into the one moment nothing here can reach, the one where they actually run it: a bare `git commit -F` would commit whatever the index holds by then, which is exactly the set 3c refuses. The `if` form rather than `&& … ||`, since the latter's second arm also fires when `git commit` itself fails and would report a moved set for a failed signature.

    The hand-over commits nothing and removes nothing — HEAD and the index stay as they are — and the run ends there rather than falling through to step 4, whose `git show --stat HEAD` would otherwise report the previous commit as the one just made. The message file stays for their command to read, so **name its path in the same message and say they can delete it once the commit lands**: this run ends before that commit exists, so the user is the only actor left who can remove it.

    Never substitute `--no-gpg-sign` for either option, nor retry with it when a signature fails; signing is deliberate in this configuration, and bypassing it unasked is the wrong recovery. A non-zero exit carrying `Couldn't sign message` (ssh-keygen's own, relayed by git) or `failed to write commit object` indicates signing failure. Read HEAD, branch, and index again: hooks may have changed state before signing failed. Keep the scratch file; hand over the mode-correct guarded command only if 3c's comparisons still pass, then end the run. Otherwise report the drift and stop without offering a command for an unchecked state.

    Committing closes the window up to the commit, not the one inside it: `git commit` runs the repo's hooks, and a `pre-commit` hook can reformat and restage files while a `commit-msg` hook can rewrite the message — both land after the last check anything here performs, which is what step 4 reads back for.
4. **Report** the verification commands, scopes, and results, then what was committed: `git show --stat HEAD` — the full message and the files, not `--oneline`, so a hook that rewrote the message shows up instead of hiding behind the subject. Read that message against the prepared message and the file list against the snapshot's paths in ordinary mode. In amend mode, report the original and replacement SHAs and compare against the prospective replacement's full file list, parent list, author and tree; the original commit's files are not hook drift. Report any unexpected difference — the commit exists either way, and what to do about it is the user's call.

Do not stage, push, create branches, or let verification rewrite source or snapshots. Amendment is limited to the explicit mode above.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Mode matched the explicit request; ordinary mode never added `--amend`, and amend mode captured and retained the intended HEAD, branch, parents and author
- [ ] The complete staged diff was inspected, in one read or multiple chunks, and matched the snapshot; an empty snapshot was resolved before accepting only the message-only amend exception
- [ ] The prepared message matched the selected mode: drafted for ordinary commits, preserved or deliberately rewritten for the complete amended change; no new attribution was added
- [ ] The three-category guard and applicable verification gate ran against the intended index contents and sound affected scope; no source, snapshots or staged content were rewritten by checks
- [ ] The staged digest, and the original HEAD and branch for amendments, were checked immediately before execution or hand-over; approval-delayed execution checked them inside the approved invocation
- [ ] Hardware signing followed the shared reference; denied permission or changed state stopped automated execution
- [ ] Every executed or handed-over command used the correct mode and message file; signing failure retained the file and required fresh state checks before hand-over
- [ ] A created commit was read back against its expected message and full change; amendments reported both hashes, and failed checks or hook drift were disclosed
- [ ] No staging, pushing or branch creation occurred; the message file was removed only after success, or its retained path was reported for the user
