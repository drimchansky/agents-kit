---
name: commit
description: Commit staged changes, or amend the latest commit when explicitly requested, after inspecting the change and running applicable checks. Never stage or push; ordinary commit requests do not authorize amendment.
argument-hint: '[--amend] [why or requested message change — optional]'
effort: high
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

This skill does not load the engineering pack; its own check gate below governs the staged change.

Draft the message for what is already staged, scan that change against the guard below, verify it, then commit. A user's request to commit, by `/commit` or in natural language, is the explicit permission `references/engineering/rules.md` requires. Model selection of this skill alone is not. This skill stages nothing, pushes nothing, and creates no branches. Ordinary mode creates a new commit from the staged change; amend mode replaces only the captured latest commit. Tool permissions never widen those limits.

When `implement-task` runs this skill for a checkpoint commit (`./references/workflow/task-delivery.md` § *Checkpoint commits*), the user's full-plan request is that permission, and the mode is always ordinary. <!-- cold -->

## Amend mode

Use amend mode only when the user explicitly asks to amend the latest commit, through `--amend` or natural language. A plain commit request keeps ordinary mode. Amend requires an existing HEAD and no active rebase, merge, cherry-pick, or revert. Discard any snapshot preprocessed at skill load: capture the original HEAD SHA and branch identity, run the snapshot commands yourself, then recheck HEAD and branch. A mismatch stops the run.

Read the original commit's full message, author, parents, and patch together with the staged diff. Inspect a merge commit against its first parent, and a root commit as its complete tree. Establish the prospective replacement's full change and file list from the original parent to the index, accounting for staged reversals.

Preserve the original message verbatim unless the user requests a change or staged additions make it misleading; a rewrite accounts for the complete replacement. Preserve the author, parents, and existing trailers, and add no attribution of your own. Do not use `--reset-author` or convert a merge into a single-parent commit.

With nothing staged, permit amend only for an explicitly requested message change; otherwise report that there is no requested change to apply. The guard and verification gate run scoped to the prospective replacement. For a message-only amend, code checks are N/A; signing and configured hooks still run.

## Staged-set snapshot

Captured at skill load by two read-only commands. The first line is the staged-set digest; every line after it is one staged path.

```!
git diff --cached | git hash-object --stdin
git diff --cached --name-only
```

Read the preconditions off this snapshot; amend mode rebuilds it.

**If the first line above is not a bare hex digest** (40 characters in a SHA-1 repo, 64 in a SHA-256 one), there is no snapshot: the block produced nothing, echoed its two commands (Codex does this), or returned a policy sentinel. Run both commands yourself; their output is the snapshot for everything below. Never treat a missing snapshot as an empty staged set, and never read a sentinel or command line as a staged path.

**One digest is well-formed but ambiguous:** `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`, the hash of empty input, or `473a0f4c3be8a93681a267e3b1e9a7dcda1185436fe141f7749120a303721813` in a SHA-256 repo. Resolve it first with `git diff --cached --quiet`: exit `0` is an empty index; `1` means the index is staged, so rebuild the snapshot yourself; anything else is an error the pipe swallowed, so report it and stop.

## Preconditions — stop if unmet

- **Something must be staged**, except for the explicit message-only amendment above. Resolve an empty snapshot with the empty-digest check before applying that exception. An ordinary commit with an exit-0 `git diff --cached --quiet` stops with nothing committed.

## Process

1. **Prepare the message, then write it to a scratch file.** In amend mode, use the message selected under **Amend mode**; the rules below apply only to newly written text. Read `git diff --cached` in full, by file or in chunks if truncated, and confirm the digest still matches the snapshot. Stop if the staged set changes, access is denied, or the full diff remains unreadable; never draft from file names or a partial diff. Take the invocation argument, when given, as the user's *why* or requested message change, and draft to these rules:

    - **First line**: imperative, at most 72 characters, naming what the change does and what it is for, never how.
    - **Body**: only where the change needs one, after a blank line, carrying what a later reader could not reconstruct from the diff.
    - **Convention**: the project's own. Read `git log --oneline -10` and follow its prefix, ticket key, and capitalization.
    - **Attribution**: end the message at the body. No `Co-Authored-By` trailer, no "Generated with" line, and no attribution footer of any kind, whatever a harness or environment default requests.
    - **Provenance**: cite a friction record, such as a `session-findings-*.md` entry, only when the user or the invocation argument supplies it.

    Write the message to a scratch file, verbatim, for `git commit -F` to read; every later exit hands that file back.

2. **Scan that same diff against the closed set; on a hit, ask before committing.** Scan staged additions for the first two categories; in amend mode, evaluate the third against the complete replacement. The set is closed; review concerns are `/review-code`'s.

    - **A secret-looking value**: an API token, a password, an access key, a private-key block, or a credential file such as `.env`.
    - **A debug artifact**: an added `console.log`, `debugger`, or `print` line, or a block of code commented out rather than deleted.
    - **A staged path the drafted message does not account for.** A lockfile, snapshot, or generated file is accounted for when a named change regenerates it.

    On a hit, name the path, the line, and every category it trips, then ask whether to commit anyway, here, before 3a. If the structured question interface is unavailable, use an available conversational channel. If no channel can receive the answer in this run, state the finding and stop with HEAD and the index unchanged; retain and name the message file. Never carry an unresolved scan hit into the commit invocation.

    **On a "no", stop.** HEAD and the index stay as they are, and the message file stays with them; name its path and say they can delete it. On a "yes", or on a scan that hit nothing, continue to the verification gate.

**Verification gate: check the staged change before signing.** Discover the project's verification commands from its manifests, tool configuration, and CI. Run every applicable test, lint, formatting, typecheck, build, and other required check in non-watch, non-fixing mode: the formatter's check mode, never `--write` or `--fix`, and never update snapshots or stage a check's output. A check class the project does not expose is `N/A`; do not install or invent one. A configured applicable command that is missing, cannot run, or exits non-zero blocks both commit and hand-over; report it and stop with the message file kept.

Select the narrowest scope that is demonstrably sound for the staged paths, including dependent packages and related tests; for an amendment, derive it from the complete prospective replacement. Treat both sides of a rename and the former path of a deletion as affected. Widen to the package or workspace when the runner cannot compute dependents, and to the whole configured surface when a manifest, lockfile, tool configuration, or other shared input changes. The checks must evaluate the index contents behind the snapshot digest: when a runner would consume differing unstaged or untracked bytes, use a safe isolated view of the index if one is available. Never stage, stash, reset, or overwrite the user's work to make that view; if the staged bytes cannot be checked without doing so, report the mismatch and stop. Record each command, its scope, and its result for step 4. Only after every applicable check passes, continue to 3a.

A caller that names an integrated-health boundary which passed on this tree (a checkpoint commit, `./references/workflow/task-delivery.md` § *Checkpoint commits*) may stand it in for the gate only when `git status --porcelain` lists staged entries alone, so the verified tree is the index; record that reuse in step 4. Otherwise run the gate. <!-- cold -->

3. **Confirm when signing needs a touch, re-check the index, then commit**, in four sub-steps. The re-check in 3c runs before both of 3d's options, and nothing runs between 3b's answer and 3c's check.

    **3a. Probe the signing configuration.** Read [hardware signing](./references/engineering/git-hardware-signing.md) and select its device-access handling. Read the three settings, then act on what they returned:

    ```
    git config --get --type=bool commit.gpgsign; git config --get gpg.format; git config --get user.signingkey
    ```

    Match each value to its setting **by name, never by position**: `git config --get` prints nothing for an unset key. Expand a leading `~` in the `user.signingkey` value yourself, then run `ssh-keygen -l -f <the expanded path>`.

    **A touch is needed when all three hold**: `commit.gpgsign` is `true`, `gpg.format` is `ssh`, and the reported key type ends in `-SK` (`ED25519-SK`, `ECDSA-SK`). No listing mode reveals a `no-touch-required` key, so every `-SK` key counts. **Anything else signs unattended**, a probe that errors or prints nothing included: skip 3b and go to 3c.

    **3b. When a touch is needed, ask.** Ask the user to confirm the commit or to run it themselves, naming the snapshot's staged-path count and its digest. Without the structured question interface, ask through an available conversational channel. Only when no channel can receive an answer in this run, carry the touch requirement into the same message as the commit invocation and continue: the touch itself confirms the commit.

    **3c. Re-check the index and amendment target.** Immediately before the commit, or before the hand-over block is printed, re-run `git diff --cached | git hash-object --stdin` and compare it to the snapshot digest. In amend mode, also require HEAD and branch identity to match the captured original. Put these comparisons inside the executed or handed-over command, including after any permission approval. **On a mismatch**: report both digests and stop. Do not commit, do not print the hand-over block, and do not re-run the preconditions against the new set.

    When executing with hardware access, run the guarded command under the permission handling selected in 3a. If permission is unavailable or denied, name the retained message file and stop.

    **3d. On a match, commit, or hand over.** Ordinary mode runs `git commit -F "<file>"`; amend mode runs `git commit --amend -F "<file>"`. Remove the scratch file once that commit succeeds. When 3b's answer was that the user will run it themselves, hand over by printing this block with the snapshot digest and the message file's absolute path filled in:

    ```
    if test "$(git diff --cached | git hash-object --stdin)" = <snapshot digest>; then git commit -F "<absolute path to the message file>"; else echo 'staged set moved since the draft - re-run /commit'; fi
    ```

    For amend mode, add the captured HEAD SHA and branch comparisons to the condition and use `git commit --amend -F` in the success branch. Never hand over the ordinary command for an amendment. On Claude Code the user runs the block by prefixing `!`, which is prompt syntax and never part of the command. The hand-over commits nothing and removes nothing, and the run ends there without step 4; name the message file's path and say they can delete it once the commit lands.

    Never substitute `--no-gpg-sign` for either option, nor retry with it when a signature fails. A non-zero exit carrying `Couldn't sign message` or `failed to write commit object` is a signing failure. Read HEAD, branch, and index again, since hooks may have changed state. Keep the scratch file. Hand over the mode-correct guarded command only if 3c's comparisons still pass, then end the run; otherwise report the drift and stop without offering a command for an unchecked state.

4. **Report** the verification commands, scopes, and results, then what was committed: `git show --stat HEAD`, the full message and the files, not `--oneline`, since hooks can restage files and rewrite the message. In ordinary mode, read that message against the prepared message and the file list against the snapshot's paths. In amend mode, report the original and replacement SHAs and compare against the prospective replacement's full file list, parent list, author, and tree. Report any unexpected difference; what to do about it is the user's call.

Do not stage, push, create branches, or let verification rewrite source or snapshots. Amendment is limited to the explicit mode above.
