# Boundary Scope

How a code-domain health boundary's scope is computed and recorded (`./verification.md` § *Two verification tiers*). Read it whole at a boundary; other sites read only the sections they cite.

## Per check class

- **Lint**: the closure, since type-aware and `import/*` rules read other files. No linter computes a closure, so run the whole tree with `--cache` and record the scope as whole tree (`./verification.md` § *What a boundary records*). Key the cache on content (`eslint --cache --cache-strategy content`); the default `metadata` strategy can read a same-size, same-mtime edit as a hit.
- **Formatting**: the project's formatting command in check mode, narrowed to the delta's surviving paths inside that command's own targets (`prettier --check --ignore-unknown <paths>`, `nx format:check --files=<paths>`), because a file's formatting depends on nothing but itself and the config resolved for it. Surviving paths are the delta's `added` and `modified` lines; a `deleted` path fails the formatter as an unmatched pattern. Surviving paths exclude symlinks (check with `test -L <path>`), since Prettier refuses an explicitly passed symlink with exit 2. With no surviving path inside the targets, run no formatting command and record the scope as `delta: no surviving paths`, since Prettier given no paths reads stdin. Deleted paths still count toward § *Widening*. The whole-tree form is the project's formatting command at its own targets, such as `nx format:check --all` or `prettier --check .`, taken on the formatter-input trigger in § *Widening* or wherever the boundary runs the whole surface. The bare `nx format:check` checks branch-changed plus dirty files, neither delta nor tree, and is never a boundary scope.
- **Typecheck**: `tsc` is whole-program and already the closure.
- **Tests and build**: the closure through the project's graph-aware selection, fed the delta as a path list: `nx affected --files=<paths>`, `vitest related <paths>`, `jest --findRelatedTests <paths>`. Revision-taking forms (`nx affected --base=<ref>`, `turbo --filter=...[<ref>]`, `vitest --changed <ref>`) need a commit marking the reference, which a mid-run boundary's does not. `turbo --filter` takes no changed-file list. Its `...` prefix selects dependents. Map the delta's paths to owning package directories and include their dependents, or take the whole tree.

Any check class the project gives no such runner takes the whole tree.

## Never disable the runner's cache

A runner's cache hit is a result: the check ran on these exact bytes, replayed against a hash of the task's declared inputs. It satisfies a boundary the way a fresh run does, unlike evidence reuse, which skips a check (`../workflow/execution-loop.md` § *Health boundaries*).

`--skip-nx-cache`, `turbo --force`, `eslint --no-cache` and their equivalents never appear on a project verification command a kit skill launches, at a boundary or anywhere else, except the diagnosis run below. Disable a cache only to diagnose one suspected stale; that run is a diagnosis, records no scope or result, and is never a later boundary's reference. A confirmed stale cache is a bug in the task's declared inputs; fix the inputs.

## Reference and delta

Immediately before launching a boundary's commands, write a manifest of the tree they will check, wherever a kit root resolves. A green boundary's manifest is the next boundary's reference. After a green result, run `check <tree> --baseline <this manifest> --surface .`. On `delta 0` it is also the only in-session artifact a later `commit` gate can read to reuse the boundary (`skills/commit/SKILL.md`, verification gate). Record its path and its `git -C <tree> hash-object <manifest>` id on the boundary (`./verification.md` § *What a boundary records*). The gate trusts only a manifest still hashing to that id, since a later boundary may overwrite the path. A non-zero delta means a check rewrote the tree, so record `none: checks changed the tree` instead. A red boundary's manifest is discarded.

```
node <kit-root>/scripts/worktree-merge.ts check <tree> --baseline <reference> --surface . --out <scratch>/health/<n>.json --prune <output-dir>...
node <kit-root>/scripts/worktree-merge.ts baseline <tree> --out <scratch>/health/<n>.json --prune <output-dir>...
```

`<kit-root>` per `../workflow/task-store.md` § *Resolving `<kit-root>`*. `<reference>` is the previous green boundary's manifest. With one, the first form takes the delta and writes this boundary's manifest in one walk. The delta is the path column of its change lines; drop the `delta N · escapes N` trailer and the closing `baseline` and `paths` lines. A boundary without a reference writes its manifest with the second form. Either runs before this boundary's commands launch. `<tree>` is the checkout's top level (`git rev-parse --show-toplevel`), or the shared tree itself outside a checkout.

The narrowing-class test decides only what the delta narrows, never whether the manifest is written. Where discovery finds no linter, no formatter, and no graph-aware test or build runner, every class takes the whole tree (§ *Per check class*) and the delta narrows nothing.

Two later-run boundaries take the whole surface because their reference carries no in-session green result: the `in-review → done` finalization (`../workflow/implement-task-edges.md` § *Reaching done from in-review*) and the pre-advance boundary of `../workflow/reconciliation.md`.

**The prune set** is the project's build, coverage, and cache output (`dist/`, `coverage/`, `.nx/`, `.turbo/`, `.eslintcache`, `playwright-report/`, `test-results/`) restricted to paths the project neither tracks nor git-ignores; on a Git checkout the walk already drops ignored untracked paths on both sides, so the set is usually empty. Name what remains, and every output directory on a tree outside a checkout, or it reads as a delta at every later boundary. Never prune a tracked output directory: that drops a real change before § *Widening* can see it (`../scripts/worktree-merge.md` owns both guards).

**With no kit root there is no in-session reference and no manifest.** Run the whole relevant surface and record `reference skipped: no kit root`. `git diff` and `git status --porcelain` are no substitute: both measure against `HEAD`, not the tree the last boundary was green on, so both under-select.

**A helper exit 2 does not stop the boundary.** `<reason>` is the helper's first stderr line. A delta `check` exiting 2 yields no delta and no manifest: write the manifest with `baseline`, run the whole relevant surface, and record `reference skipped: helper failed: <reason>`. If `baseline` or the post-run `check` exits 2, record `none: helper failed: <reason>` as the manifest written on green. The next boundary then has no reference, runs the whole relevant surface, and records `whole surface: previous boundary wrote no manifest`.

The manifest lives in session scratch. Only a later `commit` gate in the same session reads it across runs; nothing persists it across sessions. Presentation's scratch cleanup keeps the last green boundary's manifest and removes earlier ones.

## Widening

The **formatter input** trigger widens formatting to the whole tree; every other trigger widens every other check:

- **A lockfile, dependency manifest, or tool config.** A runner's own config (`moduleNameMapper`, `testPathIgnorePatterns`) decides what is a graph node and what counts as a test.
- **A codegen input.**
- **Any file on an edge no static import graph can contain**: a path reached by configuration (a build-tool target, a runner option, a `setupFilesAfterEnv` entry, a `__mocks__` file mapped by `moduleNameMapper`), an on-disk fixture, or a module reached only by a runtime-constructed dynamic `import()`.
- **Any cross-package change where the runner is configured per package.** A per-package `jest.config.js` crawls only its own root, so a cross-package dependency selects no tests from any cwd: exit 0, empty output.
- **Source whose consumers execute a built artifact of it.** Widens and needs a rebuild; a gitignored `dist/` can be months stale.
- **A formatter input, for the formatting class.** A formatter config (`.prettierrc*`, `prettier.config.*`, the `prettier` key in `package.json`), `.prettierignore`, `.editorconfig`, or a file a formatter plugin names as its input (`tailwindStylesheet`, `tailwindConfig`). A lockfile or dependency manifest counts too, since it can move the formatter's or a plugin's version. An ignore file the formatting command reads counts too, since un-ignoring a tracked file exposes it to whole-tree checks without entering the delta. Prettier 3 reads `.gitignore` and `.prettierignore` in its working directory by default; an explicit `--ignore-path` replaces both with every file it names. Formatting then takes the whole tree. Configs, lockfiles, and manifests also widen the other checks under the first bullet.

## Infra-bound commands

A command whose precondition is external infrastructure (a database, running services, network) is recognized by documented precondition first (a README, a compose file, a project run skill) and by a precondition-level failure second, never by a bare run-time probe. It runs when the precondition can be met in-session; otherwise record `not run in-session: needs <X>; carried by CI required check <name>`, naming a carrier only when the project's CI config runs that command, `uncovered` otherwise. CI carries a check the session could not run, never one it could.

**A boundary whose only shortfall is infra-bound commands recorded not-run is green**, and eligible as the next boundary's reference. A test-level failure of that command under a met precondition is still red.

## Run independent recipe commands concurrently

The recipe's commands do not consume one another's results, so launch them together: one invocation of a runner that takes several targets (`nx run-many -t lint typecheck test`), and the rest as parallel tool calls or background processes collected before judging (`../workflow/delegated-waiting.md` § *How to wait*).

A memory- or CPU-constrained run throttles the runner first: cap its workers (`--parallel=N`, `VITEST_MAX_WORKERS`, the runner's own limits) while the check classes still launch together. When a capped run still fails on a demonstrated resource limit, such as an out-of-memory kill, run the classes one after another: each in its own call, or at `--parallel=1` in one runner invocation. Collect every result before judging.

**Chaining recipe commands with `;` or `&&` inside one shell call is not launching them together.** `&&` short-circuits, hiding every later command's evidence; `;` exits with the last command's status, so a mid-chain failure reads green. Serialize only where one command consumes another's output (`&&` is then right, since a command must not run on a failed producer), where commands contend on the same outputs or caches or the project's runner documents an order (give the later command its own call), or where a capped run fails on a demonstrated resource limit (sequence the classes as the paragraph above describes).

The boundary passes only when every command it launched has completed and passed (an infra-bound command recorded not-run is not among them); a failure is judged after all have finished, and Stop-the-Line applies unchanged.
