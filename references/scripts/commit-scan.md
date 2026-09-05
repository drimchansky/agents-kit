# `scripts/commit-scan.ts`

Enumerates one task's commits since its watermark — the commits-since-watermark step
`../workflow/reconciliation-commits.md` owns, read by `resume-task`'s drift check and written
into a reconciliation entry by a reconcile phase. One enumeration serves both consumer modes, so
neither skill re-derives the range. **The script only reports.** It runs `git rev-parse`,
`git for-each-ref`, `git merge-base`, and `git log`, and writes nothing anywhere: every watermark seed,
re-seed, and advance stays a reconcile-phase edit under that direction's write surface.

```
node scripts/commit-scan.ts <task-dir>
```

**Contract.** stdout is exactly one JSON object,
`{taskDir,repo,pathsInRepo,watermark,branch,ref,refFallback,state,commits,total,steps}`.

`repo` is the git root holding `<task-dir>`, null when the folder sits inside no checkout. It is
resolved **from the folder**, never from the process directory, and there is no flag to override it:
scanning a root the shell happened to be in is the wrong-root failure the whole gate below exists to
prevent. A folder in a task store or a registered root elsewhere therefore reports no repository rather
than the session's — the script cannot scan a repository that does not hold the folder, so the
caller renders that section unscanned, naming the repository the resolution rule points at
(`reconciliation-commits.md` § *The scan*), rather than omitting it.

`pathsInRepo` is the existence gate: true when at least one path some plan step names **exists on disk**
under `repo`. Existence, not containment — a repo-relative path lies inside any root, so a containment
test would never discriminate a wrong one.

`watermark` is the `SHA <sha> (recorded YYYY-MM-DD)` entry read off the result's `## Current state`
`**Pointers:**` line, lowercased, null when none is recorded; `branch` is the `` branch `<branch>` ``
entry on that same line — the shape `../workflow/task-delivery.md` § *Branch and worktree
creation* owns — null when none. That line is free prose, so both are found inside it rather
than parsed as the whole of it, and only the first `**Pointers:**` line of the `## Current state` block
is read — a result carrying no such block falls back to the first `**Pointers:**` line in the file, so
a legacy result still yields its floor. Mis-parsing either entry walks the wrong ref and
under-nominates, which is the failure that matters here; over-nominating costs nothing, since the
caller re-verifies every candidate before it writes.

`ref` is the ref that was enumerated and `refFallback` says why it is not the recorded branch. A
recorded branch is used as-is; a task's commits land there while the resolved root's `HEAD` stays on
the default branch, so enumerating `HEAD` would walk a ref the work is not on and return an empty range
for work that is committed. No branch recorded → `HEAD`. A recorded branch that no longer resolves, or
one the `**Pointers:**` entry marks `(removed …)` (`../workflow/task-delivery-edges.md`
§ *Removal*), falls back to `HEAD` — where a merged branch's work now sits — with `refFallback` naming
the fallback so a brief can print it.

`state` is one of:

- **`ok`** — a range was enumerated. `commits` holds `{sha,date,subject,paths}` per commit, newest
  first, capped at 20, with `total` carrying the full count so a cut is stated rather than silent.
- **`no-watermark`** — nothing reconstructs a range, and a guessed one is worse than none.
- **`orphaned`** — `git merge-base --is-ancestor <sha> <ref>` exited non-zero, so the recorded commit is
  no longer in the resolved ref's history (rebase, amend, force-push, history rewrite). A watermark
  naming an object the repository no longer holds lands here too, which is the same finding.
- **`no-checkout`** — there is no repository this task acts on, so nothing was scanned and no ref was
  resolved. `repo` and `pathsInRepo` name which of the two omission conditions produced it: a null
  `repo` is a folder outside any checkout, and a non-null `repo` with `pathsInRepo` false is a
  checkout holding none of the plan's paths. Both are emitted as fields and as a state that stops the
  caller, **never as a silently empty `ok` range**: an empty range reads as "no commits since the
  watermark" and would seed a foreign `HEAD` onto `**Pointers:**`, leaving every later scan in the
  right repository orphaned against it.

`steps` follows plan order: `{number,checked,paths,pathExists,classification,commits}`. `paths` is the
union of the step's `**Touches:**` paths and the paths its `**What:**` line names — `Touches:` is a
parallelism declaration, so its absence never disqualifies a step. `commits` lists the shas of every
commit in the **full** enumeration touching that step, so a step over the 20-commit cap still names its
nominators; `classification` is `candidate` for a pending step a commit touched, `info` for a checked
one, and null for a step no commit touched. The scan nominates; it never weakens — a step whose work
vanished is the caller's unbacked-step repair, not this report's.

**The two path tests are distinct.** *Name-match* decides which commits touch a step: a commit path
equal to a named path, or under it at a `/` boundary, so a step naming a directory catches the files
below it and a sibling with a longer name does not. *Existence under `repo`* is `pathExists`, and a
pending step none of whose named paths exists on disk never becomes a candidate, whatever moved in the
repo — such a step reports `classification: null` with its nominating commits still listed. Paths are
read out of inline-code spans and kept when they look like a path (a `/`, a trailing `/`, or a file
extension), which deliberately over-collects: a bare filename a `**What:**` mentions in passing joins
the set, matches no commit path under the name-match rule above, and costs nothing.

**Exit status.** 0 in every state — each one is a report a caller acts on. 2 is the run that never got
that far: bad usage, an unreadable argument, a folder holding none of the role files
`scripts/lifecycle-constants.ts` recognizes, or a `git` that is absent or failed for a reason other
than the folder sitting outside a checkout. There is no 1 here, unlike the scripts beside it: an
omitted scan is a state with fields explaining it, not an outcome the exit code has to carry.
