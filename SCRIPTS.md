# Source contracts

This file owns the CLI form, the stdout contract, and the design rationale of `setup.ts`, of the
`tests/` suites, and of the helpers only a maintainer runs — `scripts/corpus.ts`, `dup-check.ts`,
`lifecycle-constants.ts`, `size-check.ts`, and `size-report.ts`. A helper a skill runs at run time —
`commit-scan.ts`, `health-check.ts`, `pr-comments.ts`, `session-triage.ts`, `sweep-scope.ts`,
`task-move.ts`, `task-state.ts`, and `worktree-merge.ts` — has its CLI form and stdout contract in
`references/scripts/<name>.md` instead, where the skills load it, the size ratchet measures it, and
the duplicate scan reads it; its section here keeps only the design rationale and the mirror notes a
caller does not need. The sources themselves carry no comments, so those two places are where a
caller reads what a script decides before assembling a command from the flags a skill happens to
name. This file is maintainer material no run loads — the class
`references/workflow/skill-conventions.md` § *Cold citations* names — which is why a reference names
it root-relative rather than as a `./` citation.

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

Contract: `references/scripts/commit-scan.md`.

**Why branch existence goes through `git for-each-ref`.** An exact refname comparison over its output
is used rather than `rev-parse --verify --quiet`, which reports a missing branch and a broken repository
with the same silent non-zero status; the pattern is prefix-matching, so `refs/heads/feat` would
otherwise be satisfied by `refs/heads/feat/x`.

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
separately in each place is exactly the drift both checks exist to catch. The run-time script
contracts under `references/scripts/` are inside it, as every file under `references/` is.
`SCRIPTS.md`, `tests/`, and `scripts/` sit outside it: this file is maintainer material no run loads,
and a contract stated in prose and again in a source is the sanctioned copy's mirror note to keep
honest, not a duplicate to collapse.

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

Contract: `references/scripts/health-check.md`.

**Why `oversized-result` imports `task-state.ts` and not the other way round.** This script's CLI
runs at module scope, so importing *it* would run a whole walk as a side effect, while `task-state.ts`
guards its CLI behind a direct-run check and can be imported for its pure `resultSize`. The two budget
measures beside it, `oversized-task` and `oversized-record`, have no compaction plan or second script
to agree with, so their measures are fixed here and by the fixtures rather than by a shared function.

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

These markdown-reading constants and helpers are mirrored in `scripts/task-state.ts`, the fence and
status halves again in `scripts/task-move.ts`, the fence, heading, step-title, and checkbox halves
again in `scripts/commit-scan.ts`, and the fence and heading halves again in
`scripts/sweep-scope.ts`. Those readers must agree with this one: this walk's dead-anchor check
against task-state's `anchorResolves`, its terminal read against task-move's archive gate, its step
reading against commit-scan's path sets, which nominate steps this walk's plan reading also
enumerates, and its section bounds against sweep-scope's, which decide what a sweep may fetch from.
**Change a copy here and change every mirror in the same edit.**

## `scripts/lifecycle-constants.ts`

The task constants `scripts/health-check.ts`, `scripts/task-move.ts`, and `scripts/task-state.ts`
read: the plan status vocabulary, the terminal set, the compaction size trigger, the folder and
record size budgets, and the recognition set that identifies a task folder by its contents.

Each value is owned in prose by a reference file; this module is their one sanctioned
machine-readable copy (AGENTS.md § *Consumer lists*) and changes in the same edit as the prose. Left
stale, a renamed status reads as `unknown` here, and the lifecycle checks that skip `unknown` —
stale, done-unarchived, started-in-backlog — go quiet on every task holding it.

- **`PLAN_VOCAB`** — `references/workflow/task-lifecycle.md` § *Status values* — a closed
  vocabulary; a value outside it is `unknown` rather than a guess, so a typo never reads as a
  lifecycle state.
- **`UNSTARTED_STATUS`** — the backlog entry gate (`references/scripts/task-move.md`) and the
  archive checks. Exported so a rename lands here rather than in each consumer's own literal.
- **`TERMINAL_STATUSES`** — `references/workflow/status-transitions.md` § *Terminal vs. live states*.
- **`LIVE_STATUSES`** — the non-terminal complement, derived rather than spelled out so the two
  cannot drift apart.
- **`RESULT_MAX_KB`** — `references/workflow/reconciliation-compaction.md`
  § *Compaction (size trigger)*, which `maintain` reads at run time and passes as `--result-max-kb`;
  this copy only keeps a bare health-check run honest.
- **`TASK_MAX_KB`** — `references/workflow/task-layout.md` § *One task, one flat folder*: the folder
  budget `oversized-task` measures, over the folder's `.md` bytes excluding `ticket.md`.
- **`RECORD_MAX_KB`** — the same section: the per-record budget `oversized-record` measures, over one
  `## Step` or `## Full Run` section of `result.md`.
- **`ROLE_FILES`, `ROLE_SUFFIXES`, `holdsRoleFile`** — `references/workflow/task-layout.md`
  § *One task, one flat folder*: a folder is a task folder when it holds one of these files. The
  suffix forms are legacy names the format sweep renames, kept because only the kit's own canonical
  root is ever swept. Every script that decides "is this a task folder?" reads these, so a folder one
  accepted and another did not cannot happen.

`holdsRoleFile` takes file names rather than a path, so a caller that has already read the directory
does not read it twice; a suffix match excludes the bare suffix itself, which is a dotfile rather
than a role file.

## `scripts/pr-comments.ts`

Contract: `references/scripts/pr-comments.md`.

**Why a URL's owner and repo go through `-f`.** `-F` is the only form that expands `{owner}`/`{repo}`
from the current directory's repository, and it also converts an all-digit value to a JSON number,
which the `String!` variables reject — so a literal owner or repo read off a URL goes through `-f`
instead.

**Why the `gh` reply is read with a 64 MiB buffer.** `execFileSync`'s 1 MiB default aborts the whole
fetch with `ENOBUFS` on a large review rather than returning a short page, which would turn a
fetchable pull request into no report at all.

**Why the entry check goes through `realpath`.** Only a direct run may reach the network: the pure
layer above is what the tests import, and fetching at module scope would put a live `gh` call behind
every import. Node leaves `process.argv[1]` as it was typed while `import.meta.url` is already
resolved, so a run through a symlinked path would compare unequal and read as an import — and the
script would then do nothing at all.

## `scripts/session-triage.ts`

Contract: `references/scripts/session-triage.md`.

**Why `sessions` is tallied in the driving loop.** The bucket is filled once per file there rather
than derived from what triage returns: a readable, sniffable transcript that scores nothing never
reaches the ranked results, and an unreadable or unsniffable one is never classified at all, so a
tally built downstream of classification would silently describe less than the window it names.

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

Contract: `references/scripts/sweep-scope.md`.

The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

## `scripts/task-move.ts`

Contract: `references/scripts/task-move.md`.

The fence and status halves mirror `scripts/health-check.ts`; see the mirror note in that section.

## `scripts/task-state.ts`

Contract: `references/scripts/task-state.md`.

The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

**Why the entry check goes through `realpath`.** Only a direct run reads the filesystem: the pure
layer above is what the tests import, and reading at module scope would put a folder walk behind
every import. The resolution itself is the same quirk `scripts/pr-comments.ts` documents — see that
section.

## `scripts/worktree-merge.ts`

Contract: `references/scripts/worktree-merge.md`.

**Why a path is cleared before it is copied onto.** `copyFileSync` onto a symlink writes through it
into the link's target. A symlink is cleared with `unlinkSync` rather than `rmSync`, which refuses a
link whose target is a directory unless told to recurse — and recursing through one removes the link
alone in any case, so unlinking outright keeps neither shape depending on that behavior.

An option a command does not take is bad usage rather than an ignored flag: `discard`'s empty option
list is what keeps a mistyped `remove` from becoming an ungated delete. The dispatch keeps a matching
guard for a command the parser has no entry for, so a subcommand added to one and forgotten in the
other is named rather than surfacing as a `TypeError`.

One `check-ignore` call carries the whole walk. The paths go in over `--stdin` because a few hundred
of them would overflow argv, NUL-delimited both ways (`-z`) so a newline in a filename decides
nothing, and the reply is read back with an unbounded `maxBuffer`: a single large ignored tree — a
pnpm store, a framework cache — runs past Node's 1 MiB default and would fail the walk on exactly the
trees the filter exists to drop. Exit status 1 is the success that matched nothing; only a
`not a git repository` on stderr reports a missing checkout, and any other failure refuses the run
rather than reporting the tree unfiltered. The walk collects its leaves first and hashes them after
the filter has run, so an ignored cache is dropped rather than hashed and then discarded.

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
  pending step with its `nextPendingStepBody`, checkpoint outcomes, result-anchor resolution, goal
  coverage, the `currentState` block and where it ends — the
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
- **`templates.test.ts`** — `references/templates/`: a task folder built from the five templates
  with their placeholders filled parses under `scripts/task-state.ts` with a vocabulary plan status,
  closed goal coverage, and a `currentState` block, and raises no finding under
  `scripts/health-check.ts`. A template that drifts out of the shape those two scripts read is
  otherwise caught only by a real task going wrong.
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
