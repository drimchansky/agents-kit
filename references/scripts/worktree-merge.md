# `scripts/worktree-merge.ts`

Merge gates: `../workflow/parallel-batch.md` § *Coordinator-side parallel batch*. Serial baseline/check: `../workflow/executor-contract.md` § *Write-mode routing*.

```
node scripts/worktree-merge.ts baseline <tree> --out <manifest> [--prune <path>]...
node scripts/worktree-merge.ts check <worktree> --baseline <manifest> --surface <path>...
                               [--prune <path>]... [--out <manifest>]
node scripts/worktree-merge.ts apply <worktree> --baseline <manifest> --into <tree>
                               --surface <path>... --receipt <file> [--prune <path>]...
node scripts/worktree-merge.ts remove <worktree> --receipt <file>
node scripts/worktree-merge.ts discard <worktree>
node scripts/worktree-merge.ts index <tree> --baseline <manifest> [--base <rev>]...
```

**Contract.** stdout gives delta/outcome, one path per line. Exit 0 succeeds. Exit 1 reports refusal on stderr and stops: surface escape, conflict, unverified incorporation, missing verified receipt, attempted repository-content removal, or an index that does not hold the manifest's bytes. Exit 2 refuses before writes: bad usage, unreadable tree, invalid manifest, or incompatible measurement, such as a manifest of another root.

After apply copies, a failed measurement instead exits 1 and reports the landed/did-not-land split as uncomputable. An unreadable root fails; unreadable subdirectories are deferred until check-ignore determines whether they are ignored. Unignored unreadability refuses the run.

`apply` writes a receipt only after rereading every copied path and verifying it against the worktree. Failed incorporation earns no receipt; `remove` requires a verified one. Use `discard` for failed, hung, or escaping worktrees that earned none.

**Manifests contain hashes only.** The coordinator supplies exact restoration bytes. Reports name applied paths and, after verification failure, the landed/did-not-land split or its unavailability.

**Baseline roles:** batch baseline, ordered pre-unit capture, serial pre-launch surface reference, health reference (`../engineering/boundary-scope.md` § *Reference and delta*), and the commit gate's reuse proof.

**`check --out` writes the tree it measured as a manifest**, only when the check exits 0. The manifest is the one `baseline` would write for that tree with the check's combined prunes. It drops a path the check measured only because its baseline did, now git-ignored and untracked. Two closing lines follow the trailer, as `baseline` prints them.

**`index` proves the index holds a manifest's measured bytes** (`skills/commit/SKILL.md`, verification gate). `<tree>` must be a checkout's top level and the manifest's `root`, measured through its git-ignore filter. Each stage-0 index path must be a manifest entry whose live bytes match both the entry and the index blob. Its index mode must match the entry's type and the owner's execute bit, the only bit Git stages. No index path may be an intent-to-add entry, which `git commit` omits. Every manifest entry must be in the index. No index path, and no path a `--base` tree tracks, may be pruned. A path a `--base` tree tracks but the index lacks must hold no file or symlink in the tree under that exact name. A directory at that path, a symlink among its ancestors, or a name differing only in case counts as absent. Exit 0 when all hold; stdout names the tree and the path count. Otherwise exit 1 with one reason per stderr line; an unmerged index exits 1 too. Clean, smudge, and end-of-line filters make index blobs differ from tree bytes, so affected paths exit 1. Exit 2 for a tree that is not a checkout's top level, a manifest of another root or measured without the filter, or an unresolvable `--base`. `HEAD` is unresolvable before the first commit.

Some checkouts never pass `index`, so their commits run the full gate. A populated submodule makes the git-ignore filter exit 2, so no manifest is written. A tracked path under `node_modules` is pruned by name. An untracked nested repository's files are measured but never in the index.

**Git-ignored content.** Checkout walks drop ignored untracked paths and record `gitignore`. Refuse comparisons unable to reproduce a `gitignore: true` measure. Each tree uses its own index, but paths measured in the baseline remain measured on the other side. Thus a shared-tree staged force-add is not mistaken for a deletion in a worktree whose index is HEAD.

An ignored worktree path inside the surface differing from the shared tree is `ignored <path> NOT MEASURED`. Count it in `ignored-divergent`; apply refuses before writes. Check neither the reverse absence of shared ignored files nor paths outside the surface. Same-tree comparisons do not diverge.

**Prunes and tracked content.** Prunes filter both baseline and current walk. Name only untracked paths. Outside declared surfaces, ignored paths need no explicit prune; inside a surface, ignored generated/tool state needs one to avoid ignored-divergent refusal. Do not place unit output there: dropped paths are never incorporated. Name output neither tracked nor ignored, and applicable state in non-checkout trees (`../workflow/parallel-batch.md` § *Coordinator-side parallel batch*).

`.git` and `node_modules` are pruned by name at every depth, regardless of entry type. A `--prune` is root-relative and hides only that path: `cache` does not hide `src/cache`. Pruning the root or anything outside it is a usage error.

A manifest records its baseline's prunes in `prunes`: root-relative, `/`-separated, trailing slash stripped. Every later `check` against it applies them together with its own `--prune` paths.

**What an entry is.** Record symlink targets without following them. Directories are not entries; empty directories carry no delta. File-to-directory changes therefore delete the original file. Apply deletions before writes and clear a destination before copying its replacement. Refuse a destination with a symlink ancestor below the shared root unless the change set removes that ancestor. Repoint absolute links into the transient worktree to equivalent shared-tree paths.

After successful copying, remove emptied directories upward from deleted paths, deepest-first. Stop at a non-empty or non-plain directory, or outside the declared surface. Skip this pass after copy failure. Cleanup errors are tolerated; directory removals appear in neither delta nor receipt.

**Removal.** A linked worktree has a `.git` file and is removed through Git. Plain scratch without `.git` is removed directly. Refuse a checkout with a `.git` directory and any plain directory inside a checkout. A Git refusal never falls back to recursive deletion. `remove` rechecks presence, not hashes, because later ordered units may legitimately rewrite verified paths.
