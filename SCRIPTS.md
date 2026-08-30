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
`scripts/pr-comments.ts`, `scripts/size-check.ts`, `scripts/worktree-merge.ts`, and
`scripts/cross-capability.ts`: 0 did the job, 1
is an outcome the script decided, 2 is a run that never got that far. The reporting scripts beside
them — `health-check.ts`, `session-triage.ts`, `size-report.ts`, and `cross-capability.ts`'s `check` —
always exit 0 instead, so a partly unreadable corpus still parses.

**stdout is asynchronous on a pipe**, so a script that emits a JSON report writes it and lets the
module end rather than calling `process.exit` after the write, which would discard whatever the pipe
buffer could not take — truncating a report above 64 KB. A reader that closes early then raises
EPIPE on a stream nothing awaits, and swallowing that is what keeps the promised exit status.

**No script calls `process.exit` to set a status**, and every one of them writes the reason for a
non-zero status before it assigns `process.exitCode`. An inline exit would set the status first and
discard whatever the stream had not yet flushed, so a refused run would report a code with nothing
saying why. `task-move.ts`, `task-state.ts`,
`pr-comments.ts`, `cross-capability.ts`, and `worktree-merge.ts` reach that by throwing — an `Exit`
carrying its code in the first four, `Refused`/`Unrunnable` in the last — which one handler at the
module's end catches, so every refusal leaves through one place. `size-check.ts` assigns the status directly at each of its two
sites instead.

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

## `scripts/cross-capability.ts`

Owns the cross-vendor capability cache that
`references/workflow/executor-engines-cross-vendor.md` § *Cross-run rules* defines: what the other
vendor's sandbox allowed, denied, or hung on in one repository, and the fingerprints that decide
whether that answer may still be believed. `record` writes one probe answer into it; `check` reads the
repository's entry against the engine facts in hand and reports what may still be believed; `sweep`
retires the per-engine files that predate the cache.

```
node scripts/cross-capability.ts check <repo> [--engine <e>] [--cli-version <v>] [--model <m>]
                                 [--effort <ef>] [--network-access true|false]
                                 [--network-proxy true|false] [--command "<pkg dir>: <cmd>"]...
node scripts/cross-capability.ts record <repo> --engine <e> --cli-version <v> --model <m>
                                 --effort <ef> --network-access true|false --network-proxy true|false
                                 --command "<pkg dir>: <cmd>" --answer allowed|denied|hung
                                 --classes <class> [--classes <class>]... [--binary <path>]
                                 [--state-pins <pin>]... [--config-files <repo-relative path>]...
                                 [--note <text>]
node scripts/cross-capability.ts sweep
```

`--classes`, `--state-pins`, `--config-files`, and `--command` each take one value and may repeat;
`record` takes exactly one `--command`, and a second is bad usage rather than a silently dropped
answer. `<repo>` is resolved to an absolute path and is the entry key.

**Where the cache lives.** `AGENTS_KIT_STATE_DIR` when it is set, otherwise
`~/.local/state/agents-kit` — per-machine run state, never config
(`references/workflow/task-store.md` § *The root registry*). The cache is that directory's
`cross-capability.json`, and `capabilities/*.json` beside it are the per-engine files that predate it.
The environment override is what lets the suite run against a fixture directory instead of the
machine's own state.

**The entry shape** is the cited file's, plus a per-answer `configFiles` list and the fingerprint over
it:

```json
{
  "<absolute repository path>": {
    "engine": "codex",
    "cliVersion": "codex-cli 0.149.1",
    "pin": { "model": "gpt-5.6-sol", "effort": "xhigh" },
    "lockfileSha256Prefixes": ["<one prefix per lockfile, in sorted path order>"],
    "configSha256Prefix": "<prefix over every answer's config files>",
    "sandbox": { "mode": "workspace-write", "networkAccess": true, "networkProxy": true },
    "probed": "2026-08-30",
    "answers": {
      "apps/web: ./node_modules/.bin/vitest run": {
        "classes": ["tool state outside the invocation root"],
        "answer": "allowed",
        "binary": "apps/web/node_modules/.bin/vitest",
        "statePins": ["<the pin that made the answer allowed>"],
        "configFiles": ["apps/web/vitest.config.ts"],
        "configSha256Prefix": "<prefix over this answer's config files alone>",
        "note": "<free text>"
      }
    }
  }
}
```

Everything above `answers` is required, as is each answer's `classes` (non-empty) and `answer` — one
of `allowed`, `denied`, `hung`; `binary`, `statePins`, `configFiles`, `configSha256Prefix`, and `note`
are optional. An entry missing any of that **reads as absent**, which is the cited file's own rule and
what makes trusting the rest of an entry safe.

**Why config files are recorded per answer.** The entry-level `configSha256Prefix` says the
configuration some answer read has moved; it cannot say whose, since a hash over a union does not
decompose. Recording each answer's own files, and the prefix over them at the moment that answer was
probed, is what lets a reader leave an answer whose configuration has not moved believable while the
entry as a whole is stale. A sibling answer keeps the prefix it was probed under and is never
re-fingerprinted by someone else's write: it is a snapshot of that probe, not a claim about the tree
now.

**`check` answers two questions at once**, because a caller has two: may this entry be believed at
all, and may *this* criterion's answer be believed. The entry verdict is `absent` — no cache file, no
entry for the repository, a cache that will not parse, or an entry failing the shape check — or
`stale` carrying the reasons that moved, or `match`. The reasons are `engine`, `cliVersion`, `pin`,
`sandbox`, `lockfiles`, and `config`; the first four are compared only where the run passed the fact
as a flag, since a fact nobody stated is not a fact this run knows, while the last two are recomputed
from the tree every time. Each `--command` gets its own verdict beside them: `absent` where the entry
holds no answer under that key, `stale` naming what moved, `match` otherwise, and the stored
`answer`, `binary`, and `statePins` are carried through so a caller that is going to seed a run does
not read the cache file itself.

**Why a command can match under a stale entry.** Everything but `config` is a fact about the engine,
so it moves every answer the entry holds and every command verdict inherits it. `config` is a fact
about the repository, and the answers do not all read the same configuration: an answer carrying its
own `configFiles` is compared against its own recorded prefix, so the answer whose configuration moved
goes `stale` and its siblings stay `match` while the entry above them says `stale (config)`. An answer
listing no config files, or one recorded before per-answer prefixes existed, inherits the entry's
`config` verdict instead — attribution is impossible there, and the safe direction is the one that
re-probes. A listed file that is no longer on disk is reported as `config file missing: <path>` on
that answer, which says which file to look for rather than only that something moved.

**Legacy files are named, never read.** Every `<state dir>/capabilities/*.json` is listed in `legacy`,
in sorted order and by absolute path, so a caller can see what is left to retire; nothing in them
contributes a verdict, which is what keeps a repository recorded only in a pre-cache file reading
`absent` and re-probing rather than trusting a shape this script cannot check.

**Contract.** `check` writes exactly one JSON object to stdout,
`{"repo":…,"entry":"match|stale|absent","reasons":[…],"legacy":[…],"commands":{…},"summary":…}`, each
command `{verdict,reasons?,answer?,binary?,statePins?}`, and always exits 0 once a report is written —
a caller reads the verdict, never a status. `summary` is that report in one line for a close-out to
quote: `entry stale (lockfiles); commands: 2 match, 3 stale, 1 absent`, with `commands: none` where no
`--command` was passed and a trailing `legacy: N` where any legacy file is still there. Bad usage
exits 2.

**`record` merges one answer into the repository's entry.** Sibling answers are carried over whole and
keep their order, the named key is the only one replaced, and other repositories' entries in the same
file are preserved exactly as parsed — valid or not, since a shape this script does not recognize is
still somebody's record. Where the target repository's own entry fails the shape check it is replaced
wholesale rather than patched, which is the same call as reading it absent.

**What `record` refuses** — exit 1, one line on stderr, nothing written: a `<repo>` that is not a
directory on this machine, because a mistyped repository path would file the answer under a key no
`check` will ever match while the intended repository silently keeps none; an answer carrying no
`--classes`, because a class nobody probed must re-probe and an answer naming none answers for
nothing; an `--answer` outside the three values; and `package-manager wrapper egress` on a command
recorded with `--binary`, because a criterion that runs the resolved binary makes no wrapper call, and
recording the class there files a denial the next run cannot reproduce. A `--config-files` path with
no file under `<repo>` is refused for the same reason — a fingerprint over a file that is not there
would say the configuration is unchanged forever. A cache file holding no JSON object is refused
rather than replaced: other repositories' entries live in it.

**Fingerprints are recomputed on every write**, never carried forward, both sha256 truncated to the
first 16 hex characters. `lockfileSha256Prefixes` takes one prefix per dependency lockfile —
`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`, `npm-shrinkwrap.json` —
discovered with `git ls-files` across the whole checkout and hashed in sorted path order; where git
will not run, or the repository is not a checkout, only the repository root is scanned, which is the
one place a lockfile can be without something tracking it. `configSha256Prefix` hashes
`<path>\0<content>\0` per file over the sorted unique union of every answer's `configFiles`, so a file
two answers both read counts once, and an entry whose answers list none hashes the empty input.

**Engine facts arrive as flags, by design.** The script reads no engine configuration: codex's TOML
and Claude's settings are the caller's to read, and a fact an engine adds later becomes one more flag
rather than a parser this file has to keep current. `sandbox.mode` has no flag because nothing
compares it — a merge carries the entry's existing mode forward, and a fresh entry takes
`workspace-write`, the mode the cited file's own example records.

**`probed` is when the answers last changed**, not when they were last confirmed: every write stamps
today's UTC date. Staleness is the fingerprints' job, so a re-probe that confirms an unchanged answer
is not what that date is for.

**The write is one rename.** The merged cache goes to `<cache>.tmp` beside the file and is renamed
over it, so a reader never sees half a cache and a failed write leaves the previous one whole. The
temp name is fixed rather than randomized, which makes the failure path reachable from a test and
costs only what concurrent writers would cost anyway: two runs racing on a single-user state file lose
one update, and a lost update re-probes — the cache is never the authority.

**Contract.** A completed `record` writes one line to stdout, `recorded <key> (<answer>) for <repo>`,
and exits 0. A refused one writes its one-line reason to stderr and exits 1, having changed nothing.
Exit 2 is a run that never got that far — bad usage, or a write that failed.

**`sweep` retires the legacy files** `check` can only name: it removes every
`<state dir>/capabilities/*.json`, writes `removed <absolute path>` per file in the same sorted order
`check` lists them — as each removal happens, so a removal that fails midway still reports the files
already gone — and removes the directory once nothing is left in it. Anything else there — a
file that is not a `.json`, a subdirectory — is left alone, and the directory then stays with it,
since the sweep's business is the answers this cache replaced and not the directory itself. It takes
no arguments and touches no other path: not `cross-capability.json`, and nothing outside the state
directory. Nothing to remove is the ordinary case, and it prints nothing and exits 0 rather than
reporting an empty sweep as a failure. Exit 2 is a removal that could not be carried out — bad usage,
or an unexpected failure; `sweep` reaches no outcome it would report as 1.

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

These markdown-reading constants and helpers are mirrored in `scripts/task-state.ts`, and the fence
and status halves again in `scripts/task-move.ts`. Those readers must agree with this one: this
walk's dead-anchor check against task-state's `anchorResolves`, and its terminal read against
task-move's archive gate. **Change a copy here and change every mirror in the same edit.**

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
- **`UNSTARTED_STATUS`** — the backlog entry gate (`references/workflow/task-backlog.md`) and the
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

**Contract.** stdout is one JSON object `{flagged, remainder, remainderPaths, scanned,
skippedUnknownRecords, skippedUnrecognized, skippedUnrecognizedPaths, unreadable, unreadableDirs,
unreadablePaths}` — `flagged` is the ranked top slice, `remainderPaths` names every flagged session
beyond it, and `unreadable` counts every in-window transcript and directory this run could not read
(`unreadablePaths` and `unreadableDirs` name them), so a caller advancing a since-marker can tell that
work was missed rather than cleared. `skippedUnrecognizedPaths` names the files whose host could not
be sniffed — reported, but outside that gate, since they would not sniff on a later run either.
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
node scripts/size-check.ts [--update] [--baseline FILE] <kit-root>
```

**Modes.** Without `--update`, each skill's hot, cold, and transitive byte totals are compared against
the baseline (default: `<kit-root>/tests/size-baseline.json`): any difference — a grown or shrunk
total, a skill missing from the baseline, a baseline entry no longer in the kit — prints one line to
stdout and the run exits 1 with a re-capture hint. `--update` rewrites the baseline from the current
measurement instead. Shrinkage fails the check on purpose: the baseline stays current only if every
change that moves a total re-captures it in the same change, which is what keeps the diff — and the
growth it would reveal — reviewable.

Hot and cold are ratcheted apart because moving a citation between them leaves the transitive total
where it was: recorded as one number, the very change this ratchet exists to expose — what a skill
pays on every invocation — would be the change it could not see.

The baseline holds totals only (`{skill, hot/cold/transitive {bytes, approxTokens}}`, sorted as the
report emits them): per-file lists would churn on every edit without making the ratchet stricter.

**Exit status.** 0 = clean (or baseline written), 1 = drift, 2 = the check could not run — no kit
root, no baseline to check against, an unreadable measurement, or a measurement whose `unresolved`
list is non-empty (a partly measured kit would anchor a baseline below the truth).

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

**Contract.** stdout is exactly one JSON object,
`{"root":<absolute kit root, or null>,"skills":[…],"warnings":N,"unresolved":[…]}`. Each skill is
`{skill,hot:{files,bytes,approxTokens},cold:{…},transitive:{…}}`, and each `files` entry is
`{path,bytes,approxTokens}` with `path` relative to the kit root — hot and cold in citation order,
transitive in breadth-first order. `unresolved` names every citation that reached no readable file as
`"<citing file> -> <citation>"`, and a file whose own contents could not be read as
`"<file> -> (contents)"`, so a byte total is never read as complete coverage while it is non-empty.

**Which directories are skills.** Only a genuinely absent `SKILL.md` marks a directory as not a
skill. Every other miss — `EACCES`, a `SKILL.md` that is itself a directory, a dangling symlink, where
the stat fails while `lstat` still sees the link — is a skill the report would otherwise omit
with no trace, so it is recorded as `unresolved` instead of silently narrowing the walk. That is what
`scripts/size-check.ts` keys its incomplete-measurement refusal on: fold those misses into the
non-skill case and `unresolved` stays empty, the refusal never fires, and a baseline is captured over
a kit whose unreadable skills were dropped. A `--skill` name matching nothing is likewise reported as
a warning rather than narrowing the report to nothing, so a typo never reads as a skill that loads no
context.
Warnings go to stderr and the exit status is always 0, so a partly unreadable kit still parses.

## `scripts/task-move.ts`

Performs one guarded task-folder move for the `archive-task` and `backlog-task` skills: the
location-relative relocation into a sibling `Archive/` or `Backlog/` container defined by
`references/workflow/task-archiving.md` and `references/workflow/task-backlog.md`, with the
preconditions those files state — a terminal plan to archive, the unstarted entry gate to park.

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

```
node scripts/task-state.ts <task-dir>
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

**Exit status.** 0 = a report was written; 1 = nothing to report, because the argument names no
readable `plan.md`; 2 = the run could not be carried out — bad usage, or an unexpected failure. A
crash must not land on 1, which would report a readable plan folder as having none. Warnings go to
stderr.

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

## `tests/`

Every suite is zero-dependency and runs under Node type stripping, like the sources it covers.

```
node --test tests/<name>.test.ts        # one suite
node --test "tests/*.test.ts"           # every suite — quoted, because the runner takes glob
                                        # patterns and resolves a bare directory as a module path
```

- **`setup-install.test.ts`** — `setup.ts`: what the installer deploys, what it reclaims, and what
  it refuses to touch.
- **`cross-capability.test.ts`** — `scripts/cross-capability.ts`: the cross-vendor capability cache —
  `record`'s merge, its refusals, the two fingerprints, `check`'s entry and per-command verdicts,
  `sweep`'s bounded removal, and the 0/1/2 exit contract. Every case runs
  the script against a fixture state directory through `AGENTS_KIT_STATE_DIR`, so no case can reach
  `~/.local/state`; the lockfile-discovery cases fixture a real `git init` checkout beside a plain
  directory, because the two discovery paths are what the fingerprint depends on.
- **`health-check.test.ts`** — `scripts/health-check.ts`: the task-lifecycle walk and the
  `--installs` deploy-drift check.
- **`task-move.test.ts`** — `scripts/task-move.ts`: the guarded archive and backlog moves, their
  preconditions, and the 0/1/2 exit contract.
- **`task-state.test.ts`** — `scripts/task-state.ts`: the plan-state report — checkbox state, next
  pending step, checkpoint outcomes, result-anchor resolution, goal coverage — and its 0/1/2 exit
  contract. The CLI cases run fixture task folders end to end; the parsing variants call the exported
  pure layer directly, which needs no folder on disk.
- **`session-triage.test.ts`** — `scripts/session-triage.ts`: transcript triage, its six signal
  classes, and its ranking.
- **`pr-comments.test.ts`** — `scripts/pr-comments.ts`: the two-level page merge, the normalized JSON
  contract it emits, the argument forms, and the `gh` invocations the fetch walks build.
- **`size-report.test.ts`** — `scripts/size-report.ts`: the per-skill context-load measurement and
  its JSON contract.
- **`size-check.test.ts`** — `scripts/size-check.ts`: the context-size baseline ratchet and its
  0/1/2 exit contract.
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
