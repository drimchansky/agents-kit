# Script source contracts

This file holds maintainer rationale and mirror notes for each helper under `scripts/`, plus the full contract of each maintainer-only helper. Root `AGENTS.md` § *Source contracts* holds the shared conventions. Run-time CLI and stdout contracts live in `references/scripts/<name>.md`.

## `scripts/commit-scan.ts`

Contract: `references/scripts/commit-scan.md`.

**Why branch existence goes through `git for-each-ref`.** Compare exact refnames from its output. `rev-parse --verify --quiet` gives missing branches and broken repositories the same silent failure. Since `for-each-ref` patterns match prefixes, exact comparison also prevents `refs/heads/feat/x` from satisfying `refs/heads/feat`.

**Why the commit log carries a NUL record separator.** `--pretty=format:%x00%h %ad %s` prefixes commit headers with a byte no path can contain. Readers split records there instead of guessing which `--name-only` lines are headers. `-c core.quotepath=false` prevents C-quoted non-ASCII paths from failing step-name matching. The closing `--` prevents interpreting the range as a path. Otherwise the command matches `references/workflow/reconciliation-commits.md`.

Checkout discrimination mirrors `worktree-merge.ts`'s `checkoutHolding`: only "not a git repository" yields reportable `no-checkout`; other Git failures refuse. Change both copies together. Markdown readers follow the mirror obligation under § *`scripts/health-check.ts`*.

## `scripts/corpus.ts`

Imports supply the corpus for `dup-check.ts`; this module has no CLI. `corpusFiles(root, handlers)` returns sorted absolute paths, with callers deciding how to handle unreadable entries.

**The corpus contains:** every `.md` recursively under `references/`, every `skills/*/SKILL.md`, `CORE_RULES.md`, and root `AGENTS.md`. This paragraph alone defines that set. The duplicate scan includes run-time script contracts through their directory. `tests/` and `scripts/` remain outside, including their nested `AGENTS.md` files. The `.ts` sources copy prose under sanctioned mirror notes, not duplicate suppression. The nested files stay unscanned maintainer prose.

**Every entry is `lstat`ed; symlinks are not followed.** `onSymlink` reports each link and leaves its meaning to the caller. This includes enumerated entries, named members such as `SKILL.md` or root rule files, and the `references/` and `skills/` roots themselves. Roots require inspection before `readdirSync`, which otherwise follows a root link and reads outside the kit. Per-entry checks cannot catch that escape. `dup-check.ts` skips all such links and names them on stderr.

A directory listing failure calls `onUnreadable` with its error code. Missing `skills/` is exempt because a legitimate kit root may contain no skills. Absent or non-regular root rule files call `onMissing` with the reason; nothing else supplies those members. A skill directory without `SKILL.md` is not a skill and produces no report.

## `scripts/dup-check.ts`

Reports normalized sentences of at least **12 words** appearing in two or more corpus files, with each occurrence's `{file, line}`. This detects the drift root `AGENTS.md` § *Change routing* prevents: one rule edited at its owner while a restatement silently stays stale.

```
node scripts/dup-check.ts [--allow FILE] <kit-root>
```

**The corpus it reads** comes from the module defined in § *`scripts/corpus.ts`*.

**Symlinks are skipped and named on stderr.** The corpus walker inspects both discovered links and links occupying named members or roots. Following a link back into the corpus would report its target's prose as a duplicate of itself.

**Cross-file only.** Repetition inside one file does not qualify. Once two distinct files share a sentence, report every occurrence, including within-file repeats, so a collapse accounts for them all.

**What the scan does not read.** Skip YAML frontmatter, fenced code, ATX headings, each SKILL.md's `## Core Rules`, and paragraphs containing `a sanctioned copy per`. The first three are not rule prose. Core Rules is mandatory per-skill boilerplate; reporting it would bury useful findings. Sanctioned copies already carry mirror decisions (root `AGENTS.md` § *Consumer lists*), so the phrase excludes them without another allow-file argument. The Core Rules skip ends at the next level-1 or level-2 heading, not at a deeper subheading.

**Paragraphs are joined before sentences are split.** Different wrapping must not hide identical sentences. A blank line, heading, fence, list item, table row, or blockquote opening ends a paragraph. Drop each blockquote line's `>` prefix before joining so quoted and plain rules match. A quoted fence closes with the quote, preventing an unterminated fence from swallowing later prose. Join lines with single spaces and report each sentence at its starting line. Sentence boundaries are `.`, `!`, `?`, or `;` followed by whitespace or paragraph end. This also splits abbreviations such as "e.g.", identically in both copies, yielding shorter matching groups.

**Markup is blanked before the split and stripped after it.** Replace markup with equal-width spaces in a shadow paragraph, preserving source offsets. This exposes the boundary in `…keep one inline.** No consumer states…`, where a period otherwise abuts bold markup. Splitting raw text would join both sentences and miss a plain-text twin. Then extract each sentence from the original paragraph and normalize it for reporting and allow-file matching.

**Normalization is what makes two wordings one sentence.** Remove HTML comments, leading list markers, and any following `[ ]` or `[x]` checkbox. Reduce links and images to text; strip backticks, emphasis, and table pipes. Lowercase and collapse whitespace. A word is a token containing a letter or digit; punctuation cannot pad a fragment past the floor. Twelve words separates restated rules from incidental shared phrases.

**The allow-file names intentional mirrors.** Default to `<kit-root>/tests/dup-allow.json`, overridden by `--allow`. Its array entries are `{sentence, reason, files?}`. Normalize sentences again on read, so original casing or markup still matches the report. Optional `files` names the expected kit-relative paths. Suppress only when a group's distinct files equal that set; a third copy or moved copy remains a finding. Without `files`, suppress the sentence wherever it appears. A missing allow-file means an empty list, making the scan useful before mirror decisions exist. Missing reasons refuse the run, preventing unexplained suppressions from becoming permanent. Invalid `files`, anything other than a non-empty path array, also refuse.

**A listed sentence that no longer occurs twice is `stale`, and stale fails.** Otherwise obsolete entries would silently excuse future text after their original copies were collapsed or reworded. Failure requires removing the stale allowance in the same change.

**Contract.** stdout is exactly one JSON object: `{"root":<absolute kit root>,"files":N,"groups":[…],"allowed":N,"stale":[…]}`. Groups are `{sentence,occurrences:[{file,line}]}`, with kit-relative files and occurrences sorted by file, then line. Sort groups by descending occurrence count, then sentence. `allowed` counts entries suppressing a group. `stale` returns each obsolete entry verbatim, preserving casing, markup, reason whitespace, and optional `files` for exact lookup. An entry whose sentence still repeats in different files is neither allowed nor stale; report its group. Skipped links and failure summaries go to stderr.

**Exit status.** Zero means no surviving groups or stale entries; 1 means either kind of finding. Status 2 covers missing/invalid roots, unknown options, unreadable directories or corpus files, and malformed or unreadable existing allow-files. Allow-file defects include invalid JSON, non-array data, missing fields, repeated sentences, or invalid `files`. Unexpected failures also exit 2, not 1. Unlike reporting scripts, this check refuses unreadable corpus files: skipping one could falsely report an incompletely scanned corpus as clean.

## `scripts/goal-structure.ts`

This pure module parses goal definitions and scans task-local Markdown references for task-state and health-check. Keep definition parsing shared so health-check's `goal-id` findings and task-state coverage cannot disagree about malformed or duplicate IDs. Measure offsets on the original line, not the CR-stripped text, or CRLF repairs will target the wrong characters. The reference scanner excludes illustrative Markdown and link destinations; repair uses its offsets to update exactly the references validation recognizes. Inline and reference-style link labels retain destination classification so an outside or unproved target cannot become a local remap. Nested labels resolve to their enclosing link, and a label, code span, or quotation left open across a line break marks its tokens ambiguous for the same reason. Retired IDs come only from goals.md's `## Retired` list. Validation therefore needs no Git history, so untracked stores and moved folders validate alike.

## `scripts/health-check.ts`

Contract: `references/scripts/health-check.md`.

**Why `oversized-result` imports `task-state.ts` and not the other way round.** This script's CLI runs at module scope; importing it would start a walk. `task-state.ts` guards direct execution and exposes pure `resultSize`, so both tools can share that measure safely. `oversized-task` and `oversized-record` have no second script or compaction plan to coordinate; their measures stay here and in fixtures.

**Markdown reading.** Skip fenced task-file content because example headings, bullets, and status lines are not the file's own structure. A closing fence matches the opener's marker, at least its length, with only trailing whitespace and no greater indentation. A boolean toggle would treat a nested opener as a close. Relative indentation accommodates list fences beyond CommonMark's flat 0–3 columns. Status scanning stops at the first `##`-or-deeper heading, bounding the header (`references/workflow/doc-task-files.md`).

Anchor slugs lowercase, retain letters/digits/hyphens/underscores/spaces, then replace each space with a hyphen. Repeated headings receive `-1`, `-2`, …, advancing past allocated slugs. Tombstone bullets under `## Compacted` remain valid step anchors (`references/workflow/reconciliation-compaction.md`).

**The store walk.** `collect`, `nestedTaskDirs`, and task-move's registered-root search use `classifyWalkEntry` (§ *`scripts/lifecycle-constants.ts`*). This shares prunes, container-before-recognition ordering, and stopping at claimed folders. Root sets still differ intentionally in two ways. Move searches nested registered roots independently; this walk folds them into containers (§ *Why physical identity is settled before ambiguity is*). Move searches the canonical root one level deep; this walk recurses into groups. Each difference can expose a task to only one tool. Check these two causes before treating conflicting slug resolution and scan counts as defects.

**Why `nested-task` is the one check that looks inside a claimed folder.** A misfiled role file can make a group qualify as a task. Ordinary walks stop there, hiding every descendant task without a diagnostic. This check descends under the same prunes and reports hidden folders without changing recognition or `scanned`. The group still counts as one task; descendants appear only in this finding.

**Why the citation checks read a line the way they do.** Inline code binds tighter than links. Both scans blank paired backtick spans so illustrated `](` text cannot become a citation. The plain-text store-level scan also uses this blanked line: a backticked path in a fixture description is illustrative. Reading it raw would label an intentional example `dead-citation`. Write intended citations unbackticked, per `references/workflow/one-home.md` § *One home per fact*.

The store scan initially takes the contiguous path characters around a filename. Walking backward through prose would absorb unrelated slashes and report fragments the author never meant as paths. Widen across preceding spaces only to seek a resolvable candidate; stop at the first resolution. Group names can contain any number of spaces at any depth, including directly under a root. Restricting widening to a preceding slash would handle `Hub/Account Management/DECISIONS.md` but miss equally valid multiword paths. If nothing resolves, report only the original narrow token. Widening therefore discovers live paths without changing the failure token or introducing prose noise.

`citation-form` recommends bare slugs only within `references/workflow/task-layout.md` § *Discovery rules for skills*' canonical depth. That means one level, plus the root's own Archive/Backlog. The walk's recursive reach is broader, so uniqueness among walked folders does not prove a slug resolves. Registered roots allow deeper resolution, but this pass cannot distinguish root kinds; the narrower rule gives a valid fallback for either.

Measure depth and fallback paths from the root holding the target, not the citing task. Slug uniqueness spans all roots. Measuring from the citer would falsely label targets in another root outside the store, producing an unfixable recommendation. Name the target's root when different; reserve outside-store notes for targets no walked root contains. This requires finishing all root walks before citation checking. `dead-citation` and `citation-form` stay separate because broken targets permit mechanical repair, while nonconformant forms require deciding which task was intended.

**Markdown mirrors.** `task-state.ts` mirrors these readers; `task-move.ts` mirrors fences and status. `commit-scan.ts` mirrors fences, headings, step titles, and checkboxes. `sweep-scope.ts` mirrors fences, headings, link targets, and trailing noise. `goal-structure.ts` mirrors fences and headings; its reference scan mirrors health-check's citation blockquote skip, including lazy continuation lines. Unlike health-check, that scan also ends a quote at a fence line. Change each affected mirror in the same edit. They must agree on anchors, terminal status, nominated steps, sweep section bounds, and link grammar. Every mirror strips a trailing CR from each line so CRLF task files still match headings and fences.

Both citation readers import `angledTargetText` from `lifecycle-constants.ts`. Shared code prevents the angle-target padding rule from drifting again. Health-check first blanks inline code and skips blockquotes, then percent-decodes targets to resolve paths. Sweep-scope instead percent-encodes interior spaces so URLs match its ledger. Preserve these deliberate differences while keeping the shared literal angle-target interpretation.

## `scripts/lifecycle-constants.ts`

This module holds machine-readable copies of the task values whose prose homes root `AGENTS.md` § *Consumer lists* names. Change the values with their prose. A stale status vocabulary reads renamed states as `unknown`, silently disabling stale, done-unarchived, and started-in-backlog checks.

`classifyWalkEntry` shares an ordering, not merely constants: prune, lifecycle container, recognition set, otherwise descend. Only the last two answers change what callers do. Separate implementations can silently omit the container question. `nestedTaskDirs` once did, claiming an Archive folder with a misfiled role file and hiding descendants. Sharing values alone would not prevent that ordering defect. A caller-supplied directory-read thunk preserves each error policy: `listEntries` warns and continues; `readOrRefuse` refuses. It also prevents reading pruned entries.

`holdsRoleFile` accepts names rather than a path, avoiding duplicate reads when callers already listed the directory. Suffix matching excludes the bare suffix itself, which is a dotfile rather than a role file.

## `scripts/pr-comments.ts`

Contract: `references/scripts/pr-comments.md`.

**Why a URL's owner and repo go through `-f`.** `-F` expands `{owner}`/`{repo}` from the current checkout and converts digit-only values into JSON numbers. Both would corrupt literal URL values; GraphQL `String!` variables reject numbers. Use `-f` for the URL's owner and repository.

**Why the `gh` reply is read with a 64 MiB buffer.** `execFileSync` defaults to 1 MiB. Large reviews would abort with `ENOBUFS`, not return a shorter page, losing an otherwise fetchable report.

**Why the entry check goes through `realpath`.** Only direct execution may fetch; tests import the pure layer without network effects. Node leaves `process.argv[1]` as typed but resolves `import.meta.url`. Without normalization, a symlinked invocation compares unequal, looks like an import, and silently does nothing.

## `scripts/session-triage.ts`

Contract: `references/scripts/session-triage.md`.

**Why `sessions` is tallied in the driving loop.** Count each file before classification. Readable, sniffable transcripts scoring nothing never enter ranked results; unreadable or unsniffable files never reach classification. A downstream tally would silently undercount its claimed window.

**Argument handling.** Peek at separate values and consume them only when their shape matches the flag. Blind `argv[++i]` can swallow a session directory and shorten the walk without a JSON warning. `--top` accepts whole integers, as health-check does; `parseInt` would silently accept `2junk` or truncate `1.5`. Date constructors normalize impossible dates, moving `2026-02-30` into March. An `isoDate` round-trip rejects those and NaN dates instead of shifting the window.

When the window cannot parse, mark every directory unread; stderr alone would leave JSON indistinguishable from a complete clean walk. Parsed JSON `null` and other non-objects count as unknown rather than being dereferenced. Unreadable mtime counts as in-window rather than being assumed out.

## `scripts/sweep-scope.ts`

Contract: `references/scripts/sweep-scope.md`.

The Markdown-reading mirror obligation is under § *`scripts/health-check.ts`*.

## `scripts/task-move.ts`

Contract: `references/scripts/task-move.md`.

**Why slug resolution refuses what it cannot read.** Reads deciding slug uniqueness treat `ENOENT` and `ENOTDIR` as silent absence. Other errors conceal possible matches: name path and cause, then exit 2 before renaming. Testing whether one folder holds a role file tolerates an empty answer; proving uniqueness does not. Otherwise an unreadable group could hide a duplicate and let the wrong match move.

Apply this policy to the canonical root, registry file, and all registered roots, because each can conceal candidates. Tolerant readers such as `readdirNames` and `isTaskFolder`'s listing remain only outside resolution. Missing roots warn instead of refusing: they conceal nothing, and one registry can serve several machines (`references/workflow/task-store.md` § *The root registry*).

Path arguments use `boundingRoot`'s tolerant registry read. They need only a containing bound, not a complete uniqueness search. An unreadable registry falls back to `.agents/tasks` with no registry warning. The path route promises one refusal line, and its result does not depend on reporting registry completeness.

**Why physical identity is settled before ambiguity is.** Overlapping registrations can find one folder through several paths. Key matches by physical identity so ambiguity counts folders rather than discovery routes. Collapse only aliases of the same resolved root; search nested registered roots independently. Outer walks may prune dotted or `node_modules` ancestors, or stop at a role-bearing parent. Folding nested roots into their containers would make hidden tasks unresolvable by slug. Search surviving roots in identity order so candidate ordering is stable across differently ordered registries. Sorting affects the refusal's presentation, not deduplication.

Store-walk behavior and fence/status mirrors follow § *`scripts/health-check.ts`*.

## `scripts/task-state.ts`

Contract: `references/scripts/task-state.md`.

Markdown mirrors follow § *`scripts/health-check.ts`*.

**Why the entry check goes through `realpath`.** Only a direct run reads task files. Tests import the pure layer, so a module-scope walk would introduce filesystem effects on import. The symlinked-invocation mismatch and normalization are the same as § *`scripts/pr-comments.ts`* describes.

The `structure` report adds reliability and diagnostics without changing the existing coverage fields. The direct CLI scans supplementary task Markdown before reporting; pure callers can supply those documents. `--repair` is the only writing mode. Default and compaction invocations remain read-only. Its command and output contract live in `references/scripts/task-state.md`.

## `scripts/task-repair.ts`

The repair entry point remains separate from task-state's pure readers. Task-state hands repair its full structure report as the validator, so a remap cannot open a coverage gap; importing task-state here would form a cycle. A fresh numeric ID requires a tracked goals file and reachable, non-shallow Git history reaching its creation. Scan historical goal bullets across that history, and reserve IDs listed under `## Retired`; current maximum alone cannot prove non-reuse. Normalize physical paths before looking up a nested task in Git history, since macOS aliases `/var` to `/private/var`.

Read every task-local Markdown file before proposing a remap, because an unread file could hold a reference the remap would miss. Write only the four core role files: other documents may be authored, published, or already sent, so their references block a remap instead. Its walk also feeds task-state's ordinary CLI and health-check's `goal-id`, so all three read the same documents and scan gaps. The walk skips subfolders holding a role file; health-check reports those as `nested-task`, except a subfolder named Archive or Backlog, which its walk treats as a lifecycle container. Compare normalized goal identities so decoration cannot hide duplicate definitions. No persistent transaction record exists, so a crash between renames leaves old references for the next structural scan to diagnose. Staging-file sweeping keys on the writer PID so a concurrent repair's files survive. The staging, inventory, and rollback mechanics live in `references/scripts/task-state.md`.

## `scripts/worktree-merge.ts`

Contract: `references/scripts/worktree-merge.md`.

**Why filename dictionaries have no prototype.** `__proto__` assignment on an ordinary object changes its prototype instead of storing a file entry. Null-prototype dictionaries preserve literal filenames during walks, manifest reloads, and filtered reconstruction. Own-property checks distinguish missing filenames from inherited names such as `constructor`. JSON fields and version remain unchanged.

**Why a path is cleared before it is copied onto.** `copyFileSync` follows a destination symlink into its target. Clear links with `unlinkSync`; `rmSync` rejects directory-targeting links unless recursive. Recursive removal would still remove only the link, but unlinking avoids depending on that behavior for either target shape.

Reject options unsupported by their subcommand. `discard` takes none, preventing a mistyped `remove` from becoming an ungated deletion. Dispatch also guards commands absent from the parser, so adding a subcommand in only one place reports it instead of throwing `TypeError`.

One `check-ignore` call filters the full walk. Pass paths over `--stdin` to avoid overflowing argv, with NUL delimiters both ways (`-z`) for newline-bearing filenames. Read replies with unbounded `maxBuffer`; a large ignored cache can exceed Node's 1 MiB default. Failing there would break precisely the trees the filter should drop. Exit 1 means no matches, a successful filter. Only "not a git repository" on stderr yields no checkout; other failures refuse instead of reporting an unfiltered tree. Collect leaves first, filter, then hash so ignored caches cost no hashing.

Normalize receipt and removal worktree paths through `realpath`. This makes `/private/tmp` receipts match `/tmp` removal requests on macOS. When physical resolution fails, retain the merely resolved path. Without normalization, equivalent temp paths would wrongly fail the gate.

`checkoutHolding`'s Git-error discrimination mirrors `commit-scan.ts`: distinguish no checkout from a failed run. Update both in the same edit.

**Why `index` hashes live bytes rather than reading blobs.** One read of each file yields both the manifest's SHA-256 and the index's blob id. That proves the index equals the measured bytes without `git cat-file` holding every blob in memory. A file changed since the manifest fails the comparison instead of passing on stale bytes.

**Why `index` asks `diff-files` for intent-to-add entries.** `ls-files -s` lists one at stage 0 with the empty blob, so an empty file matches its bytes, yet `git commit` omits it. `diff-files --diff-filter=A` lists only such entries: a real index entry shows as modified, deleted, or type-changed, never added.

**Why the base check reads directory listings.** On a case-insensitive filesystem, `lstat` resolves a base path's old case after a case-only rename. That rename would read as a deletion still on disk. Compare each component against its parent's listing, NFC-normalized for macOS's decomposed names. An unreadable listing counts as present, keeping the refusal.

**Why `check --out` drops the paths only its baseline measured.** A check keeps measuring a path its baseline measured, even one now ignored and untracked, so no false deletion appears. A fresh `baseline` drops that path. Keeping it in the written manifest would make `index` report it absent from the index and forfeit reuse.
