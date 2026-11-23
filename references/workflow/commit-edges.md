# commit: Separate Checks and Stops

Read the applicable section when its `commit` trigger fires. `commit §N` refers to that skill's process step. The separate checks call and both hand-over blocks are allowed inline exceptions to the multiline-program and discover-first rules in `../../CORE_RULES.md` § *Shell Commands*.

## Separate checks call

When the checks may run past the host's maximum tool timeout, launch this call in background mode under `./delegated-waiting.md` § *Shell commands*. Collect its output and exit status before classifying its ending. Use commit §4's message write and its full check block, including the `errexit` save and restore and any reuse `if` block. Keep the redirects and `COMMIT-STOP` markers unchanged. An exit 0 with no marker continues to the guarded command; any other ending takes § *Stop classification*. The guarded command then holds only commit §4's `TOUCH:` line when it applies, the re-checks, the commit, and the form's final line. That final line removes the message file and the log and shows the result.

## Stop classification

Use the output marker to classify a stop when one is present. Otherwise classify by the call that stopped.

- **`COMMIT-STOP message write failed`**: report the failure and stop with HEAD and the index unchanged. Name the message file's path, since it may hold a partial message, and say they can delete it.
- **`COMMIT-STOP check failed`**: map the printed label to its command from your record. Report that command and its printed tail, and stop. Keep the message file and the log, and name the log's path.
- **`COMMIT-STOP staged set moved`**: report both digests and stop. Do not commit, do not print the hand-over block, and do not re-run the preconditions against the new set.
- **`COMMIT-STOP staged set unreadable`**: report the failure and stop with HEAD and the index unchanged. Keep the message file, and name its path and any log's.
- **`COMMIT-STOP amend target moved`**: report both identities and stop. Do not amend and do not print the hand-over block.
- **`COMMIT-STOP commit failed`, with `Couldn't sign message` or `failed to write commit object` in git's output**: a signing failure. Keep the message file. Hooks may have changed state, so compare the printed lines with the re-check's values: the snapshot digest, plus the captured HEAD and branch name in amend mode. Only when they match, hand over the mode-correct block below and end the run. Otherwise report the drift and stop without offering a command for an unchecked state.
- **`COMMIT-STOP commit failed` otherwise**, such as a hook rejection: report git's output and stop, keeping the message file.
- **Unsuccessful separate checks call with no marker**: report that the checks were interrupted before this run attempted a commit.
- **Guarded command with neither a marker nor `git show` output**: report that the commit outcome is uncertain. Treat a matching message or file list as inconclusive.

For either interruption, read HEAD, branch, and the staged digest. Report the observed state and any drift from the recorded state. Keep any remaining message file and log and name their paths. Stop without re-running either call.

## Signing hand-over

On a signing failure, hand over by printing this block with the snapshot digest and the message file's absolute path filled in:

```
if ! d=$(set -o pipefail && git diff --cached | git hash-object --stdin); then echo 'staged set unreadable - re-run /commit'; elif test "$d" = <snapshot digest>; then git commit -F "<absolute path to the message file>"; else echo 'staged set moved since the draft - re-run /commit'; fi
```

In amend mode, print this block instead, also filling in the captured HEAD SHA and branch hash:

```
(
    d=$(set -o pipefail && git diff --cached | git hash-object --stdin) || { echo 'staged set unreadable - nothing amended'; exit 1; }
    test "$d" = <snapshot digest> || { echo 'staged set or amend target moved since the draft - nothing amended'; exit 1; }
    h=$(git rev-parse --verify HEAD) || { echo 'amend target unreadable: HEAD - nothing amended'; exit 1; }
    if branch_ref=$(git symbolic-ref -q HEAD); then
        branch_ref+=$'\n'
    else
        branch_status=$?
        test "$branch_status" -eq 1 || { echo "amend target unreadable: branch lookup exited $branch_status - nothing amended"; exit 1; }
        branch_ref=
    fi
    b=$(printf '%s' "$branch_ref" | git hash-object --stdin) || { echo 'amend target unreadable: branch hash - nothing amended'; exit 1; }
    test "$h" = <captured sha> && test "$b" = <captured branch hash> || { echo 'staged set or amend target moved since the draft - nothing amended'; exit 1; }
    git commit --amend -F "<absolute path to the message file>"
)
```

Never paste a branch name into the command. Never hand over the ordinary command for an amendment. On Claude Code the user runs the block by prefixing `!`, which is prompt syntax and never part of the command. The hand-over commits nothing and removes nothing, and the run ends there without commit §5. Name the paths of the message file and any log, and say they can delete them once the commit lands.
