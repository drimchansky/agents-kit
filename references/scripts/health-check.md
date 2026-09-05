# `scripts/health-check.ts`

Walks task roots and reports lifecycle health findings for the `maintain` skill.

```
node scripts/health-check.ts [--stale-days N] [--result-max-kb N] [--task-max-kb N] [--record-max-kb N] <root> [<root>...]
node scripts/health-check.ts --installs <kit-root> <home> [<home>...]
```

**Emitted `check` values.** The task walk reports `stale`, `done-unarchived`, `started-in-backlog`,
`unknown-status`, `legacy-result-status`, `dead-anchor`, `goal-id`, `no-current-state`,
`oversized-result`, `oversized-task`, `oversized-record`, and `duplicate-slug`; `--installs` walks no
tasks and reports `install-drift` instead.

**Archived and backlogged folders.** Archived folders are counted in `scanned` and exempt from every
check but `duplicate-slug`, which sees them because a bare slug falls back into `Archive/`
(`../workflow/task-layout.md` § *Discovery rules for skills*), so an archived slug stays
citable and must stay unique. Backlogged folders are exempt from `stale` alone — parked work is
deliberately dormant (`../workflow/task-backlog.md`) — and stay in every other check,
`duplicate-slug` included, since the same slug fallback reaches `Backlog/` and a parked task's docs
are future work a later reconcile repairs rather than the frozen history an archived folder holds.

Two checks read the location itself: `done-unarchived` names the backlog for a terminal task, which
belongs in `Archive/`, and `started-in-backlog` fires for a plan past `to-do`, which no longer meets
the backlog's unstarted entry gate, and for a plan with no parseable status, which cannot be judged
against it — the stale exemption would otherwise leave that shape silent. A plan-less folder fires it
too once a `result.md` exists at all, since a result file exists only once execution starts.

A folder's age is the newest mtime among its `.md` files, and an unreadable one contributes nothing to
that maximum. Dropping it can only ever lower the observed newest mtime, so an unreadable file makes a
folder look older and more likely `stale` — never fresher, and never silently exempt. A fresh clone or
a bulk touch resets every age, so report ages beside that caveat rather than reading a young mtime as
recent work.

`duplicate-slug` is the one check that spans roots: a slug must be unique across every root walked
and within each one, since the walk is recursive. It emits one finding per colliding folder, each
keeping its own `root`, so every finding still carries the single root its consumer attributes it by,
and names its peers by absolute directory rather than by the root-basename-prefixed display path.

**Where the lifecycle is read.** `plan.md` is the sole lifecycle-status home
(`../workflow/task-lifecycle.md` § *`result.md` — no status field*), so every status this walk
reads is the plan's and `unknown-status` judges the plan alone; a `result.md` still carrying a
`**Status:**` header is the legacy shape that section tolerates, reported once as
`legacy-result-status` and never validated against a vocabulary that no longer governs the file.
Where a folder holds no plan at all the result stands in through its content rather than a status of
its own: the file existing means execution started, and its closing `**Completed:**` line is the only
finished-ness left to read — which is why that line requires the colon and the date rather than the
word alone, since a prose header like `**Completed steps:** 3 of 7` reading as `done` would file
unfinished work under a status nothing else can contradict.

**Contract.** stdout is exactly one JSON object,
`{"findings":[…],"scanned":N,"unreadable":N,"unreadablePaths":[…]}`. Task findings are
`{check,path,detail,root}`, with `root` the resolved absolute task root; `--installs` findings are
`{check,path,detail}`. `scanned` counts the task folders walked — or, under `--installs`, the
marker-owned items compared — and `unreadablePaths` names everything this run could not open, by
absolute path, so a coverage gap is attributable to its root the way a finding is and two roots
sharing a basename stay distinct; findings alone are never read as coverage (`scanned` is a floor
while `unreadablePaths` is non-empty). Warnings go to stderr and the exit status is always 0, so a
partly unreadable store still parses.

**Walk rules.** `node_modules` is pruned at every depth because the walk would never finish
otherwise; a helper directory needs no entry there, since a folder holding no role file is already
rejected, and a name-based prune costs a real task its scan silently. `.agents` is the one dotted
name entered — the canonical root `<project>/.agents/tasks` sits inside it, so pruning it would cost
a root registered as a project directory every task it holds. Every directory is listed exactly once
and its entries handed down, so an unreadable directory reports one coverage gap rather than two.
Neither container clears the other's flag, so a `Backlog/` under an `Archive/` stays archived: the
archived exemptions are the wider set.

**What a scan reads.** Fenced content is skipped in every task file, a status header is read from the
header block above the file's first `##`-or-deeper heading alone, and a step link that resolves to a
tombstone bullet under a `## Compacted` stub (`../workflow/reconciliation-compaction.md`) counts as
resolved rather than dead.

**The size trigger has one measure.** `oversized-result` calls `scripts/task-state.ts`'s exported
`resultSize`, the same function that script's `--compaction-plan` mode reads for `due`, so a result
cannot be over the trigger in this walk and under it in the compaction plan those findings send a
caller to.

**The two budget measures have no second reader.** `oversized-task` sums the on-disk byte length of
every `.md` file directly in the folder except `ticket.md` and its legacy `*.ticket.md` form — the
same stat pass the age check already makes, so no file is read twice — and `oversized-record`
measures each `## Step` or `## Full Run` section of `result.md`, heading line through the line
before the next `##` heading, fenced content included because it is section content. Both fire
strictly over their budget, both default to `scripts/lifecycle-constants.ts` and take a flag, and
both are exempt under `Archive/`.

**`--installs` mode** compares what `setup.ts` deployed against the kit. Only a marked item is
kit-managed and comparable; a marker that cannot be read is not the user's, so it is recorded as a
coverage gap and compared anyway. OS-generated files (`.DS_Store`, `.localized`, `Thumbs.db`) are
matched by name rather than by a dotfile rule, because a skill may legitimately ship a dotfile (a
template's `.gitignore`) and it stays comparable. A marked entry under the staging prefix is an
interrupted install rather than a payload. Two symlinks are compared by their targets, since
`setup.ts` copies skills link-preserving and references link-materializing; one side being a link and
the other not is drift rather than a copy-mode difference.
