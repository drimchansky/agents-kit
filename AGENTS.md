# Maintaining agents-kit

This guide applies to the **agents-kit source repository**, not consumer projects that installed the kit.

Read [CORE_RULES.md](./CORE_RULES.md) first. Apply its shared rules before task-specific sources.

## Writing standard

Keep run-time prose focused on the actions a frontier model needs. Remove these four classes when editing skills and references:

1. **Weak-model scaffolding.** Delete Don't Rationalize, Verification, Red flags, and CRITICAL blocks. Preserve each protocol invariant in the step it guards. Keep the Core Rules load block and contract sections with longer titles, such as Verification cadence.
2. **Rationale and design history.** Cut explanatory paragraphs, audit history, and mirror commentary. Defaults retain a one-clause reason; maintainer rationale stays under Source contracts. Record any missing mirror obligation under Consumer lists.
3. **Defensive edge enumeration.** Replace branch lists with their invariant. Keep a branch when omitting it risks a wrong write, Git mutation, deletion, or false report.
4. **Ownership and citation plumbing.** Remove ownership preambles and loading commentary. Put the relevant link or section pointer beside its action; retain cold markers.

Write one idea per sentence, aiming for about 20 words. Avoid em-dash chains and "X is what Y" constructions. Reserve `never` and `MUST` for invariants. This standard is the regrowth brake; add no size script or ratchet.

## Ownership

- `skills/<name>/SKILL.md` owns the skill's protocol and direct reference citations.
- `references/workflow/` owns shared workflow methodology. Its `domain-packs.md` defines the domain-pack interface.
- `references/<domain>/` owns domain guidance.
- `references/templates/` owns the five copy-ready task-file shapes. Each file's contracting workflow reference owns its rules.
- `setup.ts` owns installation and distribution. Its § *Source contracts* subsection owns CLI, stdout, exit behavior, and rationale.
- `.claude-plugin/` owns the Claude Code plugin and its single-plugin marketplace. The plugin root is the repository root, so skill `./AGENTS.md` and `./references` links resolve inside the plugin cache. Neither manifest pins `version`, so every commit is a new version for `/plugin update`.
- `scripts/` owns zero-dependency Node helpers. For a helper skills run, `references/scripts/<name>.md` owns CLI and stdout contracts, installed with other references. Its § *Source contracts* subsection owns rationale and mirror notes. For maintainer-only helpers, that subsection owns all three. Sources carry no comments; change a contract at its owner in the same edit.
- `tests/` owns verification. Its § *Source contracts* subsection explains suite commands and dependencies; § *Change routing* maps scripts to suites. `tests/dup-allow.json` records intentional prose mirrors, each entry explaining why its copy stays.
- `.agents/tasks/` owns task artifacts and active work context.

## The `.ts` sources are unchecked by design

`setup.ts`, `scripts/`, and `tests/` run directly through Node type stripping, without a build, bundler, or typechecker. **Node 23.6 or newer is the floor for every `.ts` source, including `setup.ts`.** State the floor only here; § *Shared conventions* points here to prevent drift.

Unflagged type stripping also works from 22.18. A single supported floor avoids carrying two branches; it is a support choice, not a code limitation. Below either threshold, parsing a type annotation fails without a version message. Under `node --test`, the globbed suites match and then fail to load for the same reason.

Annotations are erased, not validated. The engineering pack's typecheck, lint, and build recipe has no target here (`references/engineering/rules.md` § *Before presenting changes*). Its test command does: `node --test "tests/*.test.ts"` covers the whole verification surface.

No linter, formatter, or graph-aware runner exposes a narrowing class. `references/engineering/boundary-scope.md` therefore skips the manifest and delta; every boundary runs that whole-tree command. Adding a checker would introduce `package.json`, a lockfile, and `node_modules` into a Markdown-and-TypeScript tree. That dependency cost is why checking was declined; weigh it again if revisiting the decision.

## Source contracts

Run-time helper contracts live in `references/scripts/<name>.md`. This section holds maintainer-only contracts, shared conventions, helper rationale and mirrors, installation behavior, and suite dependencies. These are the two places callers read decisions before assembling commands; sources contain no comments.

Installed runs do not load this file. `setup.ts` installs `CORE_RULES.md` instead, and each skill's `./AGENTS.md` resolves there. References cite sections here as plain root-relative text. A `./` link would resolve to the wrong file.

### Shared conventions

**Zero dependencies; direct Node type stripping.** The supported floor is stated in § *The `.ts` sources are unchecked by design*.

**Exit conventions.** `task-move.ts`, `task-state.ts`, `pr-comments.ts`, `dup-check.ts`, and `worktree-merge.ts` share 0/1/2. Zero completes the job; 1 reports a decided outcome; 2 means the run could not reach that decision. `commit-scan.ts` and `sweep-scope.ts` use only 0 and 2 because their reports are not decided outcomes. `health-check.ts` and `session-triage.ts` always exit 0, keeping reports parseable when part of the corpus is unreadable.

**Piped stdout is asynchronous.** After emitting JSON, let the module end so buffered output flushes. Calling `process.exit` would truncate reports exceeding the pipe buffer, often 64 KB. Swallow EPIPE from readers closing early so that unawaited stream error does not change the promised status.

**No script calls `process.exit` to set status.** Write the non-zero reason before assigning `process.exitCode`, preserving both the explanation and pending output. `task-move.ts`, `task-state.ts`, `pr-comments.ts`, `commit-scan.ts`, and `sweep-scope.ts` throw an `Exit` carrying the code. `worktree-merge.ts` throws `Refused` or `Unrunnable`. One handler at each module's end reports every refusal. `dup-check.ts` handles thrown `Refused` as status 2, but assigns status 1 after writing its findings report.

### `setup.ts`

Installs skills, `references/`, `CORE_RULES.md`, and native agent definitions into `~/.claude` and `~/.codex`. Ownership markers let later runs reclaim installed items while preserving user content.

```
node setup.ts
```

**Contract.** stdout names each home and every installed or skipped item; stderr names refused homes. Exit 0 means every home installed; 1 means at least one home was skipped.

**Why the staging dirs.** Skills stage under `skills/.agents-kit-staging.*`; references stage under the home's `.agents-kit-references.staging.*`. Each staging directory contains its marker before atomic rename, preventing a visible unmarked payload. An interrupted run leaves staging directories that the next sweep removes under both prefixes. `CORE_RULES.md` and agent definitions instead use `touchMarker` followed by `copyFileSync` at their visible paths. They use neither staging nor rename, so interruption mid-copy can leave a partial marked file.

**Why a home is refused.** Kit skills symlink `./AGENTS.md` and `./references` to install-root siblings. User-owned replacements would redirect every skill into non-kit content, so the installer refuses that entire home. A kit-owned `skills/` symlink is reclaimed, including links into this repository, dangling leftovers, or moved clones. Other `skills/` symlinks are refused because installing through them would dangle the per-skill links.

**Why the copy modes differ.** Skills use `verbatimSymlinks` to preserve relative targets. Without it, `cpSync` rewrites them as absolute checkout paths instead of resolving inside the installed home. References contain no symlinks and use `dereference`. References and core rules remain available during the skills loop; each is replaced only at its own installation site. The references replacement is staged before removing its predecessor.

**Why the reclaim sweep skips a symlinked entry.** `isDirectory` follows links, so a linked skill entry reaches the sweep as a directory. Following its target to an `.agents-kit` marker would wrongly claim and remove the user's link. The skip preserves links the kit did not install, even when their targets contain markers; `tests/setup-install.test.ts` pins this behavior.

**Why reclaiming a kit-owned `skills/` link uses `unlinkSync`.** Only the link is removed. `rmSync` rejects links targeting directories with `ERR_FS_EISDIR`; every reclaimable non-dangling link has that shape. Ownership requires an absolute target named `skills` whose parent contains `setup.ts`, `CORE_RULES.md`, and `references/`. This recognizes a clone that has moved since installation.

**Why each replacement removes before it renames.** `renameSync` cannot replace a non-empty directory. Removing references first permits the rename, leaving an absence window one rename wide. Core rules need no removal: `copyFileSync` overwrites the regular file after the conflict gate excludes an unmarked predecessor. Writing its marker first prevents an unmarked visible payload.

**Why the agent sweep is marker-driven.** The marker alone establishes ownership. Sweep each definition with its marker, reclaiming installs interrupted between the two writes. The copy loop preserves and skips any same-named unmarked file.

### `scripts/commit-scan.ts`

Contract: `references/scripts/commit-scan.md`.

**Why branch existence goes through `git for-each-ref`.** Compare exact refnames from its output. `rev-parse --verify --quiet` gives missing branches and broken repositories the same silent failure. Since `for-each-ref` patterns match prefixes, exact comparison also prevents `refs/heads/feat/x` from satisfying `refs/heads/feat`.

**Why the commit log carries a NUL record separator.** `--pretty=format:%x00%h %ad %s` prefixes commit headers with a byte no path can contain. Readers split records there instead of guessing which `--name-only` lines are headers. `-c core.quotepath=false` prevents C-quoted non-ASCII paths from failing step-name matching. The closing `--` prevents interpreting the range as a path. Otherwise the command matches `references/workflow/reconciliation-commits.md`.

Checkout discrimination mirrors `worktree-merge.ts`'s `checkoutHolding`: only "not a git repository" yields reportable `no-checkout`; other Git failures refuse. Change both copies together. Markdown readers follow the mirror obligation under § *`scripts/health-check.ts`*.

### `scripts/corpus.ts`

Imports supply the corpus for `dup-check.ts`; this module has no CLI. `corpusFiles(root, handlers)` returns sorted absolute paths, with callers deciding how to handle unreadable entries.

**The corpus contains:** every `.md` recursively under `references/`, every `skills/*/SKILL.md`, `CORE_RULES.md`, and `AGENTS.md`. This paragraph alone defines that set. The duplicate scan includes run-time script contracts through their directory. `tests/` and `scripts/` remain outside: source/prose copies use sanctioned mirror notes, not duplicate suppression.

**Every entry is `lstat`ed; symlinks are not followed.** `onSymlink` reports each link and leaves its meaning to the caller. This includes enumerated entries, named members such as `SKILL.md` or root rule files, and the `references/` and `skills/` roots themselves. Roots require inspection before `readdirSync`, which otherwise follows a root link and reads outside the kit. Per-entry checks cannot catch that escape. `dup-check.ts` skips all such links and names them on stderr.

A directory listing failure calls `onUnreadable` with its error code. Missing `skills/` is exempt because a legitimate kit root may contain no skills. Absent or non-regular root rule files call `onMissing` with the reason; nothing else supplies those members. A skill directory without `SKILL.md` is not a skill and produces no report.

### `scripts/dup-check.ts`

Reports normalized sentences of at least **12 words** appearing in two or more corpus files, with each occurrence's `{file, line}`. This detects the drift § *Change routing* prevents: one rule edited at its owner while a restatement silently stays stale.

```
node scripts/dup-check.ts [--allow FILE] <kit-root>
```

**The corpus it reads** comes from the module defined in § *`scripts/corpus.ts`*.

**Symlinks are skipped and named on stderr.** The corpus walker inspects both discovered links and links occupying named members or roots. Following a link back into the corpus would report its target's prose as a duplicate of itself.

**Cross-file only.** Repetition inside one file does not qualify. Once two distinct files share a sentence, report every occurrence, including within-file repeats, so a collapse accounts for them all.

**What the scan does not read.** Skip YAML frontmatter, fenced code, ATX headings, each SKILL.md's `## Core Rules`, and paragraphs containing `a sanctioned copy per`. The first three are not rule prose. Core Rules is mandatory per-skill boilerplate; reporting it would bury useful findings. Sanctioned copies already carry mirror decisions (§ *Consumer lists*), so the phrase excludes them without another allow-file argument. The Core Rules skip ends at the next level-1 or level-2 heading, not at a deeper subheading.

**Paragraphs are joined before sentences are split.** Different wrapping must not hide identical sentences. A blank line, heading, fence, list item, table row, or blockquote opening ends a paragraph. Drop each blockquote line's `>` prefix before joining so quoted and plain rules match. A quoted fence closes with the quote, preventing an unterminated fence from swallowing later prose. Join lines with single spaces and report each sentence at its starting line. Sentence boundaries are `.`, `!`, `?`, or `;` followed by whitespace or paragraph end. This also splits abbreviations such as "e.g.", identically in both copies, yielding shorter matching groups.

**Markup is blanked before the split and stripped after it.** Replace markup with equal-width spaces in a shadow paragraph, preserving source offsets. This exposes the boundary in `…keep one inline.** No consumer states…`, where a period otherwise abuts bold markup. Splitting raw text would join both sentences and miss a plain-text twin. Then extract each sentence from the original paragraph and normalize it for reporting and allow-file matching.

**Normalization is what makes two wordings one sentence.** Remove HTML comments, leading list markers, and any following `[ ]` or `[x]` checkbox. Reduce links and images to text; strip backticks, emphasis, and table pipes. Lowercase and collapse whitespace. A word is a token containing a letter or digit; punctuation cannot pad a fragment past the floor. Twelve words separates restated rules from incidental shared phrases.

**The allow-file names intentional mirrors.** Default to `<kit-root>/tests/dup-allow.json`, overridden by `--allow`. Its array entries are `{sentence, reason, files?}`. Normalize sentences again on read, so original casing or markup still matches the report. Optional `files` names the expected kit-relative paths. Suppress only when a group's distinct files equal that set; a third copy or moved copy remains a finding. Without `files`, suppress the sentence wherever it appears. A missing allow-file means an empty list, making the scan useful before mirror decisions exist. Missing reasons refuse the run, preventing unexplained suppressions from becoming permanent. Invalid `files`, anything other than a non-empty path array, also refuse.

**A listed sentence that no longer occurs twice is `stale`, and stale fails.** Otherwise obsolete entries would silently excuse future text after their original copies were collapsed or reworded. Failure requires removing the stale allowance in the same change.

**Contract.** stdout is exactly one JSON object: `{"root":<absolute kit root>,"files":N,"groups":[…],"allowed":N,"stale":[…]}`. Groups are `{sentence,occurrences:[{file,line}]}`, with kit-relative files and occurrences sorted by file, then line. Sort groups by descending occurrence count, then sentence. `allowed` counts entries suppressing a group. `stale` returns each obsolete entry verbatim, preserving casing, markup, reason whitespace, and optional `files` for exact lookup. An entry whose sentence still repeats in different files is neither allowed nor stale; report its group. Skipped links and failure summaries go to stderr.

**Exit status.** Zero means no surviving groups or stale entries; 1 means either kind of finding. Status 2 covers missing/invalid roots, unknown options, unreadable directories or corpus files, and malformed or unreadable existing allow-files. Allow-file defects include invalid JSON, non-array data, missing fields, repeated sentences, or invalid `files`. Unexpected failures also exit 2, not 1. Unlike reporting scripts, this check refuses unreadable corpus files: skipping one could falsely report an incompletely scanned corpus as clean.

### `scripts/health-check.ts`

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

**Markdown mirrors.** `task-state.ts` mirrors these readers; `task-move.ts` mirrors fences and status. `commit-scan.ts` mirrors fences, headings, step titles, and checkboxes. `sweep-scope.ts` mirrors fences, headings, link targets, and trailing noise. Change each affected mirror in the same edit. They must agree on anchors, terminal status, nominated steps, sweep section bounds, and link grammar.

Both citation readers import `angledTargetText` from `lifecycle-constants.ts`. Shared code prevents the angle-target padding rule from drifting again. Health-check first blanks inline code and skips blockquotes, then percent-decodes targets to resolve paths. Sweep-scope instead percent-encodes interior spaces so URLs match its ledger. Preserve these deliberate differences while keeping the shared literal angle-target interpretation.

### `scripts/lifecycle-constants.ts`

This module holds machine-readable copies of the task values whose prose homes § *Consumer lists* names. Change the values with their prose. A stale status vocabulary reads renamed states as `unknown`, silently disabling stale, done-unarchived, and started-in-backlog checks.

`classifyWalkEntry` shares an ordering, not merely constants: prune, lifecycle container, recognition set, otherwise descend. Only the last two answers change what callers do. Separate implementations can silently omit the container question. `nestedTaskDirs` once did, claiming an Archive folder with a misfiled role file and hiding descendants. Sharing values alone would not prevent that ordering defect. A caller-supplied directory-read thunk preserves each error policy: `listEntries` warns and continues; `readOrRefuse` refuses. It also prevents reading pruned entries.

`holdsRoleFile` accepts names rather than a path, avoiding duplicate reads when callers already listed the directory. Suffix matching excludes the bare suffix itself, which is a dotfile rather than a role file.

### `scripts/pr-comments.ts`

Contract: `references/scripts/pr-comments.md`.

**Why a URL's owner and repo go through `-f`.** `-F` expands `{owner}`/`{repo}` from the current checkout and converts digit-only values into JSON numbers. Both would corrupt literal URL values; GraphQL `String!` variables reject numbers. Use `-f` for the URL's owner and repository.

**Why the `gh` reply is read with a 64 MiB buffer.** `execFileSync` defaults to 1 MiB. Large reviews would abort with `ENOBUFS`, not return a shorter page, losing an otherwise fetchable report.

**Why the entry check goes through `realpath`.** Only direct execution may fetch; tests import the pure layer without network effects. Node leaves `process.argv[1]` as typed but resolves `import.meta.url`. Without normalization, a symlinked invocation compares unequal, looks like an import, and silently does nothing.

### `scripts/session-triage.ts`

Contract: `references/scripts/session-triage.md`.

**Why `sessions` is tallied in the driving loop.** Count each file before classification. Readable, sniffable transcripts scoring nothing never enter ranked results; unreadable or unsniffable files never reach classification. A downstream tally would silently undercount its claimed window.

**Argument handling.** Peek at separate values and consume them only when their shape matches the flag. Blind `argv[++i]` can swallow a session directory and shorten the walk without a JSON warning. `--top` accepts whole integers, as health-check does; `parseInt` would silently accept `2junk` or truncate `1.5`. Date constructors normalize impossible dates, moving `2026-02-30` into March. An `isoDate` round-trip rejects those and NaN dates instead of shifting the window.

When the window cannot parse, mark every directory unread; stderr alone would leave JSON indistinguishable from a complete clean walk. Parsed JSON `null` and other non-objects count as unknown rather than being dereferenced. Unreadable mtime counts as in-window rather than being assumed out.

### `scripts/sweep-scope.ts`

Contract: `references/scripts/sweep-scope.md`.

The Markdown-reading mirror obligation is under § *`scripts/health-check.ts`*.

### `scripts/task-move.ts`

Contract: `references/scripts/task-move.md`.

**Why slug resolution refuses what it cannot read.** Reads deciding slug uniqueness treat `ENOENT` and `ENOTDIR` as silent absence. Other errors conceal possible matches: name path and cause, then exit 2 before renaming. Testing whether one folder holds a role file tolerates an empty answer; proving uniqueness does not. Otherwise an unreadable group could hide a duplicate and let the wrong match move.

Apply this policy to the canonical root, registry file, and all registered roots, because each can conceal candidates. Tolerant readers such as `readdirNames` and `isTaskFolder`'s listing remain only outside resolution. Missing roots warn instead of refusing: they conceal nothing, and one registry can serve several machines (`references/workflow/task-store.md` § *The root registry*).

Path arguments use `boundingRoot`'s tolerant registry read. They need only a containing bound, not a complete uniqueness search. An unreadable registry falls back to `.agents/tasks` with no registry warning. The path route promises one refusal line, and its result does not depend on reporting registry completeness.

**Why physical identity is settled before ambiguity is.** Overlapping registrations can find one folder through several paths. Key matches by physical identity so ambiguity counts folders rather than discovery routes. Collapse only aliases of the same resolved root; search nested registered roots independently. Outer walks may prune dotted or `node_modules` ancestors, or stop at a role-bearing parent. Folding nested roots into their containers would make hidden tasks unresolvable by slug. Search surviving roots in identity order so candidate ordering is stable across differently ordered registries. Sorting affects the refusal's presentation, not deduplication.

Store-walk behavior and fence/status mirrors follow § *`scripts/health-check.ts`*.

### `scripts/task-state.ts`

Contract: `references/scripts/task-state.md`.

Markdown mirrors follow § *`scripts/health-check.ts`*.

**Why the entry check goes through `realpath`.** Only a direct run reads task files. Tests import the pure layer, so a module-scope walk would introduce filesystem effects on import. The symlinked-invocation mismatch and normalization are the same as § *`scripts/pr-comments.ts`* describes.

### `scripts/worktree-merge.ts`

Contract: `references/scripts/worktree-merge.md`.

**Why a path is cleared before it is copied onto.** `copyFileSync` follows a destination symlink into its target. Clear links with `unlinkSync`; `rmSync` rejects directory-targeting links unless recursive. Recursive removal would still remove only the link, but unlinking avoids depending on that behavior for either target shape.

Reject options unsupported by their subcommand. `discard` takes none, preventing a mistyped `remove` from becoming an ungated deletion. Dispatch also guards commands absent from the parser, so adding a subcommand in only one place reports it instead of throwing `TypeError`.

One `check-ignore` call filters the full walk. Pass paths over `--stdin` to avoid overflowing argv, with NUL delimiters both ways (`-z`) for newline-bearing filenames. Read replies with unbounded `maxBuffer`; a large ignored cache can exceed Node's 1 MiB default. Failing there would break precisely the trees the filter should drop. Exit 1 means no matches, a successful filter. Only "not a git repository" on stderr yields no checkout; other failures refuse instead of reporting an unfiltered tree. Collect leaves first, filter, then hash so ignored caches cost no hashing.

Normalize receipt and removal worktree paths through `realpath`. This makes `/private/tmp` receipts match `/tmp` removal requests on macOS. When physical resolution fails, retain the merely resolved path. Without normalization, equivalent temp paths would wrongly fail the gate.

`checkoutHolding`'s Git-error discrimination mirrors `commit-scan.ts`: distinguish no checkout from a failed run. Update both in the same edit.

### `tests/`

Suites use zero dependencies and Node type stripping, like their sources.

```
node --test tests/<name>.test.ts
node --test "tests/*.test.ts"
```

Quote the glob for the runner to expand it. A bare directory would be resolved as a module path.

**The `pr-comments` suite never reaches the real CLI or the network.** Cases use fixture pages, arguments rejected before fetching, or a fake `gh` first on PATH. Cases requiring live CLI or network access do not belong here.

**The `setup-install` suite pins a rule about `references/` that reaches past its own assertions.** `setup.ts` copies references with `dereference`, materializing links. Health-check's `--installs` pass reports one-sided links as drift. A references symlink would therefore produce permanent installation drift; keep the tree symlink-free.

**The live Codex doctor probe is opt-in.** Its environment diagnostics contact external services and can abort sandboxed suite runs. Run `AGENTS_KIT_LIVE_CODEX_DOCTOR=1 node --test tests/setup-install.test.ts` when live diagnostics are intended. Default runs retain installation and TOML checks and report the doctor probe as skipped.

**The installed Codex TOML probe guards permission inheritance.** It rejects sandbox, approval, permission-profile, and network-proxy overrides in parsed agent definitions. The probe requires Python with `tomllib`; without it, the suite reports the check as skipped.

**The `commit-scan` suite builds real checkouts.** Branch existence and watermark ancestry require Git repositories, not text fixtures. Each temporary checkout sets local `user.email`, `user.name`, and `commit.gpgsign`, then stages with `git add -f`. This isolates tests from global identity, signing, and ignore settings. Keep the project-local task folder untracked and unstaged so it stays outside the ranges under test.

**The `health-check` suite's fixture ages are load-bearing.** Four folders exceed the default 30 days. `done-unarchived` is excluded from stale by terminal status; `unknown-status` by vocabulary; `parked-todo` by backlog placement. `no-status-plan` has no exemption: the live-status guard checks only non-null status. Its unparseable header therefore yields the second stale finding, labeled `no-status`. Regressing any exclusion changes the count.

## Change routing

Before editing, inspect the affected skills and their direct references. For shared contracts, reverse-search consumers across `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md` (§ *Consumer lists*). Read relevant Git history to preserve existing contract reasons.

Installation changes include `setup.ts`, native agent definitions, and installed payload behavior. Inspect `tests/setup-install.test.ts` and `scripts/health-check.ts` together: installation checks hardcode markers, payload categories, and per-host agent extensions.

Run the suite covering each changed surface:

- `setup.ts`: `node --test tests/setup-install.test.ts`.
- `scripts/health-check.ts`: `node --test tests/health-check.test.ts`.
- `scripts/task-move.ts`: `node --test tests/task-move.test.ts`.
- `scripts/task-state.ts`: `node --test tests/task-state.test.ts`, plus health-check and sweep-scope suites for its exported helpers.
- `scripts/commit-scan.ts`: `node --test tests/commit-scan.test.ts`.
- `scripts/sweep-scope.ts`: `node --test tests/sweep-scope.test.ts`.
- `scripts/session-triage.ts`: `node --test tests/session-triage.test.ts`.
- `scripts/pr-comments.ts`: `node --test tests/pr-comments.test.ts`.
- `scripts/dup-check.ts` or its `corpus.ts` import: `node --test tests/dup-check.test.ts`.
- `scripts/worktree-merge.ts`: `node --test tests/worktree-merge.test.ts`.
- `scripts/lifecycle-constants.ts`: health-check, task-move, task-state, commit-scan, and sweep-scope suites, which import it.
- `references/templates/` and the two scripts its suite drives: `node --test tests/templates.test.ts`.
- Invocation-gate changes: `node --test tests/invocation-gate.test.ts`. This checks SKILL.md frontmatter, `agents/openai.yaml` policy, and the roster in `references/workflow/skill-conventions.md` together.

Change CLI, stdout, exit, and caller-facing contracts at their owners in the same edit. Use `references/scripts/<name>.md` for run-time helpers; use § *Source contracts* for maintainer-only contracts, installer behavior, and suite dependencies. Helper rationale belongs in its subsection there. Skills invoking helpers cite the contract path.

After corpus prose edits, run `node scripts/dup-check.ts .`. Resolve duplicate rules to a citation of their owner, or register intentional copies in `tests/dup-allow.json` under § *`scripts/dup-check.ts`*. The corpus includes both root rule files (§ *`scripts/corpus.ts`*). The one-home rule is [references/workflow/one-home.md](./references/workflow/one-home.md).

Cite the friction motivating a kit change: a `~/.local/state/agents-kit/session-findings-*.md` finding or a consumer-project task where it occurred. A failing test is the sole exemption; cite the failure. Without either, defer the addition. Keep this evidence in session or task records. A commit message never carries a friction citation (`skills/commit/SKILL.md` step 1 **Provenance**). The duplicate scan catches repetition, not unsupported growth; spend the friction citation when adding corpus prose.

Edit the authoritative owner. Update dependent consumers only when their consumed contract changes.

## Consumer lists

**Membership test: grep reconstructs the full membership.** Reverse-search `skills/`, `references/`, `scripts/`, `agents/`, and `CORE_RULES.md`. A list is derivable when search recovers every member. Uncited consumers or authored classification rationale make it semantic.

- **Remove derivable citation lists.** Header enumerations silently drift when new consumers omit themselves; derive them by search instead.
- **Keep semantic registries.** Each states which uncited consumer or authored classification prevents deriving its membership.
- **Mark sanctioned copies.** Name the copy and its mirror obligation at the owner; a change updates every affected copy together.

Derivable enumerations remain removed; find their consumers by reverse search:

- `references/workflow/task-layout.md` and `ticket-format.md`: former "Cited by" headers.
- `references/workflow/decomposition.md`: the former decompose-task citer sentence. A split of responsibilities is separate from membership.
- `references/workflow/agent-fanout.md`: review and maintain citers. The semantic write-mode registry is in `executor-routing.md`, beside `executor-contract.md` § *Bindings*.
- `references/workflow/verify-pipeline.md`: composite callers cite its path. Its header names the three supporting contracts.
- `references/workflow/task-store.md` § *Resolving `<kit-root>`*: helper callers cite the section at invocation; each chooses its unavailable-helper behavior.
- `references/engineering/rules.md`: loaders cite the overlay. Preserve the semantic `commit` exception: it cites Git discipline but does not load the overlay. Citation alone cannot establish membership.
- `references/documentation/rules.md`: loaders cite it; no semantic exception accompanies the list.
- `references/engineering/review.md` § *Findings output shape*: search finds review skills and `reviewer-contract.md` § *The return*, plus composites through review-code.

Semantic registries remain maintained for these reasons:

- `references/workflow/task-lifecycle.md` propagate list: `resume-task-reconcile` and `review-task-reconcile` act on status fields without citing this file.
- `references/workflow/context-schema.md` consumer registry: readers use section names without citing the schema. They include review-task, implement-task, resume-task, reconcile-task, reconciliation's annotation rows, reconciliation-sweep's scope rows, and the reconcile composites. Producers refine-idea, plan-task, and decompose-task cite it and remain derivable.
- `references/workflow/skill-conventions.md` § *Current members*: entries author classification reasons. Register each new member there.
- That file's § *The invocation gate*: gated skills are searchable, but deliberate non-members and placement criteria are authored. Record every opened or closed gate.
- `references/workflow/executor-contract.md` § *Bindings*: defines each consumer's unit, packet, edit surface, fallback, and merge order.
- `references/workflow/reviewer-contract.md` § *Consumers*: defines authorized reviewer launchers and consumers, checked by § *Launch packet*.
- `references/workflow/reconciliation.md` direction membership: keys the skill mappings in reconciliation-docs-to-reality.md and reconciliation-session-to-docs.md.
- `references/workflow/execution-loop.md` introduction: keys the consumer sections of execution-bindings.md.
- `references/workflow/domain-packs.md` § *The split*: classifies methodology-only spine skills rather than enumerating citations.
- `references/engineering/verification.md` gate-runner parenthetical: domain resolution reaches consumers without a direct citation. Fix-findings, implement-task, and implement also cite it directly.
- `references/documentation/verification.md` gate-runner parenthetical: likewise reached by domain resolution. Review-docs cites it to distinguish its judgment pass from mechanical tiers, not to run those tiers.
- `references/engineering/exploration.md` loader gloss: refine-idea reaches the recipe through ideation.md's § *Ground in what exists*, without citing this path.
- `references/engineering/execution.md` loader sentence: implement and fix-findings resolve the execution recipe through the shared loop.

Sanctioned copies require these mirror updates:

- `references/engineering/code-style.md` § *Comments*: `agents/executor.md` and `agents/executor.toml` embed the same condensed discipline for direct access. When that section changes, update both host adapters; its owner carries one mirror note covering both.
- `references/workflow/task-lifecycle.md` § *Status values*, `status-transitions.md` § *Terminal vs. live states*, and `reconciliation-compaction.md` § *Compaction (size trigger)*: update the status vocabulary, terminal set, and compaction trigger in `scripts/lifecycle-constants.ts` with their prose.
- `references/workflow/task-layout.md` § *One task, one flat folder*: update that module's recognition set and folder/record budgets together.
- `references/workflow/task-store.md` § *The root registry*: update that module's walk prunes and ordering with their prose.
- `references/workflow/task-archiving.md` and `task-backlog.md`, each under § *Recognizing the directory is case-insensitive*: update the module's container names together.

These seven homes carry eight mirror notes because scripts cannot consume prose definitions at run time. The per-constant import registry stays here, since no single home covers the other homes' values:

- `scripts/health-check.ts`: `PLAN_VOCAB`, `LIVE_STATUSES`, `TERMINAL_STATUSES`, `UNSTARTED_STATUS`, `RECORD_MAX_KB`, `RESULT_MAX_KB`, `TASK_MAX_KB`, `ARCHIVE_DIR`, `BACKLOG_DIR`, `classifyWalkEntry`.
- `scripts/task-move.ts`: `PLAN_VOCAB`, `TERMINAL_STATUSES`, `UNSTARTED_STATUS`, `ARCHIVE_DIR`, `BACKLOG_DIR`, `TASK_STORE_DIR`, `holdsRoleFile`, `classifyWalkEntry`.
- `scripts/task-state.ts`: `PLAN_VOCAB`, `RESULT_MAX_KB`.
- `scripts/commit-scan.ts` and `scripts/sweep-scope.ts`: `holdsRoleFile`.

Both walkers receive recognition and prunes through `classifyWalkEntry`. Direct `holdsRoleFile` callers test the supplied task folder; sweep-scope also distinguishes deliverables from role files. No script imports `WALK_SKIP_DIRS` directly. Task-move imports `TASK_STORE_DIR` for `boundingRoot`'s `.agents/tasks` bound, not as a prune. Compare this registry to actual import symbols when changing it.

- `references/workflow/reconciliation-commits.md` § *The watermark*, `task-delivery.md` § *Branch and worktree creation*, and `task-delivery-edges.md` § *Removal*: update commit-scan's pointer patterns with their prose. The shapes are `SHA <sha>`, `` branch `<branch>` ``, and `(removed …)`. Free prose offers no other structure for locating the floor and ref. Three owner notes cover one importer; stale patterns would produce `no-watermark` or scan HEAD instead of the recorded task branch.
