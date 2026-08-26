# Boundary Scope

The satellite of `./verification.md` § *Two verification tiers*: how a code-domain health boundary's
scope is computed, and what it records. That section owns *that* a boundary narrows and the one
condition under which it may; this file owns the mechanics. **Read it at a boundary** — nothing
between boundaries needs it.

## Per check class

- **Lint, formatting included** — the closure, not the delta: type-aware and `import/*` rules read
  other files. No linter computes a closure, so the closure is reached as a **whole-tree run made
  cheap by `--cache`**, and the boundary records that scope as whole tree (`./verification.md` § *What a
  boundary records*) rather than claiming a narrowing the runner never performed.
- **Typecheck** — unchanged, `tsc` being whole-program and therefore already the closure, with no
  affected mode to reach for.
- **Tests and build** — the closure through the project's own graph-aware selection. The delta below
  is a **path list**, and the runners split by what they are addressed with, so reach for a
  path-taking form:
    - **path-taking**, fed the delta directly — `nx affected --files=<paths>`,
      `vitest related <paths>`, `jest --findRelatedTests <paths>`;
    - **revision-taking**, which a path list cannot feed — `nx affected --base=<ref>`,
      `turbo --filter=...[<ref>]`, `vitest --changed <ref>`. Reach for one only where a commit
      genuinely marks the reference, which a mid-run boundary's does not.

  `turbo` sits between the two: its `--filter` takes package names, directories (`--filter=./apps/*`),
  and git ranges, but no list of changed files, and its `...` prefix selects dependents. Narrowing it
  therefore means mapping the delta's paths to owning package directories first — the project's own
  call, since its docs demonstrate no directory-plus-dependents form. Absent that mapping, whole tree.

Graph-aware selection is not a changed-files shortcut: it *computes* consumers rather than guessing
them, which is what makes this scope safe. Any check class the project gives no such runner takes the
whole tree.

## Reference and delta

The reference exists to serve the classes that can narrow, so it is taken when and only when one is
exposed: where discovery finds no linter, no formatter, and no graph-aware test or build runner,
every class already falls to the whole tree above, the delta cannot change what runs, and the
boundary skips the manifest and records `reference skipped: no narrowing class exposed`.

Two later-run boundaries take the whole surface for the other reason — their reference carries no
in-session green result: the `in-review → done` finalization of
`../workflow/implement-task-edges.md` § *Reaching done from in-review*, and the pre-advance boundary
of `../workflow/reconciliation.md`. Both exist precisely because unchanged state cannot be assumed
healthy across runs, and a delta against their own pre-run tree would reduce each to selecting
nothing.

Otherwise the coordinator writes a manifest **immediately after each green boundary, on the tree that
was green** — that boundary being the next one's reference:

```
node <kit-root>/scripts/worktree-merge.ts baseline <tree> --out <scratch>/health/<n>.json --prune <output-dir>...
```

`<kit-root>` per `../workflow/task-store.md` § *Resolving `<kit-root>`*. A boundary's delta is that
script's `check <tree> --baseline <manifest> --surface .`; `--surface .` is the root, so no path is
ever an escape and the delta is the **path column of its change lines**, the `delta N · escapes N`
trailer dropped. That path list is the argument the path-taking runners above take.

**The prune set** is the project's build, coverage, and cache output directories, **restricted to
paths the project does not track**. `dist/`, `coverage/`, `.nx/`, `.turbo/`, `.eslintcache`,
`playwright-report/`, and `test-results/` change on every boundary run, so a reference taken without
pruning them reads as a delta at every later boundary, silently restoring the cost this scoping
removes. But a prune filters the baseline as well as the current walk, so pruning a *tracked* output
directory — a committed bundle, a checked-in generated client — drops a real change out of the delta
before § *Widening* can ever see it. Tracked output is measured, not pruned, whatever churn it costs;
`scripts/worktree-merge.ts` § *Prunes and tracked content* owns that guard for all three of the
manifest's roles.

**With no kit root there is no in-session reference.** The boundary takes none and runs the whole
relevant surface, recording `reference skipped: no kit root`. A git-shaped hand equivalent is
deliberately not offered, and this is what it would give up: `git status --porcelain` omits ignored
paths the manifest walk covers, `git diff` covers tracked files only, and neither sees a file that was
dirty at the green boundary and has since been restored to `HEAD` content — so both under-select, the
one direction in which a narrowed boundary becomes unsound rather than merely wasteful.

The manifest lives in session scratch; nothing persists it across runs, which keeps
`../workflow/execution-loop.md` § *Health boundaries* true as written.

## Widening

A delta touching any of these widens every check to the whole tree, so scope needs no judgment:

- **A lockfile, dependency manifest, or tool config** — widened by this rule rather than left to the
  runner, whose selection over them is not provably whole. A runner's own config is doubly so: its
  `moduleNameMapper` and `testPathIgnorePatterns` decide what is a graph node and what counts as a
  test at all.
- **A codegen input.**
- **Any file on an edge no static import graph can contain.** That is the property that matters, and
  it covers three shapes which look unrelated: a path reached by configuration rather than by import
  (a string in a build-tool target or runner option, a `setupFilesAfterEnv` entry, a `__mocks__` file
  mapped by `moduleNameMapper`); an on-disk fixture; and a module reached only by a
  runtime-constructed dynamic `import()`. Whether such an edge crosses a project root is beside the
  point — a computed specifier is unresolvable inside one package as readily as across two, and the
  file-granular runners select per file rather than per project.
- **Any cross-package change where the runner is configured per package** — a per-package
  `jest.config.js` crawling only its own root, so a declared and exercised cross-package dependency
  selects no tests from any cwd, silently: exit 0, empty output, and the silence is the danger.
- **Source whose consumers execute a built artifact of it** — widens and needs a rebuild besides: a
  gitignored `dist/` can be months stale, making the delta surface and the executed surface different
  sets.

## Infra-bound commands

A command whose precondition is external infrastructure — a database, running services, network — is
recognized by documented precondition first (named in a README, a compose file, or a project run
skill) and by a precondition-level failure second, never by a bare run-time probe. It runs when its
precondition can be met in-session; otherwise the boundary records `not run in-session: needs <X>;
carried by CI required check <name>`, naming a carrier only when the project's CI config runs that
command, `uncovered` otherwise. This is the one place CI enters the recipe — the named carrier of a
check the session could not run, never a substitute for one it could.

**A boundary whose only shortfall is infra-bound commands recorded not-run is green.** It passes, it
records them, and it is eligible as the next boundary's reference: an unmet precondition is a fact
about the session's environment, not evidence about the work product, and treating it as a third
undefined state would leave every consumer's green predicate unanswerable. A precondition failure is
therefore never a red boundary; a test-level failure of that command under a *met* precondition still
is.

## Run independent recipe commands concurrently

The recipe's commands don't consume one another's results, so their default relationship is
independence: launch them together — parallel tool calls, or background processes collected before
judging — and let the boundary's wall-clock be the slowest command, not the sum. Serialize only where
one command consumes another's output (a build artifact a test suite loads, a codegen step a
typecheck reads), where commands contend on the same outputs or caches — build artifacts, coverage
output, snapshot or incremental state; a command's verdict being read-only does not make its
execution so — or where the project's own runner documents a required order; a runner that
coordinates its own concurrency (one `nx run-many` across several targets) is the simplest safe form.

Concurrency changes evaluation not at all: the boundary passes only when **every command it launched**
has completed and passed — an infra-bound command recorded not-run is not among them, per the section
above — a failure is judged after all have finished (their outputs are independent evidence, and a
second failure surfaced now is one less rerun later), and Stop-the-Line applies unchanged.

