# Source contracts

This file owns the CLI forms, the stdout contracts, and the design rationale of `setup.ts`, every
`scripts/*.ts` helper, and the `tests/` suites. The sources themselves carry no comments, so this is
where a caller reads what a script decides before assembling a command from the flags a skill happens
to name.

## Shared conventions

**Zero dependencies, run directly on Node under type stripping.** Too old a Node fails as a parse
error, not a version message. The floor is stated once, in
[AGENTS.md § *The `.ts` sources are unchecked by design*](./AGENTS.md), and changing it is a one-line
change made there.

**The 0/1/2 exit convention** is shared by `scripts/task-move.ts`, `scripts/task-state.ts`,
`scripts/pr-comments.ts`, `scripts/size-check.ts`, `scripts/dup-check.ts`, and
`scripts/worktree-merge.ts`: 0 did the job, 1 is an outcome the script decided, 2 is a run that never
got that far. The reporting scripts beside them — `health-check.ts`, `session-triage.ts`, and
`size-report.ts` — always exit 0 instead, so a partly unreadable corpus still parses.

**stdout is asynchronous on a pipe**, so a script that emits a JSON report writes it and lets the
module end rather than calling `process.exit` after the write, which would discard whatever the pipe
buffer could not take — truncating a report above 64 KB. A reader that closes early then raises
EPIPE on a stream nothing awaits, and swallowing that is what keeps the promised exit status.

**No script calls `process.exit` to set a status**, and every one of them writes the reason for a
non-zero status before it assigns `process.exitCode`. An inline exit would set the status first and
discard whatever the stream had not yet flushed, so a refused run would report a code with nothing
saying why. `task-move.ts`, `task-state.ts`, `pr-comments.ts`, and `worktree-merge.ts` reach that by
throwing — an `Exit` carrying its code in the first three, `Refused`/`Unrunnable` in the last — which
one handler at the module's end catches, so every refusal leaves through one place. `size-check.ts`
assigns the status directly at each of its two sites instead, and `dup-check.ts` splits the two: a
`Refused` thrown from anywhere in the scan reaches one handler for the status 2, while the status 1 is
assigned after the report is written, since a finding is the report rather than a refusal.

## `setup.ts`

Installs the kit into the native agent homes (`~/.claude`, `~/.codex`): skills, `references/`,
`CORE_RULES.md`, and each host's native agent definitions, each written beside an ownership marker so
a later run reclaims what the kit installed and leaves everything else alone.

```
node setup.ts
```

**Contract.** stdout names each home and every item installed or skipped under it; a refused home is
named on stderr. Exit status: 0 = every home installed, 1 = at least one home was skipped.

**Why the staging dirs.** Skills and `references/` are each built under a hidden staging dir —
`.agents-kit-staging.*` inside `skills/`, `.agents-kit-references.staging.*` in the home — with the
marker inside, then atomically renamed into place, so the visible path is never present-but-unmarked;
an interrupted run leaves only a staging dir, swept under both prefixes by the next run's sweep of
leftovers. `CORE_RULES.md` and each native agent definition take no staging dir and no rename:
`touchMarker` then `copyFileSync` straight at the visible path, so a run interrupted mid-copy leaves
a partial file there.

**Why a home is refused.** Kit skills resolve `./AGENTS.md` and `./references` via symlinks to
install-root siblings. With user-owned copies in place every installed skill would resolve into
non-kit content, so the whole home is refused rather than installed broken. A symlinked `skills/` is
reclaimed when it is kit-owned — this repo, a dangling leftover, or a since-moved clone — and refused
otherwise: installing through a user's symlink would dangle every per-skill link.

**Why the copy modes differ.** Skills are copied with `verbatimSymlinks`, which is what keeps their
per-skill links relative: without it `cpSync` rewrites each target as an absolute path into the
checkout, which resolves back into the repo instead of the home it was installed to. `references/` is
symlink-free, so it is copied with `dereference`. `references/` and `CORE_RULES.md` are not removed
before the skills loop — every installed skill symlinks into them — and each is replaced at its own
site, the removal happening only once its replacement is staged and ready to rename.

**Why the reclaim sweep skips a symlinked entry.** `isDirectory` stats through a link, so a symlinked
entry inside `skills/` reaches the sweep like a real directory. The skip is what keeps it there:
without it the marker probe follows the link into its target, finds an `.agents-kit` there, and
removes the entry — a user's link, for a directory the kit never installed. Dropping the guard makes
a linked entry whose target holds a marker disappear from every home, which is what
`tests/setup-install.test.ts` pins.

**Why reclaiming a kit-owned `skills/` link uses `unlinkSync`.** Only the link goes away there, and
`rmSync` refuses a link whose target is a directory (`ERR_FS_EISDIR`) — the shape every reclaimable
link but the dangling one has. Kit ownership is read off the target: an absolute path whose basename
is `skills` and whose parent holds `setup.ts`, `CORE_RULES.md`, and `references/`, which is what
recognizes a since-moved clone as the kit's own.

**Why each replacement removes before it renames.** `renameSync` onto a non-empty directory fails
rather than replacing it, so removing `references/` is what lets the rename land at all, and the
window in which no `references/` exists is one rename wide. `CORE_RULES.md` takes no such removal:
`copyFileSync` overwrites a regular file in place, and the conflict gate above has already refused
the home if an unmarked copy were sitting there. Its marker is written first either way, so the
payload is never present-but-unmarked.

**Why the agent sweep is marker-driven.** Ownership rides on the marker alone, so the sweep removes
each native agent definition together with its marker: an install interrupted between the two is
reclaimed on the next run, while an unmarked same-named file stays the user's and is skipped by the
copy loop after it.

## `scripts/commit-scan.ts`

Enumerates one task's commits since its watermark — the commits-since-watermark step
`references/workflow/reconciliation-commits.md` owns, read by `resume-task`'s drift check and written
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
`**Pointers:**` line, lowercased, null when none is recorded; `branch` is the `` branch `<name>` ``
entry on that same line, null when none. That line is free prose, so both are found inside it rather
than parsed as the whole of it, and only the first `**Pointers:**` line of the `## Current state` block
is read — a result carrying no such block falls back to the first `**Pointers:**` line in the file, so
a legacy result still yields its floor. Mis-parsing either entry walks the wrong ref and
under-nominates, which is the failure that matters here; over-nominating costs nothing, since the
caller re-verifies every candidate before it writes.

`ref` is the ref that was enumerated and `refFallback` says why it is not the recorded branch. A
recorded branch is used as-is; a task's commits land there while the resolved root's `HEAD` stays on
the default branch, so enumerating `HEAD` would walk a ref the work is not on and return an empty range
for work that is committed. No branch recorded → `HEAD`. A recorded branch that no longer resolves, or
one the `**Pointers:**` entry marks `(removed …)` (`references/workflow/task-delivery-edges.md`
§ *Removal*), falls back to `HEAD` — where a merged branch's work now sits — with `refFallback` naming
the fallback so a brief can print it. Branch existence is tested with `git for-each-ref` and an exact
refname comparison rather than `rev-parse --verify --quiet`, which reports a missing branch and a
broken repository with the same silent non-zero status; the pattern is prefix-matching, so
`refs/heads/feat` would otherwise be satisfied by `refs/heads/feat/x`.

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

**Why the commit log carries a NUL record separator.** `--pretty=format:%x00%h %ad %s` prefixes each
commit header, so the reader splits records on a byte no path can hold instead of guessing which lines
under `--name-only` are headers. The log runs with `-c core.quotepath=false`, since git's default
C-quotes non-ASCII path bytes under `--name-only` and a quoted path would never name-match a step's,
and closes with `--` so the range is never read as a path. The command is otherwise the one
`references/workflow/reconciliation-commits.md` names.

The checkout discrimination — separating "not a git repository", which is a reportable `no-checkout`,
from any other `git` failure, which is a refused run — is mirrored from `scripts/worktree-merge.ts`'s
`checkoutHolding`. **Change either copy and change the other in the same edit.** The markdown-reading
layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

## `scripts/corpus.ts`

The one definition of the kit's Markdown corpus, imported by `scripts/dup-check.ts` and
`scripts/size-report.ts`. It exposes no CLI — `corpusFiles(root, handlers)` returns the corpus as
sorted absolute paths, and each caller supplies its own policy for what the walk could not read.

**The corpus is the prose a reader loads:** every `.md` under `references/` (recursively), every
`skills/*/SKILL.md`, `CORE_RULES.md`, and `AGENTS.md`. **This paragraph is that set's only
statement** — the duplicate scan reads it and the size ratchet totals it, so a corpus described
separately in each place is exactly the drift both checks exist to catch. `SCRIPTS.md`, `tests/`, and
`scripts/` sit outside it: a contract stated in prose and again in a source is the sanctioned copy's
mirror note to keep honest, not a duplicate to collapse.

**Every entry is `lstat`ed and a symlink is never followed**, but what a symlink *means* is the
caller's, and the two callers differ because one is a scan and the other a measurement. The walk
reports each through `onSymlink` with the kind of position it held:

- **`walked`** — a link met while enumerating, under `references/` or as a `skills/<entry>`. The entry
  is skipped; it is one of many, and the corpus is still fully measured without it.
- **`required`** — a link standing where a named corpus member belongs — a `skills/*/SKILL.md`,
  `CORE_RULES.md`, or `AGENTS.md` — or where a corpus root does. `references/` and `skills/` are each
  `lstat`ed before they are listed, because `readdirSync` resolves through a link and would otherwise
  walk whatever the root points at, reading prose from outside the kit root that no per-entry check
  ever sees. Nothing else supplies that member, and nothing else supplies the subtree behind that
  root, so a caller measuring totals cannot treat either as a skip without anchoring its number below
  the truth.

`scripts/dup-check.ts` skips both kinds and names them on stderr; `scripts/size-report.ts` warns on
`walked` and records `required` as a corpus miss, which refuses a `--update` capture. Collapsing the
two would either silence a miss that has to refuse or refuse a run over an ordinary skipped link.

A directory the walk cannot list reaches `onUnreadable` with its error code, except an absent
`skills/`, which yields no entries rather than an error: a kit root legitimately carries none.

A root rule file that is absent, or present but not a regular file, reaches `onMissing` with the
reason — nothing else supplies that member, so `scripts/size-report.ts` records it as a corpus miss
and `scripts/dup-check.ts` scans what exists. A skill directory holding no `SKILL.md` is not a
skill and reports nothing.

## `scripts/dup-check.ts`

Reports the prose this kit says twice: every normalized sentence of at least **12 words** occurring in
two or more distinct files of the corpus, with the `{file, line}` of each occurrence. A rule restated
away from its home is the drift [AGENTS.md § *Change routing*](./AGENTS.md) exists to prevent — the
home is edited, the restatement is not, the two disagree, and nothing fails — so this is the
mechanical half of keeping one fact with one owner and every other file citing it.

```
node scripts/dup-check.ts [--allow FILE] <kit-root>
```

**The corpus it reads** is the one § *`scripts/corpus.ts`* defines, whose module this check imports —
so what the size ratchet weighs is what this check reads, by construction rather than by two
descriptions agreeing.

**Every entry is `lstat`ed and a symlink is skipped**, named on stderr rather than followed. Which
positions the walk can meet a link at, and why one of them is a miss for the size ratchet, is
§ *`scripts/corpus.ts`*'s; this scan reads both kinds the same way, since a link that resolved back
into the corpus would report the prose behind it as a duplicate of itself.

**Cross-file only.** A group qualifies on its count of *distinct* files, so a sentence one file repeats
— a section restating its own opening — is not a finding. Once a group qualifies every occurrence is
listed, the within-file repeats included, because collapsing a duplicate means reading all of them.

**What the scan does not read.** YAML frontmatter, fenced code blocks, ATX heading lines, every
`## Core Rules` section of a `SKILL.md`, and any paragraph carrying the phrase `a sanctioned copy per`.
The first three are not prose a reader takes a rule from; the `## Core Rules` block is the deliberate
per-skill boilerplate the domain-pack interface requires of every skill, so flagging it would bury the
report under one group per skill; and a sanctioned copy is a duplicate the kit has already decided to
keep, recorded at its home with a mirror note (`AGENTS.md` § *Consumer lists*), so it is excluded by
that phrase rather than re-argued in an allow-file. The Core Rules skip ends at the next heading of
level 1 or 2, so a `###` inside the section stays skipped and the section after it does not.

**Paragraphs are joined before sentences are split.** Files here wrap inconsistently — some near 100
columns, some not at all — so a sentence split across two lines has to read as one sentence or the
same text in a differently wrapped file would never match. A paragraph runs until a blank line, a
heading, a fence, a list item, a table row, or the opening of a blockquote; a blockquote's `>` prefix
is dropped from each line before the join, so a quoted rule reads as the same sentence as its plain
twin, and a fence opened inside a blockquote closes with the quote, so an unterminated quoted fence
cannot swallow the rest of the file; its lines are joined with single spaces; and each sentence is
reported at **the line it starts on**. Sentences end at `.`, `!`, `?`, or `;` followed by
whitespace or end of paragraph, which splits an abbreviation like "e.g." too — identically in every
file, so a duplicate is still found, in two shorter groups rather than one.

**Markup is blanked before the split and stripped after it.** The split runs over a shadow copy of the
paragraph in which every markup character is replaced by a space *of the same width*, so offsets still
name the original text and a sentence still reports its own line. Blanking rather than deleting is what
finds the boundary in `…keep one inline.** No consumer states…`: the period abuts a bold close instead
of whitespace, so a split that read the raw text would swallow the following sentence whole and it
would never match the same sentence written after a plain full stop. Each sentence is then taken from
the original text and normalized, so what the report prints and the allow-file matches is the stripped
form, not the blanked one.

**Normalization is what makes two wordings one sentence.** HTML comments and a leading list marker —
with the task checkbox (`[ ]` or `[x]`) that may follow it — are dropped, links and images collapse to their text, backtick spans, emphasis markers, and table pipes are stripped, the result is
lowercased and its whitespace collapsed. A word is a token holding a letter or a digit, so an em dash
or a stray marker never pads a fragment up to the 12-word floor. That floor is what separates a
restated rule from prose that happens to share a phrase; below it the report is noise.

**The allow-file names the mirrors the kit keeps on purpose.** It is `<kit-root>/tests/dup-allow.json`
unless `--allow` names another, and it holds an array of `{sentence, reason, files?}` — `sentence` in
the normalized form the report prints, though it is normalized again on read so a copied-out sentence
with its original casing still matches; `files`, when present, the kit-relative paths the mirror is
expected in. An entry naming its files suppresses a group only when the group's distinct files are
exactly that set: a third copy, or one that moved to a file the entry never named, is reported as a
group, because what the entry excused was a particular pair of homes and not the sentence wherever it
lands. An entry without `files` suppresses the sentence wherever it occurs. A missing file is an empty
allow-list, not a refusal: the check is useful before anyone has decided a mirror is deliberate. An
entry carrying no `reason` refuses the run, because a reasonless entry is how a collapse that was never
done becomes permanent, and a `files` that is not a non-empty array of paths refuses it on the same
terms.

**A listed sentence that no longer occurs twice is `stale`, and stale fails.** An allow entry outlives
the duplicate it excused — the mirror is collapsed, the sentence is reworded — and a silently ignored
entry would then go on excusing whatever text later drifted into its shape. Reporting it as a finding
is what gets it deleted in the same change that collapsed the copy.

**Contract.** stdout is exactly one JSON object,
`{"root":<absolute kit root>,"files":N,"groups":[…],"allowed":N,"stale":[…]}`. Each group is
`{sentence,occurrences:[{file,line}]}` with `file` relative to the kit root, occurrences in file then
line order, and groups ordered by occurrence count descending then sentence. `allowed` counts the
allow-file entries that suppressed a group, and `stale` carries every entry whose sentence no longer
occurs in two files exactly as it was written in the allow-file — original casing, markup, reason
whitespace, and `files` when the entry carries it — so a reader finds it there by exact match. An
entry whose sentence still repeats, but in files other than the ones it names, is in neither count:
its group is reported. Skipped symlinks and the failure summary go to stderr.

**Exit status.** 0 = no group survived allow-list filtering and no entry was stale. 1 = at least one of
the two, the outcome the check decided. 2 = a run that never got that far: no kit root or one that is
not a directory, an unknown option, a directory that could not be listed, a corpus file that could not
be read, or an allow-file that exists but is unreadable, unparseable, not an array of entries
carrying both fields, or carrying a `files` that is not a non-empty array of paths. An unreadable
corpus file refuses rather than warning, unlike the reporting
scripts beside it: a check that skipped a file it could not read would report a clean corpus it never
finished reading.

## `scripts/health-check.ts`

Walks task roots and reports lifecycle health findings for the `maintain` skill.

```
node scripts/health-check.ts [--stale-days N] [--result-max-kb N] <root> [<root>...]
node scripts/health-check.ts --installs <kit-root> <home> [<home>...]
```

**Emitted `check` values.** The task walk reports `stale`, `done-unarchived`, `started-in-backlog`,
`unknown-status`, `legacy-result-status`, `dead-anchor`, `goal-id`, `no-current-state`,
`oversized-result`, and `duplicate-slug`; `--installs` walks no tasks and reports `install-drift`
instead.

**Archived and backlogged folders.** Archived folders are counted in `scanned` and exempt from every
check but `duplicate-slug`, which sees them because a bare slug falls back into `Archive/`
(`references/workflow/task-layout.md` § *Discovery rules for skills*), so an archived slug stays
citable and must stay unique. Backlogged folders are exempt from `stale` alone — parked work is
deliberately dormant (`references/workflow/task-backlog.md`) — and stay in every other check,
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
(`references/workflow/task-lifecycle.md` § *`result.md` — no status field*), so every status this walk
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

**Markdown reading.** Every scan over a task file skips fenced content, because a heading, a bullet,
or a status line inside a fence is illustrative markdown rather than the file's own. Closing a fence
takes the opener's marker at its own length or longer, no further indented than the opener, and
nothing after it but whitespace — a boolean flag would invert on a nested opener and hand back what it
skipped. The indent test is relative to the opener rather than CommonMark's flat 0–3 columns, because
a fence nested in a list item is legitimately indented past that. A status header is bounded to the
file's header block (`references/workflow/doc-task-files.md`), so the scan stops at the first
`##`-or-deeper heading. Anchors follow GitHub's rule — lowercase, drop every character that is not a
letter, digit, hyphen, underscore, or space, then map each space to a hyphen — with a repeated
heading taking the `-1`, `-2`, … suffix and allocation advancing past every slug already assigned. A
step link pointing at a tombstone bullet under a `## Compacted` stub
(`references/workflow/reconciliation-compaction.md`) is documented state, not a dead anchor.

**The size trigger has one measure.** `oversized-result` calls `scripts/task-state.ts`'s exported
`resultSize`, the same function that script's `--compaction-plan` mode reads for `due`, so a result
cannot be over the trigger in this walk and under it in the compaction plan those findings send a
caller to. The import runs that way round because this script's CLI runs at module scope: importing
*it* would run a whole walk as a side effect, while `task-state.ts` guards its CLI behind a direct-run
check and can be imported for its pure layer.

These markdown-reading constants and helpers are mirrored in `scripts/task-state.ts`, the fence and
status halves again in `scripts/task-move.ts`, the fence, heading, step-title, and checkbox halves
again in `scripts/commit-scan.ts`, and the fence and heading halves again in
`scripts/sweep-scope.ts`. Those readers must agree with this one: this walk's dead-anchor check
against task-state's `anchorResolves`, its terminal read against task-move's archive gate, its step
reading against commit-scan's path sets, which nominate steps this walk's plan reading also
enumerates, and its section bounds against sweep-scope's, which decide what a sweep may fetch from.
**Change a copy here and change every mirror in the same edit.**

**`--installs` mode** compares what `setup.ts` deployed against the kit. Only a marked item is
kit-managed and comparable; a marker that cannot be read is not the user's, so it is recorded as a
coverage gap and compared anyway. OS-generated files (`.DS_Store`, `.localized`, `Thumbs.db`) are
matched by name rather than by a dotfile rule, because a skill may legitimately ship a dotfile (a
template's `.gitignore`) and it stays comparable. A marked entry under the staging prefix is an
interrupted install rather than a payload. Two symlinks are compared by their targets, since
`setup.ts` copies skills link-preserving and references link-materializing; one side being a link and
the other not is drift rather than a copy-mode difference.

## `scripts/lifecycle-constants.ts`

The task constants `scripts/health-check.ts`, `scripts/task-move.ts`, and `scripts/task-state.ts`
read: the plan status vocabulary, the terminal set, the compaction size trigger, and the recognition
set that identifies a task folder by its contents.

Each value is owned in prose by a reference file; this module is their one sanctioned
machine-readable copy (AGENTS.md § *Consumer lists*) and changes in the same edit as the prose. Left
stale, a renamed status reads as `unknown` here, and the lifecycle checks that skip `unknown` —
stale, done-unarchived, started-in-backlog — go quiet on every task holding it.

- **`PLAN_VOCAB`** — `references/workflow/task-lifecycle.md` § *Status values* — a closed
  vocabulary; a value outside it is `unknown` rather than a guess, so a typo never reads as a
  lifecycle state.
- **`UNSTARTED_STATUS`** — the backlog entry gate (§ *`scripts/task-move.ts`*) and the
  archive checks. Exported so a rename lands here rather than in each consumer's own literal.
- **`TERMINAL_STATUSES`** — `references/workflow/status-transitions.md` § *Terminal vs. live states*.
- **`LIVE_STATUSES`** — the non-terminal complement, derived rather than spelled out so the two
  cannot drift apart.
- **`RESULT_MAX_KB`** — `references/workflow/reconciliation-compaction.md`
  § *Compaction (size trigger)*, which `maintain` reads at run time and passes as `--result-max-kb`;
  this copy only keeps a bare health-check run honest.
- **`ROLE_FILES`, `ROLE_SUFFIXES`, `holdsRoleFile`** — `references/workflow/task-layout.md`
  § *One task, one flat folder*: a folder is a task folder when it holds one of these files. The
  suffix forms are legacy names the format sweep renames, kept because only the kit's own canonical
  root is ever swept. Every script that decides "is this a task folder?" reads these, so a folder one
  accepted and another did not cannot happen.

`holdsRoleFile` takes file names rather than a path, so a caller that has already read the directory
does not read it twice; a suffix match excludes the bare suffix itself, which is a dotfile rather
than a role file.

## `scripts/pr-comments.ts`

Fetches one pull request's review threads for the `triage-findings` skill and emits them normalized,
so the skill spends its prose on judging resolution and acknowledgment rather than on a GraphQL query.

```
node scripts/pr-comments.ts <pr-number-or-url>
```

A bare number takes owner, repo, and host from the repository of the current directory, the way `gh`
resolves them itself; a pull-request URL carries its own owner, repo, and host, so that form runs
from anywhere — including against an enterprise host that is not the one `gh` would pick. `-F` is the
only form that expands `{owner}`/`{repo}` from the current directory's repository, and it also
converts an all-digit value to a JSON number, which the `String!` variables reject — so a literal
owner or repo read off a URL goes through `-f` instead.

**Contract.** stdout is one JSON object,
`{"pullRequest":{"number":N|null,"url":U|null,"author":LOGIN|null},"threadsTotal":N|null,`
`"paginationComplete":BOOL,"threads":[…]}` — each thread
`{id,isResolved,isOutdated,path,line,acknowledgmentCandidate,commentsComplete,comments:[…]}` and each
comment `{author,body,createdAt,url}`, threads and comments alike in the order GitHub returned them,
so a thread's last comment is its most recent.

`acknowledgmentCandidate` is mechanical — the thread is unresolved, its comments were fetched whole,
and the last of them was written by the pull request's own author — and says nothing about whether
that comment acknowledges a fix; reading it is the skill's judgment. It is false on a thread whose
`commentsComplete` is false, because the last comment fetched is then not known to be the last one
written: false means "not established", which routes the thread to open rather than to Verify.

`paginationComplete` is false whenever a page of threads, or of some thread's comments, was left
unfetched: the report is then a prefix of the review rather than the whole of it, and the per-thread
`commentsComplete` names which threads are the short ones. `threadsTotal` is the count GitHub
reported for the whole pull request, so `threads.length` short of it measures the gap. A walk that
produced no page at all is as short as one that stopped partway. Cursor pagination hands back a node
twice when threads change between pages, so threads are deduplicated by id and their comment
continuations with them.

Both walks are bounded at 20 pages, because a cursor that stops advancing would otherwise page
forever. A walk that reaches the bound is one of the things `paginationComplete: false` reports, so a
truncated walk is declared rather than mistaken for the whole review. The `gh` reply is read with a 64 MiB buffer:
`execFileSync`'s 1 MiB default aborts the whole fetch with `ENOBUFS` on a large review rather than
returning a short page, which would turn a fetchable pull request into no report at all.

An absent `isResolved`/`isOutdated` flag reads as unresolved and not outdated, so a field GitHub
stopped sending can only ever leave a finding open — never file it away as already addressed.

**Exit status.** 0 = a report was written, complete or not; 1 = nothing to report — no `gh`, no such
pull request, or a first fetch that failed; 2 = the run could not be carried out — bad usage, or an
unexpected failure. A failed first fetch is an outcome — the script asked and got nothing — so it
stays on 1; a crash is not, and takes 2. `gh`'s stderr is captured rather than inherited, so a
failure is reported once through this script's own prefixed message, carrying `gh`'s reason (no auth,
a 404, a GraphQL error) rather than `execFileSync`'s bare "command failed". Warnings go to stderr.

**Why the entry check goes through `realpath`.** Only a direct run may reach the network: the pure
layer above is what the tests import, and fetching at module scope would put a live `gh` call behind
every import. Node leaves `process.argv[1]` as it was typed while `import.meta.url` is already
resolved, so a run through a symlinked path would compare unequal and read as an import — and the
script would then do nothing at all.

## `scripts/session-triage.ts`

Triages Claude and Codex session transcripts for agent-misbehavior signals.

```
node scripts/session-triage.ts --since YYYY-MM-DD [--top N] <dir> [<dir>...]
```

**Contract.** stdout is one JSON object `{flagged, remainder, remainderPaths, scanned, sessions,
skippedUnknownRecords, skippedUnrecognized, skippedUnrecognizedPaths, unreadable, unreadableDirs,
unreadablePaths}` — `flagged` is the ranked top slice, `remainderPaths` names every flagged session
beyond it, and `unreadable` counts every in-window transcript and directory this run could not read
(`unreadablePaths` and `unreadableDirs` name them), so a caller advancing a since-marker can tell that
work was missed rather than cleared. `skippedUnrecognizedPaths` names the files whose host could not
be sniffed — reported, but outside that gate, since they would not sniff on a later run either.

`sessions` is the same in-window files grouped by where they ran: `{project, count}` sorted by count
descending, then by project with a `null` project last, since `null` carries no `localeCompare` order
among the paths. `project` is the first `cwd` the transcript's records carry — a Claude record's
top-level `cwd`, a Codex `session_meta`'s `payload.cwd` — found by walking the records in order rather
than reading the first one, which is routinely a summary or snapshot carrying none; it is `null` for a
file this run could not read, could not sniff, or that carries no `cwd` at all. **The counts sum to
`scanned`**, which is why the bucket is filled in the driving loop, once per file, rather than derived
from what triage returns: a readable, sniffable transcript that scores nothing never reaches the
ranked results, and an unreadable or unsniffable one is never classified at all, so a tally built
downstream of classification would silently describe less than the window it names.

Warnings go to stderr; the exit code is always 0.

Sessions are scored by their count of *distinct* signal classes and ordered by that then recency.
Mere failure presence never flags a session — most `is_error` tool results are benign
(file-not-found, no-match greps). Only the classified signals count.

**Argument handling.** A separate flag value is peeked and consumed only once it has the shape its
flag wants: `argv[++i]` would take the next argument whatever it is, and a swallowed session
directory leaves the walk short with nothing in the JSON to say so. `--top` must be a whole integer —
`parseInt` would pass `2junk` and `1.5` as 2 and 1 with nothing said — as `health-check.ts` also
requires. `new Date(y, m, d)` normalizes an out-of-range component instead of failing, so a
well-shaped but nonexistent date (`2026-02-30` → March 2) would silently shift the window; the
round-trip through `isoDate` rejects it, and rejects a NaN date with it. A window that never parsed
leaves every directory unread and is recorded as unread rather than left to the stderr warning alone:
the payload would otherwise be byte-identical to a window walked in full and found clean.

A record that parses to a bare `null` is valid JSON, so every non-object goes to the unknown tally
rather than being dereferenced. A file whose mtime could not be read counts as in-window rather than
assumed out.

## `scripts/size-check.ts`

Compares the kit's measured context loads against a committed baseline, so growth in what a skill
loads is a conscious, reviewed choice rather than silent drift. The measurement itself is
`scripts/size-report.ts`, run as a child process; this script only compares and records.

```
node scripts/size-check.ts [--update] [--allow-corpus-growth] [--hot-cap N] [--baseline FILE] <kit-root>
```

**Modes.** Without `--update`, the kit-wide `corpus` total and each skill's hot, cold, and transitive
byte totals are compared against the baseline (default: `<kit-root>/tests/size-baseline.json`): any
difference — a grown or shrunk total, a skill missing from the baseline, a baseline entry no longer in
the kit, a baseline carrying no `corpus` total, a skill whose hot total sits above the baseline's
`hotCapBytes`, a baseline carrying no `hotCapBytes` — prints one line to stdout and the run exits 1
with a re-capture hint, which names `--allow-corpus-growth` itself when the corpus is what grew, so
the hint is never a command the next run would refuse. `--update` rewrites the baseline from the
current measurement instead — except that a measured corpus above the total the baseline already
records exits 2 and writes nothing unless `--allow-corpus-growth` is passed. Shrinkage fails the check on purpose:
the baseline stays current only if every change that moves a total re-captures it in the same change,
which is what keeps the diff — and the growth it would reveal — reviewable.

Hot and cold are ratcheted apart because moving a citation between them leaves the transitive total
where it was: recorded as one number, the very change this ratchet exists to expose — what a skill
pays on every invocation — would be the change it could not see.

**Corpus growth is refused rather than recorded.** Every other total re-captures silently, because a
skill's closure moves for reasons a reviewer reads in the same diff. The corpus moves for one reason
only — the kit carries more prose — and a `--update` that absorbed it would let the total climb one
intended change at a time with nothing marking the moment. Spending `--allow-corpus-growth` puts that
decision in the command and in the diff of the change that made it. The refusal fires only against a
total the baseline **already holds**: a baseline with no `corpus` key, or one that cannot be read at
all, offers nothing to ratchet against, so `--update` records the measurement with no flag. That
first-capture rule is what lets a baseline captured before the corpus existed be brought forward by a
plain `--update`. The two cases are told apart on the way through, because they are not equally
benign: a missing key is a baseline predating the ratchet, while a file that exists and will not parse
is a baseline that *had* both values and lost them, so `--update` names it on stderr before capturing
and a check run refuses it as unreadable rather than as absent. Recording fresh over an unreadable
file is still the only thing a capture can do — but it happens out loud, since a ratchet that resets
silently is the one failure the whole mechanism exists to prevent. A corpus that shrank, or that did
not move, likewise needs no flag — the ratchet resists growth and nothing else. The flag bears on
`--update` alone; a check run ignores it.

**One hot cap the whole kit is held to.** `hotCapBytes` is a single ceiling on the worst case: every
skill's hot total must sit at or below it, and one that does not gets a line of its own
(`<skill>: hot N bytes over the cap of C`) beside whatever byte drift the same growth caused. The two
lines answer different questions — the drift line asks whether a total moved since it was reviewed,
the cap line asks whether the most expensive invocation in the kit is still affordable — so a
re-capture clears the first and never the second, and the drift summary appends that fact whenever a
cap line is present, since the hint above it would otherwise read as the remedy. The remedy is to
shrink the skill.

**The cap ratchets down only.** A plain `--update` carries the recorded cap forward unchanged. A
capture is how an *intended* byte change is recorded, so a capture that also raised the ceiling would
let the worst-case load climb one intended change at a time — the exact failure the cap exists to
prevent — and would make the number unfalsifiable, since it could never be exceeded. `--hot-cap N`
lowers it, and only lowers it: an N at or above the recorded value exits 2 and writes nothing, because
the flag exists to tighten a budget and a value that tightens nothing is a mistake worth naming rather
than a no-op worth absorbing. The asymmetry with `--allow-corpus-growth` is deliberate: the corpus
ratchet refuses growth in a *measurement*, which a flag then lets through because the growth is real
and has to be recordable; the cap ratchet refuses a raise of a *recorded limit*, which no flag lets
through, because a limit that a command can raise is a limit the command will raise. Raising it is a
hand edit to the baseline — rarely right, and when it is, the loosening arrives as a line a reviewer
reads in the diff of the change that needed it, which is the whole point of recording the number.

That first-capture rule holds here too: the ratchet bites only against a value the baseline **already
holds**. A baseline with no `hotCapBytes` — one captured before the key existed, or one that cannot be
read — offers nothing to carry forward, so `--update` records the measured maximum hot total across
the kit's skills, with no flag, announcing an unreadable file on stderr as above. On such a baseline
`--hot-cap N` records N instead: with nothing to lower there is nothing to refuse. The flag bears on
`--update` alone; a check run ignores it. An N that is not a whole, non-negative number is refused
before anything is measured, so a malformed value can never reach the baseline as a `null`.

The baseline holds totals only (`{skills:[{skill, hot/cold/transitive {bytes, approxTokens}}…],
corpus:{bytes, approxTokens}, hotCapBytes:N}`, the skill entries sorted as the report emits them):
per-file lists would churn on every edit without making the ratchet stricter. The report's corpus file
count is left out for the same reason it is not ratcheted — it moves for a file added and a file
removed alike, so it says less than the bytes beside it.

**Exit status.** 0 = clean (or baseline written), 1 = drift, 2 = the check could not run — no kit
root, no baseline to check against, a baseline that exists but will not parse, an unreadable
measurement, a measurement whose `unresolved` list is non-empty or whose `corpusMisses` list is (both
mean a partly measured kit, which would anchor a baseline below the truth), a `--update` whose corpus
grew past the recorded total without `--allow-corpus-growth`, or a `--update` whose `--hot-cap` value
does not lower the recorded cap.

## `scripts/size-report.ts`

Reports the runtime context each skill loads, in bytes and approximate tokens, so a
contract-slimming change can be measured against a captured baseline.

```
node scripts/size-report.ts [--skill NAME]... <kit-root>
```

**Three sets per skill.** The *direct closure* is what the skill itself pulls in: its own `SKILL.md`
plus every distinct `./references/<path>.md` and `./AGENTS.md` the file cites, resolved against
`<kit-root>` — the installed layout resolves a skill's `./AGENTS.md` to its copy of `CORE_RULES.md`,
so that is the file counted, never this repository's maintainer-facing `AGENTS.md`. A `SKILL.md` whose
Core Rules step cites the domain pack as the literal template `./references/<domain>/rules.md` loads a
real pack at run time, so the direct scan resolves the template against the kit's default pack
(`engineering`) and counts each phase file the same line names in backticks beside it — without this
the template's unconditional loads would be invisible to the byte totals. The template is counted
only in a `SKILL.md`; a reference file's prose mention of `<domain>` stays unexpanded.

That closure is reported split in two, as `hot` and `cold`. A citation is cold when the HTML comment
`<!-- cold -->` sits on its line — one marker gates the whole line, the template's expanded pack files
included — and a cited file lands in `cold` only when every one of its citations carries the marker,
because a single unmarked citation loads it unconditionally. The skill's own `SKILL.md` and its
`./AGENTS.md` are hot whatever a marker says. The marker classifies and nothing more: the condition a
cold file loads on is named in the `SKILL.md` prose beside the citation
(`references/workflow/skill-conventions.md` § *Cold citations*).

The `transitive` set is an upper bound: the whole direct closure, hot and cold together, plus,
recursively, every `./<path>.md` or `../<path>.md` a counted reference file cites, resolved against
the citing file's own directory. Cycles terminate and each file is counted once per set. Reference
files expand; a `SKILL.md` never does, so a composite skill's sibling-skill loads are outside every
set. Citations are matched wherever they appear in the text, fenced examples included — the transitive
number is a bound, so over-counting is the safe direction. Section anchors are ignored: the unit of
loading is the file. A citation climbing out of the kit root is reported rather than measured:
counting it would put a file outside the kit in a kit load path.

`approxTokens` is `round(bytes / 4)` — the flat approximation, applied to a set's total bytes rather
than summed from its per-file values.

**One kit-wide corpus beside the per-skill sets.** `corpus` counts the set § *`scripts/corpus.ts`*
defines, whose module this script imports. The per-skill sets measure what a skill
pays to run, which only reaches a file some skill cites; the corpus measures what the repository
carries, so prose that grows in a file nothing cites yet is still a number someone can ratchet. It is
counted, never listed — `files` is a count, and a per-file list would repeat what the per-skill sets
already carry. `--skill` does not narrow it either: the corpus is a property of the kit, not of the
selected rows.

The two symlink kinds § *`scripts/corpus.ts`* defines land differently here, and this is the caller
that makes the distinction load-bearing. A `walked` link is skipped with a stderr warning: a link
planted under `references/` would otherwise count the same bytes twice and move the total with no
prose having changed. A `required` link is reported as a miss below rather than skipped — nothing else
in the corpus counts that file, so following it would double nothing and skipping it drops real bytes.
It is a miss rather than a silent count because the per-skill walk resolves the same path with `stat`,
which *does* follow the link, so the two measurements would disagree about a file the kit demonstrably
has. A linked corpus root is the same miss at a larger grain: skipping it drops every file behind it,
and the per-skill listing of `skills/` reads through the link, so the rows would name skills the corpus
never counted.

**A short walk is reported, never inferred from the total.** Every path the corpus walk could not
measure — a `references/` subtree it could not list, a named file it could not `lstat`, one that is
not a regular file, one of the symlinks above — is recorded in `corpusMisses` as
`"<path> -> (<reason>)"` and warned on stderr. Without that list the failure is indistinguishable from
prose that was deleted: a shrunken total reads as ordinary drift, `--update` records it, and the
kit-wide budget is anchored below the truth by a transient permission problem. The gap is widest for a
subtree of references nothing cites yet, which is exactly what the corpus measures and the citation
walk never reaches, so `unresolved` cannot stand in for it.

**Contract.** stdout is exactly one JSON object,
`{"root":<absolute kit root, or null>,"skills":[…],"corpus":{…},"warnings":N,"unresolved":[…],"corpusMisses":[…]}`.
Each skill is `{skill,hot:{files,bytes,approxTokens},cold:{…},transitive:{…}}`, and each `files` entry is
`{path,bytes,approxTokens}` with `path` relative to the kit root — hot and cold in citation order,
transitive in breadth-first order. `corpus` is `{files,bytes,approxTokens}`, whose `files` is a count
rather than a list; a run with no measurable kit root reports it as three zeros beside the empty skill
list, so the shape never varies. `unresolved` names every citation that reached no readable file as
`"<citing file> -> <citation>"`, and a file whose own contents could not be read as
`"<file> -> (contents)"`, so a byte total is never read as complete coverage while it is non-empty.
`corpusMisses` does the same job for the corpus walk in `"<path> -> (<reason>)"` form, deduped. The two
stay separate lists because they fail for different reasons and a reader needs to know which: a
citation that resolves to nothing is a broken reference in the kit's prose, while a corpus miss is a
path the filesystem would not yield. Both are non-empty only over a kit that cannot be measured in
full, and `scripts/size-check.ts` refuses on either.

**Which directories are skills.** Only a genuinely absent `SKILL.md` marks a directory as not a
skill. Every other miss — `EACCES`, a `SKILL.md` that is itself a directory, a dangling symlink, where
the stat fails while `lstat` still sees the link — is a skill the report would otherwise omit
with no trace, so it is recorded as `unresolved` instead of silently narrowing the walk. That list is
one of the two `scripts/size-check.ts` keys its incomplete-measurement refusal on — `corpusMisses`,
above, is the other — and this is the half that catches a dropped skill: fold those misses into the
non-skill case and `unresolved` stays empty, the refusal never fires on them, and a baseline is
captured over a kit whose unreadable skills were dropped. A `--skill` name matching nothing is likewise reported as
a warning rather than narrowing the report to nothing, so a typo never reads as a skill that loads no
context.
Warnings go to stderr and the exit status is always 0, so a partly unreadable kit still parses.

## `scripts/sweep-scope.ts`

Enumerates the citations a reference sweep may fetch — the scope
`references/workflow/reconciliation-sweep.md` § *Scope* defines — for the reconcilers that run one.
**It fetches nothing and writes nothing**: the fetch, the material-change judgment, and the ledger
rewrite stay with the run, and this report is only the set they work through.

```
node scripts/sweep-scope.ts <task-dir>
```

**Contract.** stdout is exactly one JSON object,
`{taskDir,planStatus,deliverable,deliverableCandidates,ledger,citations}`.

`citations` holds one entry per distinct URL, in first-cited order: `{url,tag,occurrences}`.
`occurrences` is `{surface,file,section,text}` per citing site, in scan order — `CONTEXT.md`,
`plan.md`, `ticket.md`, `result.md`, then the deliverable — with `text` the citing line trimmed, which
is the description a fetch is compared against where the ledger carries no prior line. Deduplication is
on the URL as written, once a trailing bracket or sentence punctuation is trimmed off it, so two
spellings of one page stay two entries: over-fetching costs a request, while collapsing them would drop
a citing surface's own finding.

`tag` is the strongest tag `observations.md` records for that URL — `block` over `warn` over `info` —
and null where the ledger has no line for it or the folder has none. Strongest rather than last,
because `block` is a state tag a later `warn` line does not supersede.

`surface` says which in-scope surface the occurrence sits on: `context-references`,
`context-open-questions`, `plan-step`, `plan-open-questions`, `ticket-references`, `result-pointers`,
`result-pause`, `deliverable-published`. It is what routes an occurrence's finding, three of them
being surfaces a run never writes into (`references/workflow/reconciliation.md`
§ *Never-annotated surfaces*). A section opens at its heading and closes at the next heading of the
same level or shallower, so a `####` block inside a plan step stays inside that step. Every surface
but `plan-step` opens only at a `##` heading — a deeper `### Current state` inside a historic
section is that section's content, not the live block — while a step heading opens at its own
level, `###` being canonical. In `result.md`
only the `## Current state` block's `**Pointers:**` lines are read — its gloss and `**Next:**` line
are not, and neither is anything below it but the active pause section.

`planStatus` is the plan's own status, read through `scripts/task-state.ts`'s exported report rather
than a fourth copy of the status patterns. It gates that pause section: the active pause is the one
`task-state.ts`'s `compactionSections` marks `pause` — the most recent `**Blocked:**` section under a
`blocked` plan, the most recent `**In review:**` section under `in-review`, and none at all in any
other state — read from there rather than re-derived, so the compaction plan and the sweep cannot
disagree about which pause is active.

`deliverable` is the doc-task deliverable, resolved per
`references/workflow/doc-task-files.md` without the plan's optional `**Deliverable:**` header: the
folder's `.md` that is neither a role file nor one of the two derived roles beside them
(`diagram.md`, `observations.md`) and that carries a `**Status:**` line in its own header block —
above the first `##` heading, never inside a fence or a blockquote, which is what keeps a doc quoting
another file's header out. `deliverableCandidates` names every file passing that test; two is a
layout error to surface rather than guess between, so `deliverable` is null, both are named, and the
count is warned on stderr. Only a resolved deliverable's `**Published:**` lines are swept.

**The skip rules.** A citation is in scope only when it names a scheme with an authority
(`<scheme>://`), which drops `mailto:`, anchors-only targets, and relative links in one test rather
than three; `file://` and a loopback host (`localhost`, `127.0.0.1`, `[::1]`, `0.0.0.0`) are then
excluded by name. Both markdown link targets and
bare URLs are read out of every line and deduplicated within it, so a link whose text repeats its own
URL is one occurrence rather than two.

**Exit status.** 0 whenever a report was written — an empty `citations` list is the no-sweep state the
caller reports, not a failure. 2 is the run that never got that far: bad usage, an unreadable argument,
or a folder holding none of the role files `scripts/lifecycle-constants.ts` recognizes. There is no 1:
an empty scope is a report, not an outcome the exit code has to carry. Warnings go to stderr.

The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

## `scripts/task-move.ts`

Performs one guarded task-folder move for the `archive-task` and `backlog-task` skills: the
location-relative relocation into a sibling `Archive/` or `Backlog/` container defined by
`references/workflow/task-archiving.md` and `references/workflow/task-backlog.md`. The archive
precondition — a terminal plan — stays with `task-archiving.md`; the park precondition, the
**unstarted entry gate**, is this script's own contract, stated here: a folder with no `plan.md`
is admitted provided it holds no `result.md` either (a result file exists only once execution
starts); a plan at `to-do` is admitted; `executing`, `blocked`, or `in-review` is refused (a live
task pauses through the `blocked` status, never by being moved); `done` or `skipped` is refused,
pointing at archiving; a status outside the vocabulary is refused as unplaceable. The status
values are read from `scripts/lifecycle-constants.ts`, the sanctioned copy of
`references/workflow/task-lifecycle.md` § *Status values*.

```
node scripts/task-move.ts <slug-or-path> --to archive|backlog
```

**Contract.** A completed move writes one line to stdout, `moved <src> -> <dest>` with both paths
absolute, and exits 0. A refused move writes its one-line reason to stderr and exits 1, having
changed nothing on disk. A run that never got as far as deciding — bad usage, a slug matching no
folder or several, or an unexpected failure — writes one line to stderr and exits 2. The exit status
carries the outcome here rather than always being 0 as in the reporting scripts beside it, because a
caller must be able to tell a completed move from a refused one without parsing prose. Warnings — an
unreadable registry is the only one — also go to stderr and change no outcome.

A refused move that created the container removes it again, with `rmdirSync` rather than a recursive
remove: a container something else wrote into between the create and the failed rename is not this
run's to delete. One that already existed is the user's and is left alone.

**Resolution** is deliberately minimal, since the skills own interactive disambiguation: an argument
holding a path separator is taken verbatim (resolved against the process directory), while a bare slug
is looked up as `<root>/<slug>` and inside each root's archive and backlog containers, across the
canonical `<cwd>/.agents/tasks` plus every `taskRoots` entry of `~/.config/agents-kit/config.json`
(`references/workflow/task-store.md`). `~` is expanded here because this script reads the registry
itself rather than being handed an already-resolved root. No match, or more than one, exits 2 asking
for a path rather than guessing at which task was meant.

Either form must name a **task folder**, identified by its contents against the recognition set in
`scripts/lifecycle-constants.ts` — the same set the health walk uses. Position never qualifies a
folder: a registered root's project area and a store root are both directories holding no role file,
and both would otherwise pass the unstarted gate, which tests only what a task folder does *not*
hold. A bare slug that matches no task folder exits 2; a path naming one is refused with 1.

The move is a single rename of the whole folder, which is what keeps its internal `./` links intact.
Inside the folder this reads the directory listing and the plan's status header — the entry gate tests
a `result.md` for existence alone — and nothing in it is ever written.

The fence and status halves mirror `scripts/health-check.ts`; see the mirror note in that section.

## `scripts/task-state.ts`

Reports one task folder's mechanical plan state for the `resume-task` and `review-task` skills:
checkbox state, the next pending step, checkpoint outcomes, result-anchor resolution, and the
goal-coverage map. Those skills keep the judgment that reads this report — whether a claim still
holds, whether a citing step delivers all of its goal — and stop hand-enumerating the facts under it.
Its second mode, `--compaction-plan`, reports the same kind of mechanical fact for a compaction
proposal (`references/workflow/reconciliation-compaction.md`). **Neither mode writes anything.**

```
node scripts/task-state.ts <task-dir>
node scripts/task-state.ts --compaction-plan <task-dir>
```

**Contract.** stdout is exactly one JSON object,
`{taskDir,plan,result,goalsFile,steps,nextPendingStep,checkpoints,goalCoverage}`.

`plan` is `{file,status,statusRaw}`: `status` is a value of the plan lifecycle vocabulary, `unknown`
for a header the vocabulary does not hold, or null for no status header at all. `plan.md` is the
task's only lifecycle home, so `result` carries no status of its own: it is `{file,legacyStatus}`,
where `legacyStatus` is the pre-contract `**Status:**` header a result file may still hold
(`references/workflow/task-lifecycle.md` § *`result.md` — no status field*), reported verbatim for
inspection, acted on by nothing, and null on a conformant file. `result` is null when the folder has
no `result.md`, and `goalsFile` is null when it has no `goals.md` — which empties every coverage list
rather than reporting the plan's own citations as unknown IDs.

`steps` follows plan order:
`{number,title,checked,anchor,anchorResolves,goals,goalEscape,dependsOn}`. `number` is the plan's own
step token, so a revision-inserted `Step 3a` reports as `"3a"`. `checked` reads the step's first
checkbox line — its `**What:**` marker. `anchor` is the anchor of the `([result](…))` link on that
same line, null when it carries none; `anchorResolves` is null for an unchecked step, which claims
nothing, and a boolean for a checked one — false when the link is missing, points outside `result.md`,
or names a heading `result.md` does not hold, counting a tombstone under its `## Compacted` stub as
held. `goalEscape` marks the `**Goal:** none (infra/refactor)` escape, which is what separates a
deliberate infra step from an orphan. `nextPendingStep` is the first unchecked step's number, null
when every step is checked. `checkpoints` lists every `### Checkpoint after Step N` the plan authors,
in plan order, each with the `**Outcome:**` token of the matching result section — null when no such
section exists, which is a checkpoint that has not run.

`goalCoverage` is `{goals,uncoveredGoals,orphanSteps,unknownGoalCitations,scopePartition}`. `goals`
maps each `goals.md` ID to the steps whose `**Goal:**` line cites it; `uncoveredGoals` are the IDs no
step cites — a goal the plan defers is listed there too, and its `deferred` membership is what makes
that expected rather than a gap. `orphanSteps` are steps citing no goal and carrying no escape;
`unknownGoalCitations` are steps citing IDs `goals.md` does not hold, empty when there is no
`goals.md` to check against. `scopePartition` is
`{delivered,deferred,missingFromPartition,inBoth}` over `goals.md`'s IDs, read from the plan's
`## Scope`; the partition is total exactly when the last two lists are empty.

**`--compaction-plan` mode** answers the mechanical half of a compaction proposal — is one due, may it
run at all, and what would it collapse — for the skills that propose one. stdout is exactly one JSON
object, `{taskDir,resultFile,bytes,maxKb,due,precondition,keep,removable}`. The mode is about
`result.md`, so that file is the one it requires; `plan.md` is optional here and supplies only the
status the active pause section is judged against.

`due` is `bytes` **strictly over** `maxKb * 1024`, `bytes` being the UTF-8 length of the decoded
file. `maxKb` is `RESULT_MAX_KB` from `scripts/lifecycle-constants.ts` with no flag to override it:
`maintain` overrides the health walk's trigger because it reads the prose value at run time, while a
proposal for one folder has no such second source to reconcile against.

`precondition` is `{state,detail,uncommitted}` over `git -C <task-dir> cat-file -e HEAD:./result.md`.
`state` is `ok` when the result resolves at `HEAD` and `fails` otherwise, `detail` carrying git's own
reason on a failure and null on success. Compaction deletes text recoverable only from version
history, so nothing weaker qualifies: an ignored folder sits inside a repository while holding nothing
in history, and a staged-but-never-committed file has no commit holding its text — both report
`fails`. `uncommitted` is whether `git status --porcelain` still reports pending changes to the file,
which is what refuses a proposal until the user commits — uncommitted text is recoverable nowhere,
so only a clean, `HEAD`-resolvable result may be proposed for compaction
(`references/workflow/reconciliation-compaction.md`); it is null when the precondition failed or
the status call did not run.

`keep` and `removable` partition the result's `##` sections in file order — `{heading,anchor,rule}`
and `{heading,anchor}`. The header block above the first `##` heading is not a section and is never
eligible, and a `###`-or-deeper heading belongs to the `##` section above it rather than opening one.
Anchors are allocated by the same slug rule the anchor check above uses, so a `removable` entry
carries both halves a tombstone needs: its `heading` is the bullet's whole text — nothing else, or the
step link that resolves through it stops resolving — and its `anchor` is the link that was pointing at
it.

`rule` names why a section is kept: `current-state`, `decision-log`, `acceptance`,
`health-boundary`, `reconciliation` — the last such section in the file, every earlier one being
narrative a later entry superseded — `compacted` for a prior `## Compacted` stub, whose tombstone
bullets are the anchors an earlier compaction left resolvable and which the next stub is appended to
rather than replacing, and `pause` for the most recent section the plan's **own status** owes:
`**Blocked:**` under `blocked`, `**In review:**` under `in-review`, recognized from the section's
heading or from a bold label on a line of its own inside it. A pause section the current status does
not owe is a closed pause, and reports as removable like any other prior log section; so does every
pause section when the plan is missing, unparseable, or in any other state.

**The two lists are eligibility, never a decision.** `removable` is everything the keep-list does not
protect; which of those sections are actually superseded narrative, and whether to propose the
collapse at all, stays with the caller and the consent rule that file owns.

**Exit status.** 0 = a report was written; 1 = nothing to report, because the argument names no
readable `plan.md` — or, under `--compaction-plan`, no readable `result.md`; 2 = the run could not be
carried out — bad usage, a `git` that is absent, or an unexpected failure. A crash must not land on 1,
which would report a readable plan folder as having none. Warnings go to stderr.

The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

**Why the entry check goes through `realpath`.** Only a direct run reads the filesystem: the pure
layer above is what the tests import, and reading at module scope would put a folder walk behind
every import. The resolution itself is the same quirk `scripts/pr-comments.ts` documents — see that
section.

## `scripts/worktree-merge.ts`

Performs the coordinator-side worktree merge gates defined by
`references/workflow/parallel-batch.md` § *Coordinator-side parallel batch* — the raw delta against
the batch baseline, the surface check that bounds it, the verified incorporation, and the removal that
refuses until the incorporation has been proved to land.

```
node scripts/worktree-merge.ts baseline <tree> --out <manifest> [--prune <path>]...
node scripts/worktree-merge.ts check <worktree> --baseline <manifest> --surface <path>...
                               [--prune <path>]...
node scripts/worktree-merge.ts apply <worktree> --baseline <manifest> --into <tree>
                               --surface <path>... --receipt <file> [--prune <path>]...
node scripts/worktree-merge.ts remove <worktree> --receipt <file>
node scripts/worktree-merge.ts discard <worktree>
```

**Contract.** stdout carries the delta and the outcome, one path per line, and the run exits 0 when it
did the job. Exit 1 is an outcome the script decided — a surface escape, a conflict, an incorporation
that did not verify, a removal with no verified receipt or of repository content — reported on stderr
with nothing further attempted. Exit 2 is a run that could not be carried out at all: bad usage, an
unreadable tree, a manifest that will not parse, a tree that cannot be measured the way the manifest
was — all of them before anything is written, since once `apply` has copied, a measurement that will
not run is an incorporation that did not verify and takes exit 1, naming the landed/did-not-land split
as uncomputable rather than reporting one it never measured. "An unreadable tree" there means the
root, or a subdirectory the repository does not ignore; one it ignores is deferred rather than
fatal. Whether it is ignored cannot be asked until the walk has its own path list, so an unreadable
subdirectory is held until the walk finishes and refused only if `check-ignore` does not name it —
refusing sooner would fail the run on exactly the trees the ignore filter exists to remove, and
that tolerance is what makes the caller-facing rule that a git-ignored path outside every declared
surface needs no `--prune` safe to follow (`references/workflow/parallel-batch.md`
§ *Coordinator-side parallel batch*).

An option a command does not take is bad usage rather than an ignored flag: `discard`'s empty option
list is what keeps a mistyped `remove` from becoming an ungated delete. The dispatch keeps a matching
guard for a command the parser has no entry for, so a subcommand added to one and forgotten in the
other is named rather than surfacing as a `TypeError`.

**Why a script and not shell.** The gates are ordered, and the ordering is the whole protection. Shell
re-authored per run is where a worktree gets removed before the copy that was supposed to precede it
has been proved — the failure this file exists to make structurally impossible. `apply` writes its
receipt only after re-reading every path it wrote and matching it against the worktree's content, and
`remove` refuses any worktree whose receipt does not carry that verification. A failed copy therefore
leaves no receipt, and a worktree with no receipt cannot be removed — except through `discard`, which
is how a worktree that never earned one (surface-escaping, hung, failed) goes.

**Manifests carry hashes, never content**, so this script **detects and verifies but never
reconstructs**. The "restore that exact capture" step the cited file names on a conflicting
incorporation is deliberately not here: it needs the bytes, and the coordinator owns it. What the
script gives a restore instead is exactness about what happened — the applied set, and on a
verification failure either the precise split between the paths that landed and the paths that did
not, or, where the measurement itself could not run, the statement that there is no split to give.

**A `baseline` manifest serves three roles**: the two the cited file needs — the batch baseline every
unit's change set is measured against, and the exact pre-unit capture of the shared tree taken at a
unit's ordered position — and the health-boundary reference of
`references/engineering/boundary-scope.md` § *Reference and delta*, whose delta a later `check` against
that manifest computes. They are the same operation on a different tree at a different moment, so a
change to what `baseline` captures or what `--prune` hides reaches all three.

**Git-ignored content.** On a Git checkout every walk drops the untracked paths the repository
ignores, and the manifest records `gitignore` so both sides of a comparison measure alike — a tree
that cannot reproduce a `gitignore: true` measure is refused rather than compared against one. Seeding
a worktree with `git worktree add` carries no ignored file across, so measuring them reads each of the
shared tree's own (`.DS_Store`, editor and agent settings) as a deletion escaping the unit's surface,
and each of the worktree's build output as an addition. Tracked content is unaffected: `check-ignore`
lists ignored *untracked* paths only, so a force-added file matching an ignore pattern stays measured.
Each side asks its own index, and a worktree's index is HEAD, so a path the baseline measured stays
measured on the other side whatever that index says: a force-add staged but not yet committed is
tracked in the shared tree and an ignored untracked file in its worktree, and filtering both alike
would read it as a deletion that `apply` then carries out.

One `check-ignore` call carries the whole walk. The paths go in over `--stdin` because a few hundred
of them would overflow argv, NUL-delimited both ways (`-z`) so a newline in a filename decides
nothing, and the reply is read back with an unbounded `maxBuffer`: a single large ignored tree — a
pnpm store, a framework cache — runs past Node's 1 MiB default and would fail the walk on exactly the
trees the filter exists to drop. Exit status 1 is the success that matched nothing; only a
`not a git repository` on stderr reports a missing checkout, and any other failure refuses the run
rather than reporting the tree unfiltered. The walk collects its leaves first and hashes them after
the filter has run, so an ignored cache is dropped rather than hashed and then discarded.

What the filter must never do is drop a path quietly enough that work goes missing under a verified
receipt. A path this walk dropped — one the worktree holds and the ignore filter removed — that sits
inside the unit's **declared surface** and whose content differs from the shared tree's is reported as
`ignored <path> NOT MEASURED`, counted in the `ignored-divergent` trailer, and refused by `apply`
before it writes anything: the unit was told to write there, so the difference is its own output, and
incorporating around it would report `verified` over the loss and clear `remove` to take the worktree
holding the only copy. The reverse direction needs no check — an ignored path the shared tree holds
and the worktree does not is a seeded worktree's steady state. Outside the surface nothing is
examined; a same-tree comparison reads every path against itself and never diverges.

**Prunes and tracked content.** A `--prune` filters the baseline as well as the current walk, so a
pruned path can never appear in a change set at all. That is what makes it right for tool state and
wrong for anything the project tracks — a committed bundle, a checked-in generated client, a
zero-installs cache. Callers name only untracked paths, and only those the ignore rules do not already
cover *outside every declared surface*. Inside one, an ignored path the worktree holds and the shared
tree does not is `ignored-divergent` and refuses the `apply`, and a `--prune` is the remedy: it skips
the path before the walk makes it a leaf. What remains to name: output a project neither tracks nor
ignores, and any tree outside a checkout, where there is nothing to ask. The caller-facing rule and
its consequences live with each role (`references/engineering/boundary-scope.md` § *Reference and
delta*, `references/workflow/parallel-batch.md` § *Coordinator-side parallel batch*).

`.git` and `node_modules` are pruned by name at every depth, whatever their type: `.git` is a
directory in a main checkout and a file in a linked worktree, `node_modules` an installed tree that
seeding links rather than copies. A `--prune` is different: a root-relative path hiding that path
alone, so `--prune cache` for a tool-state directory at the root cannot also hide a unit's edits under
`src/cache`. A prune that resolves outside the root, or to the root itself, is a usage error rather
than a silently empty filter.

**What an entry is.** Symlinks are recorded by their target and never followed. A directory is not
itself an entry — the contract measures paths whose content, presence, or absence differs, and an
empty directory carries none of the three — so a file the unit turned into a directory reads as
deleted, exactly as the manifest has it. Deletions are applied before writes, so a directory's
baseline descendants are gone before anything the unit put at that directory's path is installed
there; the copy clears whatever holds a path first, since `copyFileSync` onto a symlink writes through
it into the link's target. A symlink is cleared with `unlinkSync` rather than `rmSync`, which refuses
a link whose target is a directory unless told to recurse — and recursing through one removes the link
alone in any case, so unlinking outright keeps neither shape depending on that behavior. A path whose
ancestor below the shared root is a symlink the change set is
not itself removing is refused outright. An absolute link into the transient worktree is re-pointed at
the same path under the shared tree, since it would otherwise dangle once that worktree is removed.

A directory is never an entry, so a deletion that empties one leaves it standing. A copy that
completed without error is therefore followed by a pass that takes those directories off the shared
tree: from each deleted path's parent it climbs toward the root, deepest-first, so a directory goes
only after whatever it held, stopping at the first ancestor that is non-empty, that is not a plain
directory, or that lies outside the unit's declared surface — the surface bounds this cleanup as it
bounds every other write. A copy that failed returns before the pass, leaving the tree's shape to the
restore. The pass swallows its own errors, a directory that will not go being cosmetic rather than a
failed merge, and what it removes appears in no delta line and no receipt entry, since both carry
entries alone.

**Removal.** A linked worktree carries `.git` as a file and goes through Git; a plain scratch
directory carries none and is removed directly. A `.git` directory is a checkout, and the one thing
this never removes — and a Git refusal is reported as one, never turned into a recursive delete. A
plain directory inside a checkout is repository content and is refused: the recursive delete is the
only removal with nothing but a path behind it. `remove` re-checks presence, not hashes: the receipt
already carries the exact verification, and a path a later ordered unit legitimately rewrote must not
read as a failure.

The worktree a receipt names is stored and re-compared through `realpath`, so a receipt written under
`/private/tmp` still matches a `remove` invoked as `/tmp`; a path that cannot be resolved keeps its
merely-resolved form. Without that normalization the gate refuses on the macOS symlinked temp roots
alone, which is the one place it would be noticed.

`checkoutHolding`'s discrimination — "not a git repository" read off stderr, every other `git` failure
refused rather than swallowed — is mirrored in `scripts/commit-scan.ts`, where the same test separates
a reportable `no-checkout` from a run that could not be carried out. **Change a copy here and change
the mirror in the same edit.**

## `tests/`

Every suite is zero-dependency and runs under Node type stripping, like the sources it covers.

```
node --test tests/<name>.test.ts        # one suite
node --test "tests/*.test.ts"           # every suite — quoted, because the runner takes glob
                                        # patterns and resolves a bare directory as a module path
```

- **`setup-install.test.ts`** — `setup.ts`: what the installer deploys, what it reclaims, and what
  it refuses to touch.
- **`health-check.test.ts`** — `scripts/health-check.ts`: the task-lifecycle walk and the
  `--installs` deploy-drift check.
- **`task-move.test.ts`** — `scripts/task-move.ts`: the guarded archive and backlog moves, their
  preconditions, and the 0/1/2 exit contract.
- **`task-state.test.ts`** — `scripts/task-state.ts`: the plan-state report — checkbox state, next
  pending step, checkpoint outcomes, result-anchor resolution, goal coverage — the
  `--compaction-plan` mode's size trigger, `HEAD` precondition, and keep/removable split, and its
  0/1/2 exit contract. The CLI cases run fixture task folders end to end; the parsing variants call
  the exported pure layer directly, which needs no folder on disk. Its precondition cases build real
  checkouts on the same terms as the `commit-scan` suite below, since resolving at `HEAD` is a
  property of a repository rather than of text. One case runs `scripts/health-check.ts` over a fixture
  root holding a result of exactly `RESULT_MAX_KB * 1024` bytes and one of a byte more, and that
  cross-script case is what pins the walk's `oversized-result` verdict and this mode's `due` to a
  single measure — nothing else fails if they drift apart.
- **`commit-scan.test.ts`** — `scripts/commit-scan.ts`: the commits-since-watermark scan — the four
  states, the recorded-branch ref resolution and its `HEAD` fallbacks, the candidate/info
  classification, the 20-commit cap — and its 0/2 exit contract.
- **`sweep-scope.test.ts`** — `scripts/sweep-scope.ts`: the in-scope surfaces, the URL deduplication
  that keeps every citing surface, the ledger tag precedence, the plan-status condition on the pause
  section, and the skip rules. Every fixture URL is under `.invalid`, which resolves nowhere: a case
  that reached the network would hang or fail rather than pass quietly, which is how the suite pins a
  report built without a fetch.
- **`session-triage.test.ts`** — `scripts/session-triage.ts`: transcript triage, its six signal
  classes, and its ranking.
- **`pr-comments.test.ts`** — `scripts/pr-comments.ts`: the two-level page merge, the normalized JSON
  contract it emits, the argument forms, and the `gh` invocations the fetch walks build.
- **`size-report.test.ts`** — `scripts/size-report.ts`: the per-skill context-load measurement and
  its JSON contract.
- **`size-check.test.ts`** — `scripts/size-check.ts`: the context-size baseline ratchet and its
  0/1/2 exit contract.
- **`dup-check.test.ts`** — `scripts/dup-check.ts`: the cross-file duplicate-sentence scan — each
  structural exclusion (frontmatter, a fenced block, a `SKILL.md` `## Core Rules` section and where
  that skip ends, a sanctioned-copy paragraph, a symlinked directory), the hard-wrap join and the
  line a wrapped sentence is reported at, the blockquote prefix, the task-list checkbox, the split through an abutting emphasis marker, the
  twelve-word floor, the cross-file rule, the allow-list with its file scoping and its stale detection
  — and its 0/1/2 exit contract.
- **`worktree-merge.test.ts`** — `scripts/worktree-merge.ts`: the baseline manifest, the
  returned-worktree surface check, the verified incorporation and its verification, the receipt gate
  on removal, and the 0/1/2 exit contract.
- **`invocation-gate.test.ts`** — the invocation gate's three-way invariant
  (`references/workflow/skill-conventions.md` § *The invocation gate*): a gated skill carries
  `disable-model-invocation: true` in its `SKILL.md` frontmatter, an `agents/openai.yaml` denying
  implicit invocation beside it, and an entry in that section's roster. The three drift
  independently — nothing else reads all of them — and one host mechanism without the other leaves
  the skill open on that host, silently.

**The `pr-comments` suite never reaches the real CLI or the network.** Every case either feeds fixture
pages to the pure layer, exercises an argument the script rejects before it fetches, or runs the
script against a fake `gh` placed first on `PATH`. Keep it that way: a case that would need either
belongs nowhere in that file.

**The `setup-install` suite pins a rule about `references/` that reaches past its own assertions.**
`setup.ts` installs that tree with `dereference`, which materializes any symlink it finds, while
`scripts/health-check.ts`'s `--installs` pass reports a one-sided link as drift. A symlink added
under `references/` would therefore report as permanent, unfixable drift in every installed home —
so nothing in that tree may become one.

**The `commit-scan` suite builds real checkouts.** Each case runs `git init` in a temp directory and
commits into it, because the states under test — a branch that resolves, one that does not, a
watermark outside the resolved ref's history — are properties of a repository rather than of text a
fixture could hold. Every checkout sets `user.email`, `user.name`, and `commit.gpgsign` locally and
stages with `git add -f`, so a contributor's global config, signing key, or ignore file cannot decide
whether the suite passes. The task folder is never staged: it lives inside the checkout, as a
project-local one does, and staying untracked keeps it out of the ranges the cases assert on.

**The `size-check` suite's cases share one kit.** It is written once and then mutated in place, so a
case that adds a skill or a marker removes it again even on failure: the cases after it measure the
kit the one before left behind.

**The `size-report` suite fixtures both citation orders on purpose** — one file cited
unmarked-then-marked, another marked-then-unmarked. A fold that simply keeps the last write agrees
with the unanimous answer on one order and contradicts it on the other, so a single order would
leave the marker's unanimity rule half-tested.

**The `health-check` suite's fixture ages are load-bearing.** Four folders sit well past the 30-day
default, and what keeps each one out of `stale` — or fails to — is the point: `done-unarchived` by
the terminal-status exclusion, `unknown-status` by the vocabulary check that reads an
out-of-vocabulary header as `unknown`, and `parked-todo` by the backlog exemption. `no-status-plan`
is held out by nothing: the live-status guard fires only on a non-null value, so a plan carrying no
parseable status falls through and is reported under the `no-status` label — the second of the two
stale findings the suite counts. A regression in any of the three exclusions moves that count.
