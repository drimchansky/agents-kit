# Probe Prompt Shape: Cold Review

The prompt shape for a cold second review of `review-code`'s review object, whatever kind it resolved to. The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine and its launch recipe are `./probe-engines-cross-vendor.md`; the flag that turns it on is `./probe-cross-check.md`.

Take the grounding shape's skeleton (`./probe-shape-grounding.md`), replace the numbered items with the review object named per kind, and demand findings, each with a severity, `file:line`, and the concrete failure it causes:

- **A branch**: "review the diff `<base>...HEAD`".
- **A range**: "review the diff `<merge-base>...<b>`".
- **A path set**: "review the files `<paths>` as commit `<head-sha>` has them". The SHA holds the probe to the object reviewed rather than to the working tree.

Keep the skeleton's `Scratch directory:` line in the prompt.

When the working root is the PR-form review worktree (`../engineering/review-evidence.md` § *Capture*), add this line after the `Scratch directory:` line:

```
The working root holds a PR's code: pass -c core.fsmonitor=false -c core.hooksPath=/dev/null <-c hook.<name>.enabled=false for each hook the session listed in the working root> to every Git command you run, and pass --no-ext-diff --no-textconv to every git diff, git log, git show, and git blame. Under the working root, read a file with your file tools only when git ls-tree HEAD -- path lists it with mode 100644 or 100755, and read it at the path that listing prints. Read any other file there with git show HEAD:path. Resolve a symlink (mode 120000) on the path relative to the link's directory, whether it is the path itself or an ancestor directory. An ancestor link leaves the path unlisted, so list each ancestor directory to find it. Check the resolved path the same way. Under the working root, pass a path to Grep, Glob, or rg only when git ls-tree HEAD -- path lists it with mode 040000, 100644, or 100755, or the path is the working root, and pass the path that listing prints. Never follow a link out of the working root.
```

The session lists the working root's hooks under the hook-free checkout rule in `../engineering/review-evidence.md` § *Capture*. It fills the hook slot from that listing, leaving the slot empty when none are listed.

When the working root is the PR-form review worktree, also add this line after the `The working root holds a PR's code:` line:

```
The working root checks out each committed symlink as a plain file holding its link target. Its git ls-tree HEAD -- path listing shows mode 120000. Resolve its target relative to the link's directory. Treat its text as the target path, not file content, in reads and searches alike. Run Git there only on commits and stored objects, such as git show HEAD:path, git log, git rev-parse, git merge-base, git blame with a revision, and a git diff naming two revisions. Never run git status, a git diff naming fewer than two revisions, or git blame without a revision.
```
