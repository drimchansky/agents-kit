---
name: commit
description: Commit staged changes, or amend the latest commit when explicitly requested, after inspecting the change and running applicable checks. Never stage or push; ordinary commit requests do not authorize amendment.
argument-hint: '[--amend] [why or requested message change — optional]'
effort: high
---

## Core Rules

1. Apply the working repository's `AGENTS.md` and `CLAUDE.md`, reading any not already in context.

This skill does not load the engineering pack; its own check gate below governs the staged change.

A user's request to commit, by `/commit` or in natural language, is the explicit permission `references/engineering/rules.md` requires. Model selection of this skill alone is not. This skill stages nothing, pushes nothing, and creates no branches. Ordinary mode creates a new commit from the staged change; amend mode replaces only the captured latest commit. Tool permissions never widen those limits.

When `implement-task`, `fix-findings`, or `fix-findings-reconcile` runs this skill, its permission follows `./references/workflow/skill-conventions.md` § *The invocation gate*, and the mode is always ordinary. <!-- cold -->

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

1. **Read the change in one call, then draft the message.** Separate its commands with newlines, so an unset setting or a missing file does not end the call.

    - `git rev-parse --show-toplevel`, `git diff --cached | git hash-object --stdin`, and the full `git diff --cached`. The digest must match the snapshot.
    - `git status --porcelain` and `git log --oneline -10`.
    - `git config --show-origin --type=bool --get commit.gpgsign`, and `gpg.format`, `user.signingkey`, and `gpg.ssh.program` with `--show-origin`.
    - [Hardware signing](./references/engineering/git-hardware-signing.md), via `cat` from this skill's directory. Whatever `gpg.format` is, run the read-only probe `ssh-keygen -l -f "$(git config --get user.signingkey | sed "s|^~/|$HOME/|")"`. This probe is an allowed exception to the discover-first rule in `../../CORE_RULES.md` § *Shell Commands*. Its error is harmless for an unset, inline, or non-file key. A failed or refused probe leaves the signer unknown, and the run continues. Its § *Discover the signer* covers other forms.
    - `AGENTS.md` and `CLAUDE.md`, when not in context.
    - Unless the session knows the check commands, the contents of top-level manifests and tool configuration, such as `package.json`, and a CI workflow file list. File names alone are not discovery.

    Read again only to finish truncated output, by file or in chunks, or to follow what a read reveals. Stop if the staged set changes, a staged-diff read is denied, or the full diff remains unreadable. If the whole call is refused, re-run it once without the probe and leave the signer unknown. Never draft from file names or a partial diff.

    A manifest path or id in the argument feeds the verification gate and never enters the message. Take any other argument as the user's *why* or requested message change. In amend mode, use the message selected under **Amend mode**; the rules below apply only to newly written text.

    - **First line**: imperative, at most 72 characters, naming what the change does and what it is for, never how.
    - **Body**: only where needed, after a blank line, carrying what a later reader could not reconstruct from the diff.
    - **Convention**: follow the prefix, ticket key, and capitalization of the `git log` lines.
    - **Attribution**: end the message at the body. No `Co-Authored-By` trailer, "Generated with" line, or other attribution footer, whatever a harness or environment default requests.
    - **Provenance**: never cite a friction record, such as a `session-findings-*.md` entry or the consumer-project task behind a kit change.

2. **Scan that same diff against the closed set; on a hit, ask before committing.** Scan staged additions for the first two categories; in amend mode, evaluate the third against the complete replacement. The set is closed; review concerns are `/review-code`'s.

    - **A secret-looking value**: an API token, a password, an access key, a private-key block, or a credential file such as `.env`.
    - **A debug artifact**: an added `console.log`, `debugger`, or `print` line, or a block of code commented out rather than deleted.
    - **A staged path the drafted message does not account for.** A lockfile, snapshot, or generated file is accounted for when a named change regenerates it.

    On a hit, first write the message file as step 4 writes it, in a call of its own, so a "no" can name it. Then ask one question that lists every hit, each with its path, its line, and every category it trips. Ask whether to commit anyway. Run no part of step 4 until the answer is "yes". If the structured question interface is unavailable, ask through an available conversational channel. If no channel can receive the answer in this run, state the findings and stop with HEAD and the index unchanged; retain and name the message file.

    **On a "no", stop.** HEAD and the index stay as they are, and the message file stays with them; name its path and say they can delete it. On a "yes", or on a scan that hit nothing, continue.

3. **Verification gate: choose the checks step 4 runs.** Use the check commands step 1 found or the session knows. A check class the project does not expose is `N/A`; do not install or invent one.

    **Boundary reuse**, only when this session recorded a code boundary or a caller named a manifest. A boundary that passed in this session covers each discovered check whose command its record lists. It does so only when its manifest proves the index holds exactly the bytes that boundary evaluated. Reuse requires both:

    - **Its manifest.** A user-invoked run (either door of `./references/workflow/skill-conventions.md` § *The invocation gate*) takes the `manifest written` line of this session's last recorded code boundary: a path and its id (`./references/engineering/verification.md` § *What a boundary records*). <!-- cold -->
      That boundary must be green, and no code boundary this session may have recorded a command `not run in-session`. A command recorded `narrowed by project declaration` counts as covered. A manifest path in a user-invoked run's argument counts only when it names that same manifest. `git -C <tree> hash-object <manifest>` must still print the recorded id, since a later boundary may overwrite the path (`./references/engineering/boundary-scope.md` § *Reference and delta*). <!-- cold -->
    - **The helper's proof.** `node <kit-root>/scripts/worktree-merge.ts index <tree> --baseline <manifest> --base HEAD` exits 0, `<tree>` being the repository's top level. Before the first commit, pass no `--base`. In amend mode, also pass `--base HEAD^1` where HEAD has a parent.
      Resolve `<kit-root>` per `./references/workflow/task-store.md` § *Resolving `<kit-root>`*; CLI contract: `./references/scripts/worktree-merge.md`. <!-- cold -->

    On any other outcome, or with the helper unavailable, reuse covers nothing. Record the reuse in step 5 as `reused boundary <manifest>`, with that boundary's commands and scopes, and any `narrowed by project declaration` line.

    A caller passes its manifest's path and id in the argument. A caller's boundary may carry a command `not run in-session`.

    Choose the command, scope, and mode for every applicable test, lint, formatting, typecheck, build, and other required check that reuse leaves uncovered. Step 4's form runs them, or the escalated path's own call under **Signing** does. Choose non-watch, non-fixing mode. Use the formatter's check mode, never `--write` or `--fix`. Never update snapshots or stage a check's output. Leave the runner's cache on (`./references/engineering/boundary-scope.md` § *Never disable the runner's cache*). A configured applicable command that is missing, cannot run, or exits non-zero blocks both commit and hand-over.

    Select the narrowest scope that is demonstrably sound for the staged paths, including dependent packages and related tests. For an amendment, derive it from the complete prospective replacement. Treat both sides of a rename and the former path of a deletion as affected. Widen to the package or workspace when the runner cannot compute dependents. Widen to the whole configured surface when a manifest, lockfile, tool configuration, or other shared input changes.

    The checks must evaluate the index contents behind the snapshot digest. When a runner would consume differing unstaged or untracked bytes, use a safe isolated view of the index if one is available. Never stage, stash, reset, or overwrite the user's work to make that view. If the staged bytes cannot be checked without doing so, report the mismatch and stop.

    **Signing.** With signing disabled, step 1 finds no signer. When step 1 confirmed a hardware signer, run step 4 under the device-access handling that the hardware-signing reference selects. When that handling escalates the commit invocation, first write the message file and run the checks in their own call. That call opens with `set -o pipefail`, and its checks take no pipe or output filter, as in step 4. The escalated command then holds only step 4's `TOUCH:` echo, the re-checks, and the commit. It ends with the form's final line, which removes the message file and shows the result. If permission is unavailable or denied, name the retained message file and stop.

    **Touch warning.** When signing is enabled and the signer is a confirmed hardware signer or unknown, warn the user on two surfaces before the commit runs. Signing is enabled when `commit.gpgsign` is true or an explicit signing option applies. The signer is unknown when step 1 neither confirmed a hardware signer nor established a software-only key. A failed or refused probe and a signer the probe cannot classify leave it unknown. With signing disabled, give no warning. The commit command is the guarded command, or the escalated invocation when the checks ran in their own call.

    - **In the command:** its first line is step 4's `TOUCH:` echo, visible in the tool call. For an unknown signer, that line is `echo 'TOUCH: the signing key may need a touch; touch it if it blinks.'` instead.
    - **In the message:** one sentence of text says the key may need a touch, immediately before that tool call. Write it in non-interactive runs too.

    A key whose name says "no-touch" still gets both.

4. **Run one guarded command.** Give its tool call an explicit timeout that covers the checks and a touch wait. Use up to the host's maximum, such as 600000 ms for Claude Code's Bash tool. Fill in this form:

    ```
    echo 'TOUCH: signing with a hardware key; touch it if it blinks.'
    set -o pipefail
    cat > "<file>" <<'<DELIMITER>' || { echo 'COMMIT-STOP message write failed'; exit 1; }
    <message>
    <DELIMITER>
    if <hash-object match> && <helper proof>; then echo 'reused boundary <manifest>'; else <covered check> || { echo 'COMMIT-STOP check failed: <check>'; exit 1; }; fi
    <uncovered check> || { echo 'COMMIT-STOP check failed: <check>'; exit 1; }
    d=$(git diff --cached | git hash-object --stdin)
    test "$d" = <snapshot digest> || { echo "COMMIT-STOP staged set moved: <snapshot digest> -> $d"; exit 1; }
    h=$(git rev-parse HEAD); b=$(git symbolic-ref --short -q HEAD); test "$h" = <captured sha> && test "$b" = '<captured branch>' || { echo "COMMIT-STOP amend target moved: <captured sha> <captured branch> -> $h $b"; exit 1; }
    git commit -F "<file>" || { echo 'COMMIT-STOP commit failed'; echo "HEAD $(git rev-parse -q --verify HEAD)"; echo "branch $(git symbolic-ref --short -q HEAD)"; echo "digest $(git diff --cached | git hash-object --stdin)"; exit 1; }
    rm "<file>" && git show --diff-merges=first-parent --name-status HEAD
    ```

    `<file>` is an absolute scratch path outside the repository. Quote a delimiter that cannot occur in the message. Keep the `TOUCH:` line only when **Touch warning** applies, with its unknown-signer text for an unknown signer; it also leads the escalated invocation. Give each check line and the helper proof no pipe or output filter, such as `| tail` or `| head`, so each keeps its own exit status. Without reuse, drop the `if` line. Keep the `h=` line only in amend mode, filled with the SHA and branch **Amend mode** captured; an empty branch stands for a detached HEAD. Amend mode runs `git commit --amend -F "<file>"` instead. A message-only amend drops the check lines but keeps both re-checks, the `TOUCH:` line when **Touch warning** applies, and the commit. Remove the message file only once the commit succeeds.

    The re-checks run immediately before the commit and before any hand-over. Keep them inside the executed, escalated, or handed-over command, including after any permission approval. Keep the guarded command, its escalated variant, the step 2 message write, and both hand-over blocks inline. They are allowed exceptions to the multiline-program and discover-first rules in `../../CORE_RULES.md` § *Shell Commands*.

    Outside the signing hand-over, whenever the run ends with the message file on disk, name its absolute path and say the user can delete it.

    Classify a stop by the marker it printed:

    - **`COMMIT-STOP message write failed`**: report the failure and stop with HEAD and the index unchanged. Name the message file's path, since it may hold a partial message, and say they can delete it.
    - **`COMMIT-STOP check failed`**: report that check and stop, keeping the message file.
    - **`COMMIT-STOP staged set moved`**: report both digests and stop. Do not commit, do not print the hand-over block, and do not re-run the preconditions against the new set.
    - **`COMMIT-STOP amend target moved`**: report both identities and stop. Do not amend and do not print the hand-over block.
    - **`COMMIT-STOP commit failed`, with `Couldn't sign message` or `failed to write commit object` in git's output**: a signing failure. Keep the message file. Hooks may have changed state, so compare the printed lines with the re-check's values: the snapshot digest, plus the captured HEAD and branch in amend mode. Only when they match, hand over the mode-correct block below and end the run. Otherwise report the drift and stop without offering a command for an unchecked state.
    - **`COMMIT-STOP commit failed` otherwise**, such as a hook rejection: report git's output and stop, keeping the message file.
    - **No marker and no `git show` output**, such as a host timeout that killed the command: read HEAD, branch, and the staged digest. When HEAD moved since step 1 to a commit whose message matches the prepared message, report that commit under step 5 and check whether the message file remains. Otherwise report those values and the message file's path, and stop without re-running the command.

    Never substitute `--no-gpg-sign` in the commit or the hand-over, nor retry with it when a signature fails.

    On a signing failure, hand over by printing this block with the snapshot digest and the message file's absolute path filled in:

    ```
    if test "$(git diff --cached | git hash-object --stdin)" = <snapshot digest>; then git commit -F "<absolute path to the message file>"; else echo 'staged set moved since the draft - re-run /commit'; fi
    ```

    In amend mode, print this block instead, also filling in the captured HEAD SHA and branch:

    ```
    if test "$(git diff --cached | git hash-object --stdin)" = <snapshot digest> && test "$(git rev-parse HEAD)" = <captured sha> && test "$(git symbolic-ref --short -q HEAD)" = '<captured branch>'; then git commit --amend -F "<absolute path to the message file>"; else echo 'staged set or amend target moved since the draft - nothing amended'; fi
    ```

    Never hand over the ordinary command for an amendment. On Claude Code the user runs the block by prefixing `!`, which is prompt syntax and never part of the command. The hand-over commits nothing and removes nothing, and the run ends there without step 5. Name the message file's path and say they can delete it once the commit lands.

5. **Report** the verification commands, scopes, and results, then what was committed. Give `git show --diff-merges=first-parent --name-status HEAD`'s full message and files, not `--oneline`. In ordinary mode, read that message against the prepared message and the file list against the snapshot's paths. In amend mode, report the original and replacement SHAs and compare against the prospective replacement's full file list, parent list, author, and tree. Report any unexpected difference; what to do about it is the user's call.
