# `scripts/task-move.ts`

Move one recognized task into its location-relative Archive or Backlog container (`../workflow/task-archiving.md`, `../workflow/task-backlog.md`). Archive requires a terminal plan. The **unstarted entry gate** for Backlog admits a planless folder only without result.md, or a plan at to-do. Refuse executing/blocked/in-review as live work, done/skipped with an archive pointer, and unknown status as unplaceable. Values come from `scripts/lifecycle-constants.ts`, the sanctioned copy of `../workflow/task-lifecycle.md` § *Status values*.

```
node scripts/task-move.ts <slug-or-path> --to archive|backlog
```

**Contract.** Success prints `moved <src> -> <dest>` to stdout, both paths absolute, and exits 0. Refusal prints one reason to stderr and exits 1 with no disk changes. Exit 2 means bad usage, no/ambiguous slug match, incomplete store lookup, or unexpected failure, with one stderr line.

Warnings also go to stderr without changing the outcome: malformed registry ignored wholesale, non-array taskRoots ignored, pathless entries ignored, and absent/non-directory registered roots skipped. An absent registry is normal.

If a failed move created its container, remove it only with `rmdirSync`. Preserve pre-existing containers and any newly created container another writer populated.

**Already-archived is asked of the whole path up to the store.** Apply `../workflow/task-archiving.md` within the resolved bound. For a slug, use the innermost containing registered root or canonical `.agents/tasks`. For a path, use the innermost registered root, else its `.agents/tasks` store. Path-based bound lookup tolerates absent/unreadable/malformed registries silently, preserving the one-line refusal contract (`../workflow/task-relocation.md`). Without any containing store, inspect the whole path. Parked state depends only on the immediate parent (`../workflow/task-backlog.md`).

**Resolution.** An argument containing a path separator resolves verbatim relative to cwd. Otherwise search the bare slug in canonical `<cwd>/.agents/tasks` and configured taskRoots from `~/.config/agents-kit/config.json` (`../workflow/task-store.md`).

Read canonical roots one level deep, including their immediate Archive/Backlog containers. Search registered roots recursively through groups under `../workflow/task-store.md` § *The root registry*, as `../workflow/task-layout.md` § *Discovery rules for skills* specifies.

Match folder names exactly against directory listings, independent of filesystem case folding. Empty subjects, `.` and `..` match no slug and exit 2. Lifecycle containers are transparent at any depth, regardless of their contents. All matches count equally; active-first selection belongs to the calling skill.

Expand configured tildes and resolve physical root identities before searching. Search aliases once, but search nested registered roots independently even if an outer walk prunes or claims their ancestors. Deduplicate matches by physical path. Zero or multiple matches after deduplication exit 2 and request a path.

Absent or non-directory registered roots warn and skip. Any unreadable directory in a present search root, including the root itself or a canonical container, aborts every root's lookup with exit 2 before moving. A present unreadable registry likewise aborts slug lookup. Missing/non-directory canonical roots and absent registry contribute no search entries; continue with remaining roots. Incomplete lookup never establishes uniqueness.

Both forms require task contents recognized by `scripts/lifecycle-constants.ts`, as in the health walk. Position cannot qualify a folder. No recognized slug match exits 2; an unrecognized path exits 1.

Rename the whole folder once. Read its listing and plan status; test result.md existence only. Preserve contents and internal `./` links.
