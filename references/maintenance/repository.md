# Repository maintenance

Maintainer-only guidance for the source checkout. Load only the section relevant to the edit; installed runtime skills do not load this file.

Paths without `./` are relative to the source checkout. Entry rules and the supported Node floor remain in root `AGENTS.md`.

## Ownership

- `skills/<name>/SKILL.md` owns the skill's protocol and direct reference citations.
- `references/workflow/` owns shared workflow methodology. Its `references/workflow/domain-packs.md` defines the domain-pack interface.
- `references/<domain>/` owns domain guidance.
- `references/templates/` owns the five copy-ready task-file shapes. Each file's contracting workflow reference owns its rules.
- `setup.ts` owns installation and distribution. This file's § *Source contracts* owns its CLI, stdout, exit behavior, and rationale.
- `.claude-plugin/` owns the Claude Code plugin and its single-plugin marketplace. The plugin root is the repository root, so skill `./AGENTS.md` and `./references` links resolve inside the plugin cache. Neither manifest pins `version`, so every commit is a new version for `/plugin update`.
- `scripts/` owns zero-dependency Node helpers. For a helper skills run, `references/scripts/<name>.md` owns CLI and stdout contracts, installed with other references. Its `references/maintenance/scripts.md` section owns rationale and mirror notes. For maintainer-only helpers, that section owns all three. Sources carry no comments; change a contract at its owner in the same edit.
- `tests/` owns verification. `references/maintenance/tests.md` explains suite commands and dependencies; § *Change routing* maps scripts to suites. `tests/dup-allow.json` records intentional prose mirrors, each entry explaining why its copy stays.
- `.agents/tasks/` owns task artifacts and active work context.

## Type stripping and verification

Unflagged type stripping also works from 22.18. A single supported floor avoids carrying two branches; it is a support choice, not a code limitation. Below either threshold, parsing a type annotation fails without a version message. Under `node --test`, the globbed suites match and then fail to load for the same reason.

Annotations are erased, not validated. The engineering pack's typecheck, lint, and build recipe has no target here (`references/engineering/rules.md` § *Before presenting changes*). Its test command does: `node --test "tests/*.test.ts"` covers the whole verification surface.

No linter, formatter, or graph-aware runner exposes a narrowing class, so every boundary runs that whole-tree command. `references/engineering/boundary-scope.md` § *Reference and delta* still writes each boundary's manifest; here it narrows nothing and serves only the commit gate's reuse. Adding a checker would introduce `package.json`, a lockfile, and `node_modules` into a Markdown-and-TypeScript tree. That dependency cost is why checking was declined; weigh it again if revisiting the decision.

## Source contracts

Run-time helper contracts live in `references/scripts/<name>.md`. This section holds shared conventions and installation behavior. `references/maintenance/scripts.md` holds maintainer-only helper contracts, helper rationale, and mirrors. `references/maintenance/tests.md` holds suite commands and dependencies. Read the relevant helper or suite section before editing its source. Callers read decisions in these places before assembling commands; sources contain no comments.

`setup.ts` installs `CORE_RULES.md` as shared-rule skills' `./AGENTS.md` target. Keep maintainer citations as source-root-relative text; they do not add runtime reading.

### Shared conventions

**Zero dependencies; direct Node type stripping.** The supported floor is stated in root `AGENTS.md` § *The `.ts` sources are unchecked by design*.

**Exit conventions.** `task-move.ts`, `task-state.ts`, `pr-comments.ts`, `dup-check.ts`, `worktree-merge.ts`, and `secretary-state.ts` share 0/1/2. Zero completes the job; 1 reports a decided outcome; 2 means the run could not reach that decision. `commit-scan.ts` and `sweep-scope.ts` use only 0 and 2 because their reports are not decided outcomes. `health-check.ts` and `session-triage.ts` always exit 0, keeping reports parseable when part of the corpus is unreadable.

**Piped stdout is asynchronous.** After emitting JSON, let the module end so buffered output flushes. Calling `process.exit` would truncate reports exceeding the pipe buffer, often 64 KB. Swallow EPIPE and ENOTCONN from readers closing early so that unawaited stream error does not change the promised status.

**No script calls `process.exit` to set status.** Write the non-zero reason before assigning `process.exitCode`, preserving both the explanation and pending output. `task-move.ts`, `task-state.ts`, `pr-comments.ts`, `commit-scan.ts`, `sweep-scope.ts`, and `secretary-state.ts` throw an `Exit` carrying the code. `worktree-merge.ts` throws `Refused` or `Unrunnable`. One handler at each module's end reports every refusal. `dup-check.ts` handles thrown `Refused` as status 2, but assigns status 1 after writing its findings report. `task-state.ts --repair` also writes its JSON report first, carrying the reason in `unresolved` or `error`. It then assigns status 1 or 2 directly instead of throwing `Exit`.

`executor-run.ts` uses process-specific 0/1/2 meanings defined in `references/scripts/executor-run.md`. It emits its receipt before assigning `process.exitCode`.

### `setup.ts`

Installs skills, `references/`, `CORE_RULES.md`, and native agent definitions into `~/.claude` and `~/.codex`. Ownership markers let later runs reclaim installed items while preserving user content.

```
node setup.ts
```

**Contract.** stdout names each home and every installed or skipped item; stderr names refused homes. Exit 0 means every home installed; 1 means at least one home was skipped.

**Why the staging dirs.** Skills stage under `skills/.agents-kit-staging.*`; references stage under the home's `.agents-kit-references.staging.*`. Each staging directory contains its marker before atomic rename, preventing a visible unmarked payload. An interrupted run leaves staging directories that the next sweep removes under both prefixes. `CORE_RULES.md` and agent definitions instead use `touchMarker` followed by `copyFileSync` at their visible paths. They use neither staging nor rename, so interruption mid-copy can leave a partial marked file.

**Why a home is refused.** Skills using shared rules symlink `./AGENTS.md` and `./references` to install-root siblings. User-owned replacements would redirect those loads into non-kit content, so the installer refuses that entire home. A kit-owned `skills/` symlink is reclaimed, including links into this repository, dangling leftovers, or moved clones. Other `skills/` symlinks are refused because installing through them would dangle the per-skill links.

**Why the copy modes differ.** Skills use `verbatimSymlinks` to preserve relative targets. Without it, `cpSync` rewrites them as absolute checkout paths instead of resolving inside the installed home. References contain no symlinks and use `dereference`. References and core rules remain available during the skills loop; each is replaced only at its own installation site. The references replacement is staged before removing its predecessor.

**Why the reclaim sweep skips a symlinked entry.** `isDirectory` follows links, so a linked skill entry reaches the sweep as a directory. Following its target to an `.agents-kit` marker would wrongly claim and remove the user's link. The skip preserves links the kit did not install, even when their targets contain markers; `tests/setup-install.test.ts` pins this behavior.

**Why reclaiming a kit-owned `skills/` link uses `unlinkSync`.** Only the link is removed. `rmSync` rejects links targeting directories with `ERR_FS_EISDIR`; every reclaimable non-dangling link has that shape. Ownership requires an absolute target named `skills` whose parent contains `setup.ts`, `CORE_RULES.md`, and `references/`. This recognizes a clone that has moved since installation.

**Why each replacement removes before it renames.** `renameSync` cannot replace a non-empty directory. Removing references first permits the rename, leaving an absence window one rename wide. Core rules need no removal: `copyFileSync` overwrites the regular file after the conflict gate excludes an unmarked predecessor. Writing its marker first prevents an unmarked visible payload.

**Why the agent sweep is marker-driven.** The marker alone establishes ownership. Sweep each definition with its marker, reclaiming installs interrupted between the two writes. The copy loop preserves and skips any same-named unmarked file.

## Change routing

Root `AGENTS.md` § *Change routing* owns the pre-edit inspection, reverse-search, and dup-check rules. This section holds the suite map and the reasons behind those rules.

Git history preserves existing contract reasons. Installation changes include `setup.ts`, native agent definitions, and installed payload behavior. Their checks hardcode markers, payload categories, and per-host agent extensions, so `tests/setup-install.test.ts` and `scripts/health-check.ts` change together.

Run the suite covering each changed surface:

- `setup.ts`: `node --test tests/setup-install.test.ts`.
- `scripts/health-check.ts`: `node --test tests/health-check.test.ts`.
- `scripts/task-move.ts`: `node --test tests/task-move.test.ts`.
- `scripts/task-state.ts`: `node --test tests/task-state.test.ts`, plus health-check and sweep-scope suites for its exported helpers.
- `scripts/goal-structure.ts`: task-state, health-check, sweep-scope, and templates suites; its reference classification also governs task-repair.
- `scripts/task-repair.ts`: task-state, health-check, and sweep-scope suites, because task-state imports it for the direct CLI.
- `scripts/commit-scan.ts`: `node --test tests/commit-scan.test.ts`.
- `scripts/sweep-scope.ts`: `node --test tests/sweep-scope.test.ts`.
- `scripts/session-triage.ts`: `node --test tests/session-triage.test.ts`.
- `scripts/pr-comments.ts`: `node --test tests/pr-comments.test.ts`.
- `scripts/dup-check.ts` or its `corpus.ts` import: `node --test tests/dup-check.test.ts`.
- `scripts/worktree-merge.ts`: `node --test tests/worktree-merge.test.ts`.
- `scripts/secretary-state.ts` or `references/scripts/secretary-state.md`: `node --test tests/secretary-state.test.ts`, plus the start-secretary suite, which runs the skill's helper commands.
- `scripts/executor-run.ts`, `references/scripts/executor-run.md`, or `agents/executor.md`: `node --test tests/executor-run.test.ts`.
- `scripts/lifecycle-constants.ts`: health-check, task-move, task-state, commit-scan, sweep-scope, and templates suites, which cover its seven importers.
- `references/templates/` and the three scripts its suite drives: `node --test tests/templates.test.ts`.
- `skills/review-pr-loop/SKILL.md` or `references/workflow/delegated-waiting.md`: `node --test tests/review-pr-loop.test.ts`.
- `references/engineering/review-evidence.md`, `references/engineering/review.md`, `references/workflow/user-facing-messages.md`, `references/workflow/reviewer-contract.md`, `references/workflow/verify-pipeline.md`, `references/workflow/executor-contract.md`, `skills/review-code/SKILL.md`, `skills/review-code-triage-verify/SKILL.md`, `skills/publish-pr-review/SKILL.md`, `skills/review-pr-loop/SKILL.md`, `skills/triage-findings/SKILL.md`, or `skills/fix-findings/SKILL.md`: `node --test tests/review-evidence.test.ts`.
- `skills/start-secretary/SKILL.md`, `references/workflow/secretary-contract.md`, `README.md` § *Secretary*, `agents/secretary.md`, `agents/secretary.toml`, `references/workflow/skill-conventions.md`, or `references/workflow/domain-packs.md`: `node --test tests/start-secretary.test.ts`.
- Invocation-gate changes: `node --test tests/invocation-gate.test.ts`. This checks that no SKILL.md frontmatter or `agents/` policy file closes a host door, and that the `**Confirm-gated skills:**` roster in `references/workflow/skill-conventions.md` matches the skills carrying the `**Model invocation:**` line.

Helper rationale belongs in its `references/maintenance/scripts.md` section. Skills invoking helpers cite the contract path.

The dup-check corpus includes both root rule files and these maintenance references (`references/maintenance/scripts.md` § *`scripts/corpus.ts`*). The one-home rule is `references/workflow/one-home.md`.

## Consumer lists

Root `AGENTS.md` § *Consumer lists* owns the derive, retain, and mirror rules. A list is derivable when reverse search recovers every member; uncited consumers or authored classification rationale make it semantic. Header enumerations drift when new consumers omit themselves, so derivable lists are removed. A semantic registry states which uncited consumer or authored classification prevents deriving its membership.

These owners keep no derivable citation list; find their consumers by reverse search:

- `references/workflow/task-layout.md` and `references/workflow/ticket-format.md`: no "Cited by" header.
- `references/workflow/decomposition.md`: no citer sentence. A split of responsibilities is separate from membership.
- `references/workflow/agent-fanout.md`: review and maintain citers. The semantic write-mode registry is in `references/workflow/executor-routing.md`, beside `references/workflow/executor-contract.md` § *Bindings*.
- `references/workflow/verify-pipeline.md`: composite callers cite its path. Its header names the three supporting contracts.
- `references/workflow/task-store.md` § *Resolving `<kit-root>`*: helper callers cite the section at invocation; each chooses its unavailable-helper behavior.
- `references/engineering/rules.md`: loaders cite the overlay. `commit` cites its Git discipline but does not load the overlay. Preserve that semantic exception in `references/workflow/domain-packs.md` § *Which skills resolve a domain vs. load a fixed pack*. Citation alone cannot establish membership.
- `references/documentation/rules.md`: loaders cite it; no semantic exception accompanies the list.
- `references/engineering/review.md` § *Findings output shape*: search finds review skills and `references/workflow/reviewer-contract.md` § *The return*, plus composites through review-code.

Semantic registries remain maintained for these reasons:

- `references/workflow/task-lifecycle.md` propagate list: `resume-task-reconcile` and `review-task-reconcile` act on status fields without citing this file.
- `references/workflow/context-schema.md` consumer registry: readers use section names without citing the schema. They include review-task, implement-task, resume-task, reconcile-task, reconciliation's annotation rows, reconciliation-sweep's scope rows, and the reconcile composites. Producers refine-idea, plan-task, and decompose-task cite it and remain derivable.
- `references/workflow/skill-conventions.md` § *Current members*: entries author classification reasons. Register each new member there.
- That file's § *The invocation gate*: confirm-gated skills are searchable by their `**Model invocation:**` line, but the skills gating their own write another way and the placement criteria are authored. Record every confirm gate added or removed.
- `references/workflow/executor-contract.md` § *Bindings*: defines each consumer's unit, packet, edit surface, fallback, and merge order.
- `references/workflow/reviewer-contract.md` § *Consumers*: defines authorized reviewer launchers and consumers, checked by § *Launch packet*.
- `references/workflow/secretary-contract.md` § *Consumers*: defines the one authorized secretary launcher.
- `references/workflow/reconciliation.md` direction membership: keys the skill mappings in reconciliation-docs-to-reality.md and reconciliation-session-to-docs.md.
- `references/workflow/execution-loop.md` introduction: keys the consumer sections of execution-bindings.md.
- `references/workflow/domain-packs.md` § *The split*: classifies methodology-only spine skills rather than enumerating citations.
- `references/engineering/verification.md` gate-runner parenthetical: domain resolution reaches consumers without a direct citation. Fix-findings, implement-task, and implement also cite it directly. Commit cites § *What a boundary records* only to read a boundary's `manifest written` line, not to run the recipe.
- `references/documentation/verification.md` gate-runner parenthetical: reached by domain resolution and fix-findings' per-fix routing. Review-docs cites it to distinguish its judgment pass from mechanical tiers, not to run those tiers.
- `references/engineering/exploration.md` loader gloss: refine-idea reaches the recipe through ideation.md's § *Ground in what exists*, without citing this path.
- `references/engineering/execution.md` loader sentence: implement and fix-findings resolve the execution recipe through the shared loop.

Sanctioned copies require these mirror updates:

- `references/engineering/code-style.md` § *Comments*: `agents/executor.md` and `agents/executor.toml` embed the same condensed discipline for direct access. When that section changes, update both host adapters; its owner carries one mirror note covering both.
- `references/workflow/task-lifecycle.md` § *Status values*, `references/workflow/status-transitions.md` § *Terminal vs. live states*, and `references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)*: update the status vocabulary, terminal set, and compaction trigger in `scripts/lifecycle-constants.ts` with their prose.
- `references/workflow/task-layout.md` § *One task, one flat folder*: update that module's recognition set and folder/record budgets together.
- `references/workflow/task-store.md` § *The root registry*: update that module's walk prunes and ordering with their prose.
- `references/workflow/task-archiving.md` and `references/workflow/task-backlog.md`, each under § *Recognizing the directory is case-insensitive*: update the module's container names together.

These seven homes carry eight mirror notes because scripts cannot consume prose definitions at run time. The per-symbol import registry stays here, since no single home covers the other homes' values:

- `scripts/health-check.ts`: `PLAN_VOCAB`, `LIVE_STATUSES`, `TERMINAL_STATUSES`, `UNSTARTED_STATUS`, `RECORD_MAX_KB`, `RESULT_MAX_KB`, `TASK_MAX_KB`, `ARCHIVE_DIR`, `BACKLOG_DIR`, `classifyWalkEntry`, `angledTargetText`.
- `scripts/task-move.ts`: `PLAN_VOCAB`, `TERMINAL_STATUSES`, `UNSTARTED_STATUS`, `ARCHIVE_DIR`, `BACKLOG_DIR`, `TASK_STORE_DIR`, `holdsRoleFile`, `classifyWalkEntry`.
- `scripts/task-state.ts`: `PLAN_VOCAB`, `RESULT_MAX_KB`.
- `scripts/commit-scan.ts`: `holdsRoleFile`.
- `scripts/sweep-scope.ts`: `holdsRoleFile`, `angledTargetText`.
- `scripts/task-repair.ts`: `holdsRoleFile`, `WALK_SKIP_DIRS`.
- `scripts/goal-structure.ts`: `holdsRoleFile`.

Both walkers receive recognition and prunes through `classifyWalkEntry`. Commit-scan and sweep-scope call `holdsRoleFile` on the supplied task folder; sweep-scope also distinguishes deliverables from role files. Task-repair calls it on each subfolder to skip nested tasks, and imports `WALK_SKIP_DIRS` for the same prune. Goal-structure calls it to tell a deliverable from the role files. Task-move imports `TASK_STORE_DIR` for `boundingRoot`'s `.agents/tasks` bound, not as a prune. Health-check and sweep-scope import `angledTargetText` to share angle-target trimming, which no prose home defines (`references/maintenance/scripts.md` § *`scripts/health-check.ts`*). Compare this registry to actual import symbols when changing it.

- `references/workflow/reconciliation-commits.md` § *The watermark*, `references/workflow/task-delivery.md` § *Branch and worktree creation*, and `references/workflow/task-delivery-edges.md` § *Removal*: update commit-scan's pointer patterns with their prose. The shapes are `SHA <sha>`, `` branch `<branch>` ``, and `(removed …)`. Free prose offers no other structure for locating the floor and ref. Three owner notes cover one importer; stale patterns would produce `no-watermark` or scan HEAD instead of the recorded task branch.
- `references/workflow/task-store.md` § *The root registry*: update `scripts/secretary-state.ts`'s `runbookRoot` resolution in `openStore` with the `runbookRoot` bullets. A stale copy would accept a path the registry rejects or refuse one it allows.
