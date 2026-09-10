# `scripts/health-check.ts`

Walks task roots and reports lifecycle health findings for the `maintain` skill.

```
node scripts/health-check.ts [--stale-days N] [--result-max-kb N] [--task-max-kb N] [--record-max-kb N] <root> [<root>...]
node scripts/health-check.ts --installs <kit-root> <home> [<home>...]
```

**Emitted `check` values.** The task walk reports `stale`, `done-unarchived`, `started-in-backlog`,
`unknown-status`, `legacy-result-status`, `dead-anchor`, `dead-citation`, `citation-form`, `goal-id`,
`no-current-state`, `oversized-result`, `oversized-task`, `oversized-record`, `duplicate-slug`, and
`nested-task`; `--installs` walks no tasks and reports `install-drift` instead.

**Archived and backlogged folders.** Archived folders are counted in `scanned` and exempt from every
check but four: `duplicate-slug`, which sees them because a bare slug falls back into `Archive/`
(`../workflow/task-layout.md` § *Discovery rules for skills*), so an archived slug stays
citable and must stay unique; `nested-task`, below; and the two citation checks, since an archived
folder's own citations are still followed — that same slug fallback is what keeps them resolvable —
and a folder the archiving relocated is where a broken one concentrates. Backlogged folders are
exempt from `stale` alone — parked work is deliberately dormant
(`../workflow/task-backlog.md`) — and stay in every other check,
`duplicate-slug` included, since the same slug fallback reaches `Backlog/` and a parked task's docs
are future work a later reconcile repairs rather than the frozen history an archived folder holds.

`nested-task` reads the claim itself. A folder the recognition set claims is never descended into, so a
role file one prefix away from `GROUP_CONTEXT.md` — a `CONTEXT.md` dropped into a group — turns the
group into a task and hides every folder beneath it from this walk, from slug resolution, and from
every listing derived from either (`../workflow/task-store.md` § *Shared group context*). This check
lists the task folders found beneath a claimed one, so the shape is named rather than silently
absorbed; it is the one check that looks inside a claimed folder, and it fires under `Archive/` too,
since the hidden folders are hidden wherever the claim sits. Its descent applies the same
classification as the store walk (`../workflow/task-store.md` § *The root registry*), so a lifecycle
container it meets on the way down is walked through rather than claimed: a role file misfiled into
an `Archive/` beneath the claim names the tasks under it instead of naming the container.

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

**The two citation checks read every `.md` file sitting directly in the task folder.**
`dead-citation` collects each markdown link target that carries no `<scheme>:` prefix at all — which
drops a `://` URL, a `mailto:`, and a `tel:` or `data:` target in one test — and is not a bare
`#fragment`, drops any fragment, percent-decodes what is left, and walks it segment by segment
against each directory's own listing rather than through a `stat`, so a citation differing from the
file on disk by case alone is dead here whatever the filesystem folds together. A target written
`<…>` runs to its closing bracket and may carry spaces, though the padding around it is trimmed
first by `angledTargetText` in `scripts/lifecycle-constants.ts` — the one helper `scripts/sweep-scope.ts`
reads its own angled targets through — since a padded target otherwise resolves as a `" ."` segment
and reports a live citation dead. One beginning `/` resolves from the walked
root rather than from the task folder. A reference-style definition (`[ref]: ./target.md`) carries no
`](` and is not read. Inline code spans are blanked before the line is scanned for links; an unclosed
backtick opens no span, and a real link beside one on the same line is still read. A blockquote is
skipped to its first blank line, its unprefixed lazy continuations included, or to the first line
that opens a block of its own — an ATX heading, a list item, or a thematic break, none of which
CommonMark reads as a lazy continuation. That line is read like any other rather than skipped with
the quote, so a quote that a heading or a list follows hides no citation under it. An HTML comment is
blanked before either arm reads the file — a quoted or
commented-out citation resolves against the folder that wrote it rather than the one quoting it —
and an unclosed `<!--` opens no span, as an unclosed backtick opens none. That blanking locates its
delimiters over the live lines alone rather than the raw file, and over a copy of them whose inline
code spans are blanked as well, so a `<!--` shown inside a fence or inside a code span cannot pair
with a real one below it: the first would blank the fence terminator between them, carrying the
fence to the end of the file, and the second would swallow every citation down to the next real
comment, each taking those citations out of both arms with no diagnostic. Only the spans found that
way are blanked, and they are blanked in the raw lines, leaving each line's own code-span blanking
to run over what the author wrote. The same check
reads a plain-text `DECISIONS.md`, `DOC_CONVENTIONS.md`, or `GROUP_CONTEXT.md` path outside any link
— over the same blanked line the link arm reads, so backticks mark an illustration to both arms
alike and a backticked path is a citation to neither. Only a link the link arm itself saw counts as
a link here, so a backticked link is none, and its target is blanked with the span around it rather
than falling through to the plain-text arm. A path the author did mean as a citation is written
unbackticked, which is the form the one-home rule asks for anyway. Either way the path resolves from
the walked root holding the citing task. That path is the run of path characters around the filename,
widened back across each preceding space while every candidate so far has failed to resolve and
stopping at the first that does, so a group name carrying any number of spaces is read whole rather
than truncated to its last word. The widening decides only whether the citation resolves, never what
is reported: where no candidate resolves the narrow run alone is the reported token, which is what
keeps a sentence carrying an unrelated slash from being reported as whatever the widening left. It is
read only when it carries a `/` ahead of the filename, since a bare filename names no location, and begins
with none of `/`, `~`, `./`, or `../`, since a path from a root never does and those four mark
an illustration or a question of form rather than of resolution. A link covers its own text as well
as its target, so a link whose text repeats its target raises one finding rather than two.
`citation-form` reports every link that climbs out of the citing folder — every `](../…)` link
whatever it resolves to, and every other spelling that resolves outside it, since `./../x` and a
mid-path climb break under archiving exactly as `../x` does — and every link whose target
names a store-level doc a segment or more below where it starts — root-absolute or root-relative,
reported as a `store-level doc link` rather than a cross-folder one — since `../workflow/one-home.md`
§ *One home per fact* gives a store-level doc no link form at all, and a root-absolute link resolves
here from the walked root while a Markdown renderer resolves it from the repository or workspace
root, so the form is reported rather than followed. That last reason does not depend on what the
target names, so a root-absolute link to anything else is reported as a `root-absolute link` for the
same reason, whatever this walk resolves it to. Its `detail` names the
replacement: the target task's bare slug where the target sits directly in the walked root, or
directly in that root's own `Archive/` or `Backlog/`, and its slug is unique; a `./` link where the
target is in the citing folder itself; the store-level doc's path from the root where the target is
one; that target's own path from the root otherwise, naming by absolute directory the root that holds the
target where it is not the citing task's, since two roots sharing a basename are ordinary and a
basename would not tell them apart; a note that the target is the store root itself where the link lands on that
root; and, where the target lies outside every walked root, a note saying so in place of a
replacement. The two notes name what was cited rather than a replacement because no citation form
expresses either target, and no branch ever names an empty path. Which form a citation owes is `../workflow/one-home.md`
§ *One home per fact*. A checked step's dead evidence link is reported under both `dead-citation`
and `dead-anchor`, which read the same link for different reasons.

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
marker-owned items compared — and `unreadablePaths` names everything under a walked root that this
run could not open, by absolute path, so a coverage gap is attributable to its root the way a finding
is and two roots sharing a basename stay distinct; findings alone are never read as coverage
(`scanned` is a floor while `unreadablePaths` is non-empty). A citation resolves wherever it points,
so the citation pass can meet an unlistable directory no walked root holds: that conceals the target
the same way, and is deliberately absent from `unreadablePaths`, which measures this run's coverage
of the store rather than every directory it touched. Warnings go to stderr and the exit status is always 0, so a
partly unreadable store still parses.

**Walk rules.** `node_modules` is pruned at every depth because the walk would never finish
otherwise; a helper directory needs no entry there, since a folder holding no role file is already
rejected, and a name-based prune costs a real task its scan silently. `.agents` is the one dotted
name entered — the canonical root `<project>/.agents/tasks` sits inside it, so pruning it would cost
a root registered as a project directory every task it holds. The walk lists every directory exactly
once and hands its entries down; the citation pass lists on its own account, following a target
wherever it points, so a directory can be listed by both. `unreadablePaths` is keyed by absolute
path against that, so an unreadable directory reports one coverage gap however many passes reach it.
The two containers are read differently: an `Archive/` fixes the state of everything beneath it at
any depth, so a `Backlog/` nested inside one is archived all the same and the archived exemptions
stay the wider set, while the backlog flag is the immediate parent's alone — a task filed under a
group inside a `Backlog/`, or under an `Archive/` inside one, is not parked
(`../workflow/task-archiving.md` § *Already archived is asked of the whole path up to the store*).

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
coverage gap and compared anyway. OS-generated files (`.DS_Store`, `.localized`, `Thumbs.db`, and any `._*` AppleDouble sidecar) are
matched by name or that one prefix rather than by a dotfile rule, because a skill may legitimately ship a dotfile (a
template's `.gitignore`) and it stays comparable. A marked entry under the staging prefix is an
interrupted install rather than a payload. Two symlinks are compared by their targets, since
`setup.ts` copies skills link-preserving and references link-materializing; one side being a link and
the other not is drift rather than a copy-mode difference.
