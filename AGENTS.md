# Maintaining agents-kit

This guide is for agents maintaining this **agents-kit source repository**. It does not govern work in a consumer project that has installed the kit.

Start by reading and applying [CORE_RULES.md](./CORE_RULES.md). It is the canonical shared-rules source; follow task-specific sources only after it.

## Ownership

- `skills/<name>/SKILL.md` owns that skill's protocol and its direct reference citations.
- `references/workflow/` owns cross-skill workflow methodology; `references/workflow/domain-packs.md` owns the domain-pack interface.
- `references/<domain>/` owns domain-specific guidance.
- `references/templates/` owns the copy-ready shapes of the five task-folder files; the workflow reference that contracts each file owns its rules.
- `setup.ts` owns installation and distribution behavior; § *Source contracts* → *`setup.ts`* owns its CLI form, its stdout and exit contract, and its design rationale.
- `scripts/` owns the repository's zero-dependency Node helpers. For a helper a skill runs at run time, `references/scripts/<name>.md` owns its CLI form and stdout contract — installed and loaded with the other references, so the duplicate scan covers it — and § *Source contracts* → *`scripts/<name>.ts`* owns its design rationale and mirror notes; for a helper only a maintainer runs, that subsection owns all three. The sources themselves carry no comments, so a contract that changes is changed at its owner in the same edit.
- `tests/` owns repository verification; § *Source contracts* → *`tests/`* says how to run the suites and what their cases depend on, and § *Change routing* maps each script to its suite. One data file lives there beside the suites: `tests/dup-allow.json`, the register of prose mirrors this kit keeps on purpose, each entry owning the reason its copy stands.
- `.agents/tasks/` owns task artifacts and their active work context.

## The `.ts` sources are unchecked by design

`setup.ts`, `scripts/`, and `tests/` run directly on Node under type stripping — no build step, no bundler, no typechecker. **Node 23.6 or newer is the floor every `.ts` source here assumes, `setup.ts` included**, and this section is where that floor is stated: § *Shared conventions* below points here rather than repeating a number that drifts silently, so changing the floor is a one-line change made here. Type stripping runs unflagged from 22.18 as well, so the 22.x line would in fact run this tree; carrying a single floor rather than a two-branch one is a support choice, not a limit of the code. Below either threshold the failure is a parse error on a type annotation, not a version message — under `node --test` too, which matches the globbed `.ts` suites and then fails to load them. Their annotations are erased at run time and nothing validates them, so the typecheck, lint, and build commands of the engineering pack's integrated-health recipe (`references/engineering/rules.md` § *Before presenting changes*) have no target in this repository; its test command does, and `node --test "tests/*.test.ts"` is the whole verification surface. This repository exposes no class that can narrow — no linter, no formatter, no graph-aware runner — so `references/engineering/boundary-scope.md` skips the manifest here and every class falls to its whole-tree case: no delta, that one command over the entire tree at every boundary. Adding a checker would put a `package.json`, a lockfile, and `node_modules` in a tree that otherwise carries only Markdown and the `.ts` sources themselves; that cost is why it is declined, and it is what to weigh if the decision is revisited.

## Source contracts

Run-time contracts live in `references/scripts/<name>.md` — the CLI form and stdout contract of every helper a skill runs, installed and loaded with the other references; everything maintainer-only lives here: the shared conventions, `setup.ts`'s contract and rationale, each kept `scripts/` source's design rationale and mirror notes, the contracts of the helpers only a maintainer runs, and what the `tests/` suites cover. The sources themselves carry no comments, so those two places are where a caller reads what a script decides before assembling a command from the flags a skill happens to name. No run loads this file — `setup.ts` installs `CORE_RULES.md` in its place, and an installed skill's `./AGENTS.md` resolves there — so a reference names a section here as plain root-relative text, never as a `./` link that would resolve to the wrong file.

### Shared conventions

**Zero dependencies, run directly on Node under type stripping**, at the floor § *The `.ts` sources are unchecked by design* states.

**The 0/1/2 exit convention** is shared by `scripts/task-move.ts`, `scripts/task-state.ts`, `scripts/pr-comments.ts`, `scripts/dup-check.ts`, and `scripts/worktree-merge.ts`: 0 did the job, 1 is an outcome the script decided, 2 is a run that never got that far. The reporting scripts beside them — `health-check.ts` and `session-triage.ts` — always exit 0 instead, so a partly unreadable corpus still parses.

**stdout is asynchronous on a pipe**, so a script that emits a JSON report writes it and lets the module end rather than calling `process.exit` after the write, which would discard whatever the pipe buffer could not take — truncating a report above 64 KB. A reader that closes early then raises EPIPE on a stream nothing awaits, and swallowing that is what keeps the promised exit status.

**No script calls `process.exit` to set a status**, and every one of them writes the reason for a non-zero status before it assigns `process.exitCode`. An inline exit would set the status first and discard whatever the stream had not yet flushed, so a refused run would report a code with nothing saying why. `task-move.ts`, `task-state.ts`, `pr-comments.ts`, and `worktree-merge.ts` reach that by throwing — an `Exit` carrying its code in the first three, `Refused`/`Unrunnable` in the last — which one handler at the module's end catches, so every refusal leaves through one place. `dup-check.ts` splits the two: a `Refused` thrown from anywhere in the scan reaches one handler for the status 2, while the status 1 is assigned after the report is written, since a finding is the report rather than a refusal.

### `setup.ts`

Installs the kit into the native agent homes (`~/.claude`, `~/.codex`): skills, `references/`, `CORE_RULES.md`, and each host's native agent definitions, each written beside an ownership marker so a later run reclaims what the kit installed and leaves everything else alone.

```
node setup.ts
```

**Contract.** stdout names each home and every item installed or skipped under it; a refused home is named on stderr. Exit status: 0 = every home installed, 1 = at least one home was skipped.

**Why the staging dirs.** Skills and `references/` are each built under a hidden staging dir — `.agents-kit-staging.*` inside `skills/`, `.agents-kit-references.staging.*` in the home — with the marker inside, then atomically renamed into place, so the visible path is never present-but-unmarked; an interrupted run leaves only a staging dir, swept under both prefixes by the next run's sweep of leftovers. `CORE_RULES.md` and each native agent definition take no staging dir and no rename: `touchMarker` then `copyFileSync` straight at the visible path, so a run interrupted mid-copy leaves a partial file there.

**Why a home is refused.** Kit skills resolve `./AGENTS.md` and `./references` via symlinks to install-root siblings. With user-owned copies in place every installed skill would resolve into non-kit content, so the whole home is refused rather than installed broken. A symlinked `skills/` is reclaimed when it is kit-owned — this repo, a dangling leftover, or a since-moved clone — and refused otherwise: installing through a user's symlink would dangle every per-skill link.

**Why the copy modes differ.** Skills are copied with `verbatimSymlinks`, which is what keeps their per-skill links relative: without it `cpSync` rewrites each target as an absolute path into the checkout, which resolves back into the repo instead of the home it was installed to. `references/` is symlink-free, so it is copied with `dereference`. `references/` and `CORE_RULES.md` are not removed before the skills loop — every installed skill symlinks into them — and each is replaced at its own site, the removal happening only once its replacement is staged and ready to rename.

**Why the reclaim sweep skips a symlinked entry.** `isDirectory` stats through a link, so a symlinked entry inside `skills/` reaches the sweep like a real directory. The skip is what keeps it there: without it the marker probe follows the link into its target, finds an `.agents-kit` there, and removes the entry — a user's link, for a directory the kit never installed. Dropping the guard makes a linked entry whose target holds a marker disappear from every home, which is what `tests/setup-install.test.ts` pins.

**Why reclaiming a kit-owned `skills/` link uses `unlinkSync`.** Only the link goes away there, and `rmSync` refuses a link whose target is a directory (`ERR_FS_EISDIR`) — the shape every reclaimable link but the dangling one has. Kit ownership is read off the target: an absolute path whose basename is `skills` and whose parent holds `setup.ts`, `CORE_RULES.md`, and `references/`, which is what recognizes a since-moved clone as the kit's own.

**Why each replacement removes before it renames.** `renameSync` onto a non-empty directory fails rather than replacing it, so removing `references/` is what lets the rename land at all, and the window in which no `references/` exists is one rename wide. `CORE_RULES.md` takes no such removal: `copyFileSync` overwrites a regular file in place, and the conflict gate above has already refused the home if an unmarked copy were sitting there. Its marker is written first either way, so the payload is never present-but-unmarked.

**Why the agent sweep is marker-driven.** Ownership rides on the marker alone, so the sweep removes each native agent definition together with its marker: an install interrupted between the two is reclaimed on the next run, while an unmarked same-named file stays the user's and is skipped by the copy loop after it.

### `scripts/commit-scan.ts`

Contract: `references/scripts/commit-scan.md`.

**Why branch existence goes through `git for-each-ref`.** An exact refname comparison over its output is used rather than `rev-parse --verify --quiet`, which reports a missing branch and a broken repository with the same silent non-zero status; the pattern is prefix-matching, so `refs/heads/feat` would otherwise be satisfied by `refs/heads/feat/x`.

**Why the commit log carries a NUL record separator.** `--pretty=format:%x00%h %ad %s` prefixes each commit header, so the reader splits records on a byte no path can hold instead of guessing which lines under `--name-only` are headers. The log runs with `-c core.quotepath=false`, since git's default C-quotes non-ASCII path bytes under `--name-only` and a quoted path would never name-match a step's, and closes with `--` so the range is never read as a path. The command is otherwise the one `references/workflow/reconciliation-commits.md` names.

The checkout discrimination — separating "not a git repository", which is a reportable `no-checkout`, from any other `git` failure, which is a refused run — is mirrored from `scripts/worktree-merge.ts`'s `checkoutHolding`. **Change either copy and change the other in the same edit.** The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

### `scripts/corpus.ts`

The one definition of the kit's Markdown corpus, imported by `scripts/dup-check.ts`. It exposes no CLI — `corpusFiles(root, handlers)` returns the corpus as sorted absolute paths, and the caller supplies its own policy for what the walk could not read.

**The corpus is the prose a reader loads:** every `.md` under `references/` (recursively), every `skills/*/SKILL.md`, `CORE_RULES.md`, and `AGENTS.md`. **This paragraph is that set's only statement** — the duplicate scan reads it, so a corpus described separately elsewhere is exactly the drift the check exists to catch. The run-time script contracts under `references/scripts/` are inside it, as every file under `references/` is. `tests/` and `scripts/` sit outside it: a contract stated in prose and again in a source is the sanctioned copy's mirror note to keep honest, not a duplicate to collapse.

**Every entry is `lstat`ed and a symlink is never followed**, but what a symlink *means* is the caller's. The walk reports each through `onSymlink`, whatever position it held: a link met while enumerating, under `references/` or as a `skills/<entry>`, one entry of many; a link standing where a named corpus member belongs — a `skills/*/SKILL.md`, `CORE_RULES.md`, or `AGENTS.md` — or where a corpus root does, `references/` and `skills/` each being `lstat`ed before they are listed, because `readdirSync` resolves through a link and would otherwise walk whatever the root points at, reading prose from outside the kit root that no per-entry check ever sees. `scripts/dup-check.ts` skips every one of them and names it on stderr.

A directory the walk cannot list reaches `onUnreadable` with its error code, except an absent `skills/`, which yields no entries rather than an error: a kit root legitimately carries none.

A root rule file that is absent, or present but not a regular file, reaches `onMissing` with the reason — nothing else supplies that member, so `scripts/dup-check.ts` scans what exists. A skill directory holding no `SKILL.md` is not a skill and reports nothing.

### `scripts/dup-check.ts`

Reports the prose this kit says twice: every normalized sentence of at least **12 words** occurring in two or more distinct files of the corpus, with the `{file, line}` of each occurrence. A rule restated away from its home is the drift § *Change routing* exists to prevent — the home is edited, the restatement is not, the two disagree, and nothing fails — so this is the mechanical half of keeping one fact with one owner and every other file citing it.

```
node scripts/dup-check.ts [--allow FILE] <kit-root>
```

**The corpus it reads** is the one § *`scripts/corpus.ts`* defines, whose module this check imports.

**Every entry is `lstat`ed and a symlink is skipped**, named on stderr rather than followed. Which positions the walk can meet a link at is § *`scripts/corpus.ts`*'s; this scan reads both kinds the same way, since a link that resolved back into the corpus would report the prose behind it as a duplicate of itself.

**Cross-file only.** A group qualifies on its count of *distinct* files, so a sentence one file repeats — a section restating its own opening — is not a finding. Once a group qualifies every occurrence is listed, the within-file repeats included, because collapsing a duplicate means reading all of them.

**What the scan does not read.** YAML frontmatter, fenced code blocks, ATX heading lines, every `## Core Rules` section of a `SKILL.md`, and any paragraph carrying the phrase `a sanctioned copy per`. The first three are not prose a reader takes a rule from; the `## Core Rules` block is the deliberate per-skill boilerplate the domain-pack interface requires of every skill, so flagging it would bury the report under one group per skill; and a sanctioned copy is a duplicate the kit has already decided to keep, recorded at its home with a mirror note (§ *Consumer lists*), so it is excluded by that phrase rather than re-argued in an allow-file. The Core Rules skip ends at the next heading of level 1 or 2, so a `###` inside the section stays skipped and the section after it does not.

**Paragraphs are joined before sentences are split.** Files here wrap inconsistently — some near 100 columns, some not at all — so a sentence split across two lines has to read as one sentence or the same text in a differently wrapped file would never match. A paragraph runs until a blank line, a heading, a fence, a list item, a table row, or the opening of a blockquote; a blockquote's `>` prefix is dropped from each line before the join, so a quoted rule reads as the same sentence as its plain twin, and a fence opened inside a blockquote closes with the quote, so an unterminated quoted fence cannot swallow the rest of the file; its lines are joined with single spaces; and each sentence is reported at **the line it starts on**. Sentences end at `.`, `!`, `?`, or `;` followed by whitespace or end of paragraph, which splits an abbreviation like "e.g." too — identically in every file, so a duplicate is still found, in two shorter groups rather than one.

**Markup is blanked before the split and stripped after it.** The split runs over a shadow copy of the paragraph in which every markup character is replaced by a space *of the same width*, so offsets still name the original text and a sentence still reports its own line. Blanking rather than deleting is what finds the boundary in `…keep one inline.** No consumer states…`: the period abuts a bold close instead of whitespace, so a split that read the raw text would swallow the following sentence whole and it would never match the same sentence written after a plain full stop. Each sentence is then taken from the original text and normalized, so what the report prints and the allow-file matches is the stripped form, not the blanked one.

**Normalization is what makes two wordings one sentence.** HTML comments and a leading list marker — with the task checkbox (`[ ]` or `[x]`) that may follow it — are dropped, links and images collapse to their text, backtick spans, emphasis markers, and table pipes are stripped, the result is lowercased and its whitespace collapsed. A word is a token holding a letter or a digit, so an em dash or a stray marker never pads a fragment up to the 12-word floor. That floor is what separates a restated rule from prose that happens to share a phrase; below it the report is noise.

**The allow-file names the mirrors the kit keeps on purpose.** It is `<kit-root>/tests/dup-allow.json` unless `--allow` names another, and it holds an array of `{sentence, reason, files?}` — `sentence` in the normalized form the report prints, though it is normalized again on read so a copied-out sentence with its original casing still matches; `files`, when present, the kit-relative paths the mirror is expected in. An entry naming its files suppresses a group only when the group's distinct files are exactly that set: a third copy, or one that moved to a file the entry never named, is reported as a group, because what the entry excused was a particular pair of homes and not the sentence wherever it lands. An entry without `files` suppresses the sentence wherever it occurs. A missing file is an empty allow-list, not a refusal: the check is useful before anyone has decided a mirror is deliberate. An entry carrying no `reason` refuses the run, because a reasonless entry is how a collapse that was never done becomes permanent, and a `files` that is not a non-empty array of paths refuses it on the same terms.

**A listed sentence that no longer occurs twice is `stale`, and stale fails.** An allow entry outlives the duplicate it excused — the mirror is collapsed, the sentence is reworded — and a silently ignored entry would then go on excusing whatever text later drifted into its shape. Reporting it as a finding is what gets it deleted in the same change that collapsed the copy.

**Contract.** stdout is exactly one JSON object, `{"root":<absolute kit root>,"files":N,"groups":[…],"allowed":N,"stale":[…]}`. Each group is `{sentence,occurrences:[{file,line}]}` with `file` relative to the kit root, occurrences in file then line order, and groups ordered by occurrence count descending then sentence. `allowed` counts the allow-file entries that suppressed a group, and `stale` carries every entry whose sentence no longer occurs in two files exactly as it was written in the allow-file — original casing, markup, reason whitespace, and `files` when the entry carries it — so a reader finds it there by exact match. An entry whose sentence still repeats, but in files other than the ones it names, is in neither count: its group is reported. Skipped symlinks and the failure summary go to stderr.

**Exit status.** 0 = no group survived allow-list filtering and no entry was stale. 1 = at least one of the two, the outcome the check decided. 2 = a run that never got that far: no kit root or one that is not a directory, an unknown option, a directory that could not be listed, a corpus file that could not be read, or an allow-file that exists but is unreadable, unparseable, not an array of entries carrying both fields, or carrying a `files` that is not a non-empty array of paths. An unreadable corpus file refuses rather than warning, unlike the reporting scripts beside it: a check that skipped a file it could not read would report a clean corpus it never finished reading.

### `scripts/health-check.ts`

Contract: `references/scripts/health-check.md`.

**Why `oversized-result` imports `task-state.ts` and not the other way round.** This script's CLI runs at module scope, so importing *it* would run a whole walk as a side effect, while `task-state.ts` guards its CLI behind a direct-run check and can be imported for its pure `resultSize`. The two budget measures beside it, `oversized-task` and `oversized-record`, have no compaction plan or second script to agree with, so their measures are fixed here and by the fixtures rather than by a shared function.

**Markdown reading.** Every scan over a task file skips fenced content, because a heading, a bullet, or a status line inside a fence is illustrative markdown rather than the file's own. Closing a fence takes the opener's marker at its own length or longer, no further indented than the opener, and nothing after it but whitespace — a boolean flag would invert on a nested opener and hand back what it skipped. The indent test is relative to the opener rather than CommonMark's flat 0–3 columns, because a fence nested in a list item is legitimately indented past that. A status header is bounded to the file's header block (`references/workflow/doc-task-files.md`), so the scan stops at the first `##`-or-deeper heading. Anchors follow GitHub's rule — lowercase, drop every character that is not a letter, digit, hyphen, underscore, or space, then map each space to a hyphen — with a repeated heading taking the `-1`, `-2`, … suffix and allocation advancing past every slug already assigned. A step link pointing at a tombstone bullet under a `## Compacted` stub (`references/workflow/reconciliation-compaction.md`) is documented state, not a dead anchor.

These markdown-reading constants and helpers are mirrored in `scripts/task-state.ts`, the fence and status halves again in `scripts/task-move.ts`, the fence, heading, step-title, and checkbox halves again in `scripts/commit-scan.ts`, and the fence and heading halves again in `scripts/sweep-scope.ts`. Those readers must agree with this one: this walk's dead-anchor check against task-state's `anchorResolves`, its terminal read against task-move's archive gate, its step reading against commit-scan's path sets, which nominate steps this walk's plan reading also enumerates, and its section bounds against sweep-scope's, which decide what a sweep may fetch from. **Change a copy here and change every mirror in the same edit.**

### `scripts/lifecycle-constants.ts`

The task constants `scripts/health-check.ts`, `scripts/task-move.ts`, and `scripts/task-state.ts` read — the plan status vocabulary, the terminal set, the compaction size trigger, the folder and record size budgets, and the recognition set that identifies a task folder by its contents — each owned in prose by the reference § *Consumer lists* names for it, this module being their one sanctioned machine-readable copy, changed in the same edit as the prose. Left stale, a renamed status reads as `unknown` here, and the lifecycle checks that skip `unknown` — stale, done-unarchived, started-in-backlog — go quiet on every task holding it.

`holdsRoleFile` takes file names rather than a path, so a caller that has already read the directory does not read it twice; a suffix match excludes the bare suffix itself, which is a dotfile rather than a role file.

### `scripts/pr-comments.ts`

Contract: `references/scripts/pr-comments.md`.

**Why a URL's owner and repo go through `-f`.** `-F` is the only form that expands `{owner}`/`{repo}` from the current directory's repository, and it also converts an all-digit value to a JSON number, which the `String!` variables reject — so a literal owner or repo read off a URL goes through `-f` instead.

**Why the `gh` reply is read with a 64 MiB buffer.** `execFileSync`'s 1 MiB default aborts the whole fetch with `ENOBUFS` on a large review rather than returning a short page, which would turn a fetchable pull request into no report at all.

**Why the entry check goes through `realpath`.** Only a direct run may reach the network: the pure layer above is what the tests import, and fetching at module scope would put a live `gh` call behind every import. Node leaves `process.argv[1]` as it was typed while `import.meta.url` is already resolved, so a run through a symlinked path would compare unequal and read as an import — and the script would then do nothing at all.

### `scripts/session-triage.ts`

Contract: `references/scripts/session-triage.md`.

**Why `sessions` is tallied in the driving loop.** The bucket is filled once per file there rather than derived from what triage returns: a readable, sniffable transcript that scores nothing never reaches the ranked results, and an unreadable or unsniffable one is never classified at all, so a tally built downstream of classification would silently describe less than the window it names.

**Argument handling.** A separate flag value is peeked and consumed only once it has the shape its flag wants: `argv[++i]` would take the next argument whatever it is, and a swallowed session directory leaves the walk short with nothing in the JSON to say so. `--top` must be a whole integer — `parseInt` would pass `2junk` and `1.5` as 2 and 1 with nothing said — as `health-check.ts` also requires. `new Date(y, m, d)` normalizes an out-of-range component instead of failing, so a well-shaped but nonexistent date (`2026-02-30` → March 2) would silently shift the window; the round-trip through `isoDate` rejects it, and rejects a NaN date with it. A window that never parsed leaves every directory unread and is recorded as unread rather than left to the stderr warning alone: the payload would otherwise be byte-identical to a window walked in full and found clean.

A record that parses to a bare `null` is valid JSON, so every non-object goes to the unknown tally rather than being dereferenced. A file whose mtime could not be read counts as in-window rather than assumed out.

### `scripts/sweep-scope.ts`

Contract: `references/scripts/sweep-scope.md`.

The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

### `scripts/task-move.ts`

Contract: `references/scripts/task-move.md`.

The fence and status halves mirror `scripts/health-check.ts`; see the mirror note in that section.

### `scripts/task-state.ts`

Contract: `references/scripts/task-state.md`.

The markdown-reading layer mirrors `scripts/health-check.ts`; see the mirror note in that section.

**Why the entry check goes through `realpath`.** Only a direct run reads the filesystem: the pure layer above is what the tests import, and reading at module scope would put a folder walk behind every import. The resolution itself is the same quirk `scripts/pr-comments.ts` documents — see that section.

### `scripts/worktree-merge.ts`

Contract: `references/scripts/worktree-merge.md`.

**Why a path is cleared before it is copied onto.** `copyFileSync` onto a symlink writes through it into the link's target. A symlink is cleared with `unlinkSync` rather than `rmSync`, which refuses a link whose target is a directory unless told to recurse — and recursing through one removes the link alone in any case, so unlinking outright keeps neither shape depending on that behavior.

An option a command does not take is bad usage rather than an ignored flag: `discard`'s empty option list is what keeps a mistyped `remove` from becoming an ungated delete. The dispatch keeps a matching guard for a command the parser has no entry for, so a subcommand added to one and forgotten in the other is named rather than surfacing as a `TypeError`.

One `check-ignore` call carries the whole walk. The paths go in over `--stdin` because a few hundred of them would overflow argv, NUL-delimited both ways (`-z`) so a newline in a filename decides nothing, and the reply is read back with an unbounded `maxBuffer`: a single large ignored tree — a pnpm store, a framework cache — runs past Node's 1 MiB default and would fail the walk on exactly the trees the filter exists to drop. Exit status 1 is the success that matched nothing; only a `not a git repository` on stderr reports a missing checkout, and any other failure refuses the run rather than reporting the tree unfiltered. The walk collects its leaves first and hashes them after the filter has run, so an ignored cache is dropped rather than hashed and then discarded.

The worktree a receipt names is stored and re-compared through `realpath`, so a receipt written under `/private/tmp` still matches a `remove` invoked as `/tmp`; a path that cannot be resolved keeps its merely-resolved form. Without that normalization the gate refuses on the macOS symlinked temp roots alone, which is the one place it would be noticed.

`checkoutHolding`'s discrimination — "not a git repository" read off stderr, every other `git` failure refused rather than swallowed — is mirrored in `scripts/commit-scan.ts`, where the same test separates a reportable `no-checkout` from a run that could not be carried out. **Change a copy here and change the mirror in the same edit.**

### `tests/`

Every suite is zero-dependency and runs under Node type stripping, like the sources it covers.

```
node --test tests/<name>.test.ts        # one suite
node --test "tests/*.test.ts"           # every suite — quoted, because the runner takes glob
                                        # patterns and resolves a bare directory as a module path
```

**The `pr-comments` suite never reaches the real CLI or the network.** Every case either feeds fixture pages to the pure layer, exercises an argument the script rejects before it fetches, or runs the script against a fake `gh` placed first on `PATH`. Keep it that way: a case that would need either belongs nowhere in that file.

**The `setup-install` suite pins a rule about `references/` that reaches past its own assertions.** `setup.ts` installs that tree with `dereference`, which materializes any symlink it finds, while `scripts/health-check.ts`'s `--installs` pass reports a one-sided link as drift. A symlink added under `references/` would therefore report as permanent, unfixable drift in every installed home — so nothing in that tree may become one.

**The `commit-scan` suite builds real checkouts.** Each case runs `git init` in a temp directory and commits into it, because the states under test — a branch that resolves, one that does not, a watermark outside the resolved ref's history — are properties of a repository rather than of text a fixture could hold. Every checkout sets `user.email`, `user.name`, and `commit.gpgsign` locally and stages with `git add -f`, so a contributor's global config, signing key, or ignore file cannot decide whether the suite passes. The task folder is never staged: it lives inside the checkout, as a project-local one does, and staying untracked keeps it out of the ranges the cases assert on.

**The `health-check` suite's fixture ages are load-bearing.** Four folders sit well past the 30-day default, and what keeps each one out of `stale` — or fails to — is the point: `done-unarchived` by the terminal-status exclusion, `unknown-status` by the vocabulary check that reads an out-of-vocabulary header as `unknown`, and `parked-todo` by the backlog exemption. `no-status-plan` is held out by nothing: the live-status guard fires only on a non-null value, so a plan carrying no parseable status falls through and is reported under the `no-status` label — the second of the two stale findings the suite counts. A regression in any of the three exclusions moves that count.

## Change routing

Before changing the kit, identify and inspect:

- the affected `SKILL.md` files and every reference they cite directly;
- shared-contract consumers when changing a workflow reference, domain-pack interface, core rule, or distribution behavior — identify them by reverse search over `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md`, never from a derivable list kept in a file header (§ *Consumer lists*);
- the installer integration test (`tests/setup-install.test.ts`) when changing `setup.ts`, native agent definitions, or installed payload behavior — and `scripts/health-check.ts` in the same pass, whose `--installs` mode hardcodes `setup.ts`'s ownership markers, payload categories, and per-host agent extensions;
- the harness under `tests/` covering a script you changed — `node --test tests/setup-install.test.ts` for `setup.ts`, `node --test tests/health-check.test.ts` for `scripts/health-check.ts` and its `scripts/lifecycle-constants.ts` import, `node --test tests/task-move.test.ts` for `scripts/task-move.ts`, `node --test tests/task-state.test.ts` for `scripts/task-state.ts`, `node --test tests/commit-scan.test.ts` for `scripts/commit-scan.ts`, and `node --test tests/sweep-scope.test.ts` for `scripts/sweep-scope.ts`, which share that import, `node --test tests/session-triage.test.ts` for `scripts/session-triage.ts`, `node --test tests/pr-comments.test.ts` for `scripts/pr-comments.ts`, `node --test tests/dup-check.test.ts` for `scripts/dup-check.ts`, `node --test tests/worktree-merge.test.ts` for `scripts/worktree-merge.ts`, `node --test tests/templates.test.ts` for `references/templates/` and for the two scripts that suite drives, `node --test tests/invocation-gate.test.ts` when you flip a skill's invocation gate — it is the only reader of all three surfaces at once: the `SKILL.md` frontmatter flag, the skill's `agents/openai.yaml` policy, and the roster in `references/workflow/skill-conventions.md` — and `scripts/corpus.ts` is imported by `scripts/dup-check.ts`, so a change to it runs that suite — and `scripts/task-state.ts` is itself imported by `scripts/health-check.ts` (`resultSize`) and `scripts/sweep-scope.ts` (`taskState`, `compactionSections`), so a change to it runs those two suites beside its own;
- the contract's owner when changing a CLI form, a stdout or exit contract, or the reasoning a caller depends on — `references/scripts/<name>.md` for a helper a skill runs, § *Source contracts* for `setup.ts`, for a maintainer-only helper, and for what a `tests/` suite depends on — and that section's subsection for the design rationale behind any helper; the `.ts` sources carry no comments, so those two places are the only places those live, and the skills that run a script cite its contract file by path;
- the duplicate scan (`node scripts/dup-check.ts .`) after editing prose in any file of the corpus — which includes this file and `CORE_RULES.md`, not only `references/` and `skills/*/SKILL.md`, so a rule restated between a root file and its home is caught by the edit that makes it. It fails on a sentence two corpus files share, which is what a rule restated away from its owner looks like ([references/workflow/one-home.md](./references/workflow/one-home.md) states the rule; § *`scripts/corpus.ts`* defines the set, and § *`scripts/dup-check.ts`* the floor a sentence has to clear, the allow-file that records a copy kept on purpose, and what refuses the run). Collapse the loser to a citation, or record the copy it excuses in `tests/dup-allow.json` on that section's terms;
- relevant Git history, to preserve the reason behind an existing contract.

That list is what a change does after it earns its place. A kit change cites the friction that motivates it: a finding in `~/.local/state/agents-kit/session-findings-*.md`, where `maintain` records what actually misbehaved in a session, or a consumer-project task folder where the friction was hit doing real work. A failing test is the one exemption — the failure is the citation. A change with neither is a candidate to defer, not a candidate to write: the kit grows one reasonable-looking addition at a time, and nothing measures that growth — the duplicate scan catches a rule restated away from its home, never prose that merely lacks a reason to exist, so the citation is the one brake on it. A change that adds prose to the corpus is the moment to spend that citation, not to skip it.

Keep each change with its authoritative owner; update dependent consumers only when the contract they consume changes.

## Consumer lists

A contract file's header often enumerates who consumes it. Most such enumerations duplicate what search derives; a few carry information search cannot recover. One test separates them.

**Membership test: grep reconstructs the full membership.** Run the reverse search over `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md`. When grep reconstructs the full membership, the list is derivable. When any member consumes the contract without citing it, or membership carries classification rationale beyond the fact of citing, the list is semantic.

- **Derivable citation lists are not maintained.** A "Cited by …" enumeration the reverse search reproduces does not belong in a file header: it goes stale silently — nothing fails when a new consumer forgets to add itself — and it duplicates the search that would have found the truth. Remove it, and identify consumers by running the search.
- **Semantic registries are maintained**, and each states in place why it can't be derived — which member consumes the contract without citing it, or what authored rationale the entries carry beyond membership.
- **Sanctioned copies carry an explicit mirror note.** A deliberate self-contained copy of contract content says it is a copy and names the mirror obligation, as `references/engineering/code-style.md:14` does for the executor adapters: "When this section changes, mirror the change into both."

Derivable — these enumerations were removed and are not re-added; find these consumers by reverse search:

- `references/workflow/task-layout.md:3` — the "Cited by …" sentence. It was already stale, omitting `review-docs`: the failure mode in miniature.
- `references/workflow/ticket-format.md:3` — the "Cited by …" sentence.
- `references/workflow/decomposition.md:3` — "Cited by the `decompose-task` skill, which runs the method end to end." The neighboring sentence splitting when/where against how across `plan-task`, `task-siblings.md`, and that file is an ownership boundary, not a citation list; it stays.
- `references/workflow/agent-fanout.md:3` — the citer enumeration (the review skills' `-x`, the triage-verify composites, `maintain`). Only the header enumeration is derivable; the write-mode registry formerly in this file is semantic and now lives in `references/workflow/executor-routing.md`, beside `executor-contract.md`'s § *Bindings* entry below.
- `references/workflow/verify-pipeline.md:3` — no citer enumeration, by this test rather than by removal: every composite that runs the pipeline cites the file by path, so the reverse search reconstructs the membership in full. The header states what the file owns and what each member's own file keeps instead.
- `references/workflow/task-store.md` § *Resolving `<kit-root>`* — no citer enumeration, same test: every skill that runs a `scripts/` helper cites the section by path at its invocation, so the reverse search reconstructs the membership. The section states the rule and what an absent kit root means; whether the skill then stops or falls back is its own call and each states it in place.
- `references/engineering/rules.md:3` — the loader enumeration, each named skill's `SKILL.md` citing the overlay (confirmed by grep). The `commit` exception is semantic and stays: `commit` cites the file only to state that it does *not* load it, so a reverse search would misread that citation as membership — the exception can't be re-derived from the citation graph.
- `references/documentation/rules.md:3` — the pack-contributed loader enumeration, each named skill's `SKILL.md` citing the overlay (confirmed by grep). Unlike the engineering entry, nothing semantic accompanies it — the pack has no `commit`-style exception.
- `references/engineering/review.md` § *Findings output shape* — the citer enumeration, which had already gone stale before the edit that removed it: it named both diff-review skills of the time while `references/workflow/reviewer-contract.md` § *The return* cites the section directly too. Searching the section name recovers both, and the composites that reach the shape through `review-pr` with it.

Semantic — maintained, each with the reason it can't be derived:

- `references/workflow/task-lifecycle.md:3` propagate list — membership is "reads or writes these status fields", and two members — `resume-task-reconcile` and `review-task-reconcile` — act on the fields without citing the file by name, so grep cannot reconstruct it.
- `references/workflow/context-schema.md:3` consumer registry — membership is "reads or writes these section names", and its members — `review-task`, `implement-task`, `resume-task`, `reconcile-task`, `reconciliation.md`'s annotation rows and its satellite `reconciliation-sweep.md`'s scope rows, and through those two the reconcile composites — consume the schema without citing the file, so grep cannot reconstruct it. The producer half (`refine-idea`, `plan-task`, `decompose-task`, each citing the file) is derivable and stays de-listed.
- `references/workflow/skill-conventions.md` § *Current members* — entries carry per-member classification rationale (why composite, why flag) that is authored rather than derivable, and that file's own registration step mandates recording each new member there.
- `references/workflow/skill-conventions.md` § *The invocation gate* member list — the gated skills are themselves derivable (`grep -rl "disable-model-invocation" skills/`), but what surrounds them is not: the deliberate non-members and the criterion that placed each skill on its side are authored rationale, and that section's registration line mandates an entry whenever a door opens or closes.
- `references/workflow/executor-contract.md` § *Bindings* — each binding *defines* per-consumer behavior (unit, packet, edit surface, fallback, merge order). Contract content, not a citation list.
- `references/workflow/reviewer-contract.md` § *Consumers* — defines which skills may launch or consume a delegated reviewer: the membership § *Launch packet*'s gate checks a packet against. Authorization contract content, the same class as `executor-contract.md` § *Bindings*, not a citation list.
- `references/workflow/reconciliation.md:5` direction membership — keys the per-skill mapping sections in the two direction files it names, `reconciliation-docs-to-reality.md` and `reconciliation-session-to-docs.md`. Contract structure, not a citation list.
- `references/workflow/execution-loop.md` intro ("Three skills run it: …") — keys the per-consumer sections of its satellite `references/workflow/execution-bindings.md`; same class as `reconciliation.md:5`.
- `references/workflow/domain-packs.md` § *The split* spine-skill enumeration — a design classification of which skills are methodology-only, not a record of who cites the file.
- `references/engineering/verification.md:3` gate-runner parenthetical — membership is "runs the neutral verification tiers on code", reached by domain resolution (the loop's "resolved domain's `verification.md`") rather than citation, so grep cannot reconstruct it; `fix-findings`, `implement-task`, and `implement` also cite the path directly, but the remaining members reach it only by resolution.
- `references/documentation/verification.md:3` gate-runner parenthetical — the documentation twin, same resolution-based membership. Its one direct citer, `review-docs`, cites the file only to place its judgment pass against the mechanical tiers — what the pass covers, and where it runs — never as a tier-runner, so a reverse search would misread those citations as membership — the same class as the `commit` exception.
- `references/engineering/exploration.md:3` loader gloss — membership is "loads the grounding recipe for its phase", and `refine-idea` reaches it through `../workflow/ideation.md` § *Ground in what exists* without citing the path, so grep cannot reconstruct it.
- `references/engineering/execution.md:3` loader sentence — membership is "carries out code units through the execution loop", and `implement` (and `fix-findings`, whose fixes run the same loop) resolves the recipe without citing the path, so grep cannot reconstruct it.

Sanctioned copy — mirror note required:

- `references/engineering/code-style.md:14` — `agents/executor.md` and `agents/executor.toml` carry a condensed digest of § *Comments* in their system-prompt text, so a delegated executor holds the comment discipline without a read hop. One mirror note at the home covers both adapter copies, since the two say the same thing in each host's format; when the section changes, both change with it.
- `references/workflow/task-lifecycle.md` § *Status values*, `references/workflow/status-transitions.md` § *Terminal vs. live states*, `references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)*, and `references/workflow/task-layout.md` § *One task, one flat folder* — `scripts/lifecycle-constants.ts` carries the machine-readable copy of the plan status vocabulary, the terminal set, the compaction trigger, and — both owned by that last section — the recognition set and the folder and record size budgets, because the scripts that enforce these values cannot read prose at run time. Four homes, five mirror notes, one module: each home names the copy, and a change to any of those values changes the module in the same edit. The importers are the enumeration the homes point here for: `scripts/health-check.ts` (all five, the two budgets included), `scripts/task-move.ts` (vocabulary, terminal set, recognition set), and `scripts/task-state.ts` (vocabulary). Kept here rather than in each home because the membership is per-constant, so no one home can state it without stating the others' as well.
- `references/workflow/reconciliation-commits.md` § *The watermark*, `references/workflow/task-delivery.md` § *Branch and worktree creation*, and `references/workflow/task-delivery-edges.md` § *Removal* — `scripts/commit-scan.ts` carries the machine-readable copy of the `**Pointers:**` entry shapes those homes define: the watermark's `SHA <sha>`, the branch's `` branch `<branch>` ``, and the `(removed …)` marker on it. The line is free prose, so the shapes are all the scan has to find a floor and a ref by, and it cannot read the prose that defines them at run time. Three homes, three mirror notes, one importer: reword an entry at any of them and change the pattern in the same edit, or the scan reads a task that records both as recording neither — `no-watermark` on a folder that has a baseline, and `HEAD` walked in place of the task's own branch.
