---
name: apply-changes
description: Apply worktree changes to the main repo for review. Use when done working in a worktree and ready for the user to review and commit. Triggers on "apply changes", "ready for review", "done with changes", or when finishing implementation in a worktree.
---

# Apply Worktree Changes

Transfer changes from the current worktree to the main repository so the user can review diffs in VS Code Source Control and commit themselves.

## Prerequisites

- You must be in a worktree (check for `.git` file pointing to a gitdir, not a `.git` directory)
- Changes must be tested and linted before applying

## Steps

### 1. Identify the main repo path

Read the worktree's `.git` file to find the main repo.

### 2. Detect all changes

Compare the worktree's source files against the main repo. Use filesystem-level comparison rather than `git diff` — the worktree index may be unreliable. Cover all source directories, not just a hardcoded subset. Exclude build artifacts, dependencies, and generated files.

Categorize changes into:

- **Modified** — exist in both, content differs
- **New** — exist only in worktree
- **Deleted** — exist only in main repo (that you intentionally removed)
- **Renamed** — a delete + new with same content

### 3. Present a summary

Before copying, show the user a grouped summary of what will be applied. Wait for confirmation.

### 4. Apply changes to the main repo

Copy modified and new files to the main repo, preserving directory structure. Remove deleted files. Handle renames as delete + copy.

**IMPORTANT:**

- Do NOT run `git add`, `git commit`, or create branches in the main repo
- Do NOT copy non-source files (agent metadata/config directories, `node_modules/`, build output, etc.)

### 5. Verify

Check `git status` in the main repo. Changes should appear as unstaged modifications, new files, and deletions — ready for the user to review in VS Code Source Control.

### 6. Inform the user

Tell the user what was applied and that changes are ready for review. Remind them to stage and commit when satisfied.
