# `scripts/commit-scan.ts`

Reports task commits since the watermark (`../workflow/reconciliation-commits.md`). Runs only read-only Git commands; watermark edits remain with reconciliation.

```
node scripts/commit-scan.ts <task-dir>
```

**Contract.** stdout is exactly one JSON object: `{taskDir,repo,pathsInRepo,watermark,branch,ref,refFallback,state,commits,total,steps}`.

`repo` is the Git root containing the task folder, or null. Resolution uses the folder, never the process directory; no override flag exists. For an external task store, report the scan unscanned and name the repository resolved by `../workflow/reconciliation-commits.md` § *The scan*.

`pathsInRepo` is true when at least one plan-named path exists on disk under `repo`. Containment alone does not qualify.

`watermark` is the lowercased SHA from `SHA <sha> (recorded YYYY-MM-DD)`; `branch` comes from `` branch `<branch>` ``. Both are nullable. Read them within the first `**Pointers:**` line in `## Current state`. Without that block, use the file's first Pointers line. Entry shapes: `../workflow/task-delivery.md` § *Branch and worktree creation*.

`ref` names the enumerated ref. Use the recorded branch when it resolves; otherwise use HEAD. An absent branch entry uses HEAD without a fallback reason. A recorded branch that no longer resolves or an entry marked `(removed …)` uses HEAD with `refFallback` explaining why (`../workflow/task-delivery-edges.md` § *Removal*).

`state` is:

- **`ok`**: `commits` holds `{sha,date,subject,paths}`, newest first, capped at 20; `total` gives the full count.
- **`no-watermark`**: no recorded floor exists; do not guess a range.
- **`orphaned`**: the watermark is absent from the repository or fails `git merge-base --is-ancestor <sha> <ref>`.
- **`no-checkout`**: no ref was resolved or scanned. A null `repo` means no containing checkout; otherwise `pathsInRepo` is false. Never render either as an empty successful range or seed that repository's HEAD.

`steps` follows plan order: `{number,checked,paths,pathExists,classification,commits}`. `paths` unions each step's Touches and What paths; missing Touches excludes no step. Inline-code spans qualify when they contain `/`, end with `/`, or have a file extension.

Step `commits` lists every nominating SHA from the full enumeration, including commits beyond the displayed cap. Name matching requires equality or a descendant at a `/` boundary. `pathExists` separately tests existence under `repo`.

`classification` is `candidate` for a touched pending step with an existing named path, `info` for a touched checked step, otherwise null. A pending step with no existing paths retains nominating commits but has null classification. Candidates require caller verification before writes; vanished work is the caller's unbacked-step repair.

**Exit status.** 0 for every reported state. 2 for bad usage, unreadable input, no recognized task role files, unavailable Git, or Git failure other than no checkout. Role recognition comes from `scripts/lifecycle-constants.ts`. No exit 1.
