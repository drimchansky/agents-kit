# Boundary Scope

How a code-domain health boundary's scope is computed and recorded (`./verification.md` § *Two verification tiers*). Read it at a boundary only.

## Per check class

- **Lint, formatting included**: the closure, since type-aware and `import/*` rules read other files. No linter computes a closure, so run the whole tree with `--cache` and record the scope as whole tree (`./verification.md` § *What a boundary records*). Key the cache on content (`eslint --cache --cache-strategy content`); the default `metadata` strategy can read a same-size, same-mtime edit as a hit.
- **Typecheck**: `tsc` is whole-program and already the closure.
- **Tests and build**: the closure through the project's graph-aware selection, fed the delta as a path list: `nx affected --files=<paths>`, `vitest related <paths>`, `jest --findRelatedTests <paths>`. Revision-taking forms (`nx affected --base=<ref>`, `turbo --filter=...[<ref>]`, `vitest --changed <ref>`) need a commit marking the reference, which a mid-run boundary's does not. `turbo --filter` takes no changed-file list. Its `...` prefix selects dependents. Map the delta's paths to owning package directories and include their dependents, or take the whole tree.

Any check class the project gives no such runner takes the whole tree.

## Never disable the runner's cache

A runner's cache hit is a result: the check ran on these exact bytes, replayed against a hash of the task's declared inputs. It satisfies a boundary the way a fresh run does, unlike evidence reuse, which skips a check and needs durable evidence naming the exact work product (`../workflow/execution-loop.md` § *Health boundaries*).

`--skip-nx-cache`, `turbo --force`, `eslint --no-cache` and their equivalents never appear on a boundary command. Disable a cache only to diagnose one suspected stale; that run is a diagnosis, records no scope or result, and is never a later boundary's reference. A confirmed stale cache is a bug in the task's declared inputs; fix the inputs.

## Reference and delta

Take a reference only when a narrowing class is exposed. Where discovery finds no linter, no formatter, and no graph-aware test or build runner, skip the manifest and record `reference skipped: no narrowing class exposed`.

Two later-run boundaries take the whole surface because their reference carries no in-session green result: the `in-review → done` finalization (`../workflow/implement-task-edges.md` § *Reaching done from in-review*) and the pre-advance boundary of `../workflow/reconciliation.md`.

Otherwise, immediately after each green boundary, write a manifest on the tree that was green; it is the next boundary's reference:

```
node <kit-root>/scripts/worktree-merge.ts baseline <tree> --out <scratch>/health/<n>.json --prune <output-dir>...
```

`<kit-root>` per `../workflow/task-store.md` § *Resolving `<kit-root>`*. The delta is that script's `check <tree> --baseline <manifest> --surface .`: the path column of its change lines, the `delta N · escapes N` trailer dropped.

**The prune set** is the project's build, coverage, and cache output (`dist/`, `coverage/`, `.nx/`, `.turbo/`, `.eslintcache`, `playwright-report/`, `test-results/`) restricted to paths the project neither tracks nor git-ignores; on a Git checkout the walk already drops ignored untracked paths on both sides, so the set is usually empty. Name what remains, and every output directory on a tree outside a checkout, or it reads as a delta at every later boundary. Never prune a tracked output directory: that drops a real change before § *Widening* can see it (`../scripts/worktree-merge.md` owns both guards).

**With no kit root there is no in-session reference.** Run the whole relevant surface and record `reference skipped: no kit root`. `git diff` and `git status --porcelain` are no substitute: both measure against `HEAD`, not the tree the last boundary was green on, so both under-select.

The manifest lives in session scratch; nothing persists it across runs.

## Widening

A delta touching any of these widens every check to the whole tree:

- **A lockfile, dependency manifest, or tool config.** A runner's own config (`moduleNameMapper`, `testPathIgnorePatterns`) decides what is a graph node and what counts as a test.
- **A codegen input.**
- **Any file on an edge no static import graph can contain**: a path reached by configuration (a build-tool target, a runner option, a `setupFilesAfterEnv` entry, a `__mocks__` file mapped by `moduleNameMapper`), an on-disk fixture, or a module reached only by a runtime-constructed dynamic `import()`.
- **Any cross-package change where the runner is configured per package.** A per-package `jest.config.js` crawls only its own root, so a cross-package dependency selects no tests from any cwd: exit 0, empty output.
- **Source whose consumers execute a built artifact of it.** Widens and needs a rebuild; a gitignored `dist/` can be months stale.

## Infra-bound commands

A command whose precondition is external infrastructure (a database, running services, network) is recognized by documented precondition first (a README, a compose file, a project run skill) and by a precondition-level failure second, never by a bare run-time probe. It runs when the precondition can be met in-session; otherwise record `not run in-session: needs <X>; carried by CI required check <name>`, naming a carrier only when the project's CI config runs that command, `uncovered` otherwise. CI carries a check the session could not run, never one it could.

**A boundary whose only shortfall is infra-bound commands recorded not-run is green**, and eligible as the next boundary's reference. A test-level failure of that command under a met precondition is still red.

## Run independent recipe commands concurrently

The recipe's commands do not consume one another's results, so launch them together: one invocation of a runner that takes several targets (`nx run-many -t lint typecheck test`), and the rest as parallel tool calls or background processes collected before judging (`../workflow/delegated-waiting.md` § *How to wait*).

**Chaining recipe commands with `;` or `&&` inside one shell call is not launching them together.** `&&` short-circuits, hiding every later command's evidence; `;` exits with the last command's status, so a mid-chain failure reads green. Serialize only where one command consumes another's output (`&&` is then right, since a command must not run on a failed producer), or where commands contend on the same outputs or caches or the project's runner documents an order (give the later command its own call).

The boundary passes only when every command it launched has completed and passed (an infra-bound command recorded not-run is not among them); a failure is judged after all have finished, and Stop-the-Line applies unchanged.
