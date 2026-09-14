---
name: maintain
description: Use when asked to maintain agents-kit and its task store. Reports format, health, install drift, uncommitted work, leftover worktrees, and recent session misbehavior across registered roots. Auto-applies only its run marker; every other change requires confirmation. Never commits.
argument-hint: '[kit path and/or task-root path — defaults to the registered roots]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.

Run four phases in order: kit task-format sweep, health sweep, active-task listing, and session analysis. Work on task envelopes, lifecycle bookkeeping, store artifacts, and session logs. Resolve no Domain pack, invoke no sibling skill, and reconcile no task content; hand that work to `resume-task-reconcile` in **Next**.

Report first. Only the `.maintain-last-run` marker updates without confirmation, as derived run metadata. Preview and confirm every other mutation separately, or hand it off: format fixes, archive moves, installation, worktree removals, findings-file writes, and folder removals. Detection authorizes reporting, never automatic document edits or deletion.

The only Git writes are confirmed removal of spent task worktrees and their branches, or recorded branches whose worktrees are gone. The removal predicate may first run `git fetch origin <default-branch>`, updating only that remote-tracking ref. Never add, commit, push, checkout, stash, or revert in any repository. Report dirty paths for the user to handle.

Every phase runs inline under its cited contracts. Print one progress line per phase and retain every confirmation gate. Consolidate findings in **Output**, with one **Next**. Apply only the phase-specific overrides below.

## Setup — resolve targets

Resolve and existence-check targets, then print one setup line with paths and labels. Read `./references/workflow/task-store.md` § *The root registry*.

- **Kit root:** use the source checkout, with an argument holding `setup.ts` overriding configuration. When resolving the configured checkout, apply `./references/workflow/task-store.md` § *Resolving `<kit-root>`*. An installed home cannot substitute. <!-- cold -->
- **Task roots:** use all configured `taskRoots` with their labels; other path arguments add task roots. Name each absent registered path as skipped and continue with the rest.

Without configuration, name `~/.config/agents-kit/config.json` and `/init-config`, then continue on the kit's canonical root (`./references/workflow/task-layout.md` § *One task, one flat folder*). With no kit root either, say so and stop. Do not guess task roots.

Keep run state under `~/.local/state/agents-kit/`, including `.maintain-last-run` and session-findings files. Neither task roots nor the configuration directory hold this state.

Phase 2 always checks `~/.claude` and `~/.codex`; these are fixed install homes, not arguments or questions. Report an absent home as uninstalled.

## Phase 1 — Format-conformance sweep (kit)

Sweep only `<kit-root>/.agents/tasks/`, including its groups. Other registered roots receive Phase 2 detection, not format transforms. An absent canonical root means no sweep; report the absence, not a clean result.

**Derive the format at run time** from `./references/workflow/`:

- `task-layout.md`, `task-goals.md`, `task-observations.md`, `doc-task-files.md`, and `task-siblings.md` for folder and role-file shapes.
- `task-archiving.md`, `task-backlog.md`, and `task-store.md` for containers, store files, and § *Shared group context*.
- `task-lifecycle.md` and `task-authorship.md` for status and Current-state requirements.
- `context-schema.md`, `ticket-format.md`, or `acceptance-criteria.md` when classifying their internal shapes.

Use those sources, not remembered formats. Surface any expected rule without a documented home; do not enforce it. Legacy names below are the sole recognition exception.

**Classify** top-level directories and task leaves inside groups at every depth. A directory without role files is a group when it holds `GROUP_CONTEXT.md` or **holds a task** under `./references/workflow/task-destinations.md` § *A matched project area*. Count archived and backlogged descendants for occupancy. Archive/Backlog containers, matched case-insensitively, are traversed as containers rather than classified as tasks.

A group is not migrated, renamed, or proposed for removal. Report it only for an unsupported shared-prose file under needs-judgment below; otherwise print nothing for it. A group with `GROUP_CONTEXT.md` remains a group even without tasks, whether registered or not.

Assign each task folder exactly one label:

- **conformant:** matches the derived format; absent optional files are permitted.
- **structurally-fixable:** only lossless, content-free transforms are needed. Rename role files, normalize case, repoint within-folder role links, or normalize a container's case when no distinct canonical container exists. Apply container normalization at every reached depth, including groups.
- **needs-judgment:** content must be derived, remapped, or deleted; a distinct destination file collides; or classification remains uncertain. Examples include assigning goal IDs, extracting criteria, changing status, stripping headers, and creating Current state. Unsupported shared prose such as `PROJECT.md` is reported against its group. Two distinct containers of one kind, such as `archive/` and `Archive/`, also require judgment; leave both intact.
- **stray:** no task content, role file, renameable legacy suffix form, or nested task exists. Flag for removal, never auto-delete. A `GROUP_CONTEXT.md` group cannot be stray.

**Judgment takes precedence:** leave the whole folder untouched when any judgment issue exists, even if some structural fixes are straightforward.

Permitted transforms:

- Match `*.plan.md`, `*.result.md`, and `*.ticket.md` by suffix, independent of the folder's slug. Rename case variants to their current role names.
- Rename `spec.md` or `*.spec.md` only when already goal-shaped; otherwise classify needs-judgment.
- Repoint every header and in-body link naming a renamed file or reaching this folder's own role file without its `./`-relative role name. Include plan-step result links. Preserve anchors verbatim, surrounding prose, and cross-folder targets. The sole label change is `**Spec:**` to `**Goals:**`.
- Leave lifecycle-conformant prose placeholders in link headers alone; do not invent links to absent files.
- Treat a case-only path alias as a rename, not a collision. Use a temporary name if the filesystem requires it. A distinct destination file remains a collision.

Preview all operations as concrete `old → new` lines. On the phase's single confirmation, apply exactly that list. Without operations or container renames, skip the gate and continue, carrying judgment and stray findings forward. Declining applies nothing. Delete no content, rewrite no prose or status, and mutate no Git state. Re-running on conformant folders must change nothing.

## Phase 2 — Health sweep (tasks, installs, git, worktrees)

Run the four probes below. Interpret `scripts/health-check.ts` JSON through `./references/scripts/health-check.md`, including `unreadablePaths`. Findings do not establish coverage; `scanned` is a floor when `unreadable` is non-zero. Detection changes no disk content; the three confirmed gates below are this phase's only content writes.

**Tasks:**

```
node <kit-root>/scripts/health-check.ts --result-max-kb <KB> --task-max-kb <KB> --record-max-kb <KB> <kit-root>/.agents/tasks <every resolved task root>
```

Pass all roots in one run, including the kit's canonical root exactly once regardless of registration. Read the compaction trigger from `./references/workflow/reconciliation-compaction.md` § *Compaction (size trigger)*. Read folder and record budgets from `./references/workflow/task-layout.md` § *One task, one flat folder*. Pass those current values; retain the script's default stale threshold by omitting `--stale-days`.

Attribute each finding by its absolute `root`, never its basename-prefixed display `path`. Report ages with the caveat that `.md` mtimes reset on cloning or bulk touches; youth is not evidence of recent work.

**Installs:**

```
node <kit-root>/scripts/health-check.ts --installs <kit-root> ~/.claude ~/.codex
```

Read marker-owned comparisons and kit items wholly absent from each home. User-installed paths remain outside comparison, except unmarked `references/` or `CORE_RULES.md`: those are conflicts that refuse installation. Rerunning setup cannot clear them. A markerless home receives one `never installed` line, including any conflict, rather than a finding per kit file.

**Uncommitted work:** read `git worktree list --porcelain` once from the kit root for this probe and the husk probe. Run `git -C <root> status --porcelain` for the kit, each task root inside a repository, and every listed linked worktree. Deduplicate paths already covered. Include worktrees belonging to no kit task. A root below a repository's top level still reports that repository. Report dirty paths only.

When explaining where a task's working changes reside, consult `./references/workflow/task-delivery.md` § *Branch and worktree creation*; status detection itself needs only the listing. <!-- cold -->

**Worktree husks:** candidates come from two sources:

1. Every linked worktree in that same listing, wherever located. Its first entry identifies the main checkout; do not reconstruct moved worktree paths.
2. Existing branches recorded in kit tasks' result Current-state `**Pointers:**` lines that no listed worktree carries. Traverse the kit's groups and lifecycle containers as in Phase 1. Unrecorded branch-only entries are not candidates.

With no candidates, report `none` and load no delivery or terminal-state contracts. With candidates, apply `./references/workflow/task-delivery.md` § *Branch and worktree creation* and § *Repo delivery declarations*. Resolve each branch token to kit task folders, including archived ones: exact folder name for `<slug>`, the declared reverse mapping for `<name>`. Report ambiguous matches first, naming all folders, and leave the entry untouched. Report no-match entries as outside this sweep and leave them alone. Branch-only candidates originate in their recorded task folders. <!-- cold -->

Judge matched candidates only under `./references/workflow/task-delivery-edges.md` § *Removal*, including its missing-worktree handling. Read terminal states from `./references/workflow/status-transitions.md` at run time. An entry neither merged nor terminal is live work and omitted. Report terminal-but-unmerged entries without offering removal. Other failed predicates yield `not removable (<predicate>)`; only candidates passing the removal checks reach the gate. These contracts load only when candidates exist. <!-- cold -->

When the health helper or Node is unavailable, skip both script probes and state why. A non-repository root skips its status line with the reason. Do not report skipped probes as clean.

**Gate — archive the finished tasks.** For each `done-unarchived` finding, preview the location-relative move from `./references/workflow/task-archiving.md`: `<parent>/<slug>/ → <parent>/Archive/<slug>/`. Check each destination for collision before proposing it. Drop collisions and Phase 1 needs-judgment folders to the judgment list. Also drop folders whose immediate parent is Backlog, matched case-insensitively (`./references/workflow/task-backlog.md`); this batch does not decide their route out of Backlog.

On one confirmation, move exactly the previewed batch; declining moves nothing. A plain `mv` may perform the contracted whole-folder move. Change no contents or internal `./` links.

**Gate — rerun `setup.ts`.** Preview drifted paths grouped by home. Before confirmation, warn that `node <kit-root>/setup.ts` replaces installed skills and references beneath live sessions, including this one. Run only on confirmation and only as a whole installation; there is no per-path mode. Declining leaves both homes unchanged. Retain drift findings in Output either way.

**Gate — remove the worktree husks.** Preview each eligible path, branch, and merge proof; label branch-only entries as having no worktree. Confirm **per item**, never as a batch. Exclude terminal-but-unmerged entries. On confirmation, use the resolved path, checks, order, and unforced commands in `./references/workflow/task-delivery-edges.md` § *Removal*. Branch-only candidates run `git branch -d` alone. Report refusals without forcing cleanup. If worktree removal succeeded before branch deletion failed, report partial cleanup and the surviving branch. Declining removes nothing. With no removable candidate, skip this gate and its contract load. <!-- cold -->

## Phase 3 — List the active tasks (no reconcile)

List kit task leaves through Phase 1's group traversal, excluding Archive and Backlog case-insensitively (`task-archiving.md`, `task-backlog.md`). Read terminal states from `./references/workflow/status-transitions.md` at run time and include non-terminal plans. Recognized folders without a plan count as active; label them `no plan yet`.

Use paths for grouped tasks whose slugs cannot resolve in an unregistered canonical root (`./references/workflow/task-layout.md` § *Discovery rules for skills*). Omit groups, strays, and needs-judgment folders. This phase only lists the handoff set; it reconciles no content and reads no task Domain.

## Phase 4 — Session analysis (Claude + Codex logs)

Inspect recent session signals: refused calls, sandbox/hook blocks, schema rejection, retry loops, and interruptions. The fixed corpora are `~/.claude/projects` and `~/.codex/sessions`, not arguments or questions. Report a missing corpus as an uninstalled host. Reads are detection-only.

**Window.** Read the single ISO date in `~/.local/state/agents-kit/.maintain-last-run`. If absent, empty, or unparseable, use 30 days before today. Report the start date and its source.

**Triage.** Run:

```
node <kit-root>/scripts/session-triage.ts --since <window-start> ~/.claude/projects ~/.codex/sessions
```

Apply `./references/scripts/session-triage.md`; use its ranking rather than recomputing it. Leave `--top` at its default. `flagged` is the ranked top slice; `remainderPaths` names the remainder. If Node or the helper is absent, report the skipped phase.

Compute kit share from `sessions`, expanding `~` in the resolved kit root. A project equals that root, starts with that root plus `/`, or sits under `<kit-root>.worktrees/` to count as kit work. Everything else, including `null`, counts elsewhere. Worktree placement follows `./references/workflow/task-delivery.md` § *Branch and worktree creation*.

**Deep-read.** Launch one read-only probe for each emitted `flagged` session under `./references/workflow/agent-fanout.md` and `./references/workflow/probe-engines.md`. Do not widen the list. Apply two bindings:

- Use only the **native** engine. Never send transcripts through a cross-vendor probe; they must stay with the machine's configured vendor.
- Supply the absolute transcript path, matched classes and counts, and demand cited findings. Each finding names the misbehavior, what failed, minimal evidence, and a suggested kit fix only when a kit contract caused it. Before returning, replace credentials, secrets, tokens, PII, proprietary payloads, and sensitive path components with `[redacted]`. When redaction erases the useful signal, cite the record/line and paraphrase. The parent checks sanitization again before preview, chat, or file output. A probe finding nothing actionable returns `benign`.

Name every unread flagged session by path: probes without a finding or benign verdict, including failed or missing returns, plus every `remainderPaths` entry. Report the script's `remainder` count; do not silently cap the report.

**Gate — write the findings file.** Preview the findings themselves: class, session, sanitized evidence, and suggested fix. Refuse the write until every excerpt passes the parent's redaction check. Offer one file, `~/.local/state/agents-kit/session-findings-YYYY-MM-DD.md`, with today's date, the window, findings, and benign/remainder counts. Check existence first; confirmation explicitly authorizes overwrite when the file already exists.

On confirmation, create the state directory if needed and write only that file. Declining writes no findings file; findings still appear in the gate and Output.

**Marker.** After findings are rendered and the gate answered either way, write today's ISO date as the marker's single line. A declined findings-file gate still permits this metadata update. Leave the prior marker intact when the phase was skipped or triage's `unreadable` is non-zero, including both `unreadablePaths` and `unreadableDirs`. Report partial coverage and the unchanged marker. `skippedUnrecognized` is reported but does not hold the marker.

## Output

Use lists, not tables. Confine writes to the resolved kit/task roots, listed linked worktrees, state directory, and confirmed installation homes. Apply the narrower phase-specific scopes above.

- **Targets:** resolved kit and task roots with labels; every absent registered path named as skipped.
- **Format:** `N conformant, M structurally-fixable, K needs-judgment`; each issue and whether fixes applied or were declined. Include strays and unsupported expected rules. Report a missing canonical root as no sweep.
- **Health:** findings grouped by `check`, or `skipped (<reason>)`. Attribute labels from absolute `root`, not the display prefix. Apply lifecycle exemptions from **Archived and backlogged folders** in `./references/scripts/health-check.md`.
  - `stale`: path, plan status, and age with the mtime caveat.
  - `done-unarchived`: path, terminal status, and archive outcome: applied, declined, collision, or backlogged judgment item.
  - `started-in-backlog`: path and live or unjudgeable status; the user decides whether location or lifecycle is wrong.
  - `unknown-status`: plan path and unrecognized value for manual remapping.
  - `legacy-result-status`: result path and value as inert inventory; propose no repair (`task-lifecycle.md` § *`result.md` — no status field*).
  - `dead-anchor`: checked step with unresolved result evidence.
  - `dead-citation`: citing file and target as written, including plain store-document paths. A dead checked-step link also appears under dead-anchor; it is one defect detected twice.
  - `citation-form`: one line per citing file with a count, not one per link. Keep replacement details in the JSON worklist.
  - `goal-id`: file and malformed or duplicate ID.
  - `no-current-state`: live result lacking its Current-state block.
  - `oversized-result`, `oversized-task`, `oversized-record`: affected result, folder, or section and measured budget. Propose no compaction or rewrite here.
  - `duplicate-slug`: each colliding folder and its peers, labelled by root; propose no move or rename.
  - `nested-task`: claimed folder and hidden task descendants; propose no move.
  - `coverage`: when unreadable is non-zero, name every absolute `unreadablePaths` entry as unseen coverage and attribute it by path.
- **Installs:** one line per home with drift count, clean, or never installed, plus installation outcome. Name unreadable paths and qualify coverage; unreadable content cannot support a bare clean verdict.
- **Git:** one line per read tree, identified by its path, with dirty paths or clean. Add this run's subsequent writes, including archive moves, findings, and marker, explicitly labelled as such; no second status read is needed.
- **Worktrees:** each husk's path or `no worktree (branch only)`, branch, merge proof or `terminal, unmerged (report only)`, and outcome. Use removed, declined, partially removed with surviving branch, or not removable with reason. Include out-of-scope and ambiguous entries, naming competing folders; report none when no source yields a husk.
- **Active kit tasks:** Phase 3's list for handoff, without analysis.
- **Sessions:** window, findings, or skipped reason.
  - `window`: start/date source, scanned and flagged counts; non-zero skippedUnknownRecords; unreadable transcript/directory paths; unrecognized paths; missing corpora.
  - `kit share`: `N of M sessions ran in the kit checkout, R elsewhere (P%)`. N comes from the project comparison, M is scanned, R is M − N, and P is kit percentage.
  - `findings`: one entry per actionable deep-read session, with host/path, classes/counts, sanitized excerpt or cited paraphrase, and suggested fix. Use `no kit fix — one-off` when appropriate.
  - `triage-flagged-but-benign`: every deep-read benign session.
  - `remainder`: paths of failed/missing probe returns and beyond-top sessions, with the script's remainder count.
  - `findings file`: written path or declined, nothing written.
  - `marker`: updated date or not updated with skipped/partial-read reason.
- **Deferred (not yet wired):** memory GC, including deduplication of memory silos and the `MEMORY.md` index, awaits a procedure. Run no store-index refresh; no standing listing artifact exists (`./references/workflow/task-store.md` § *Store-level artifacts*).
- **Next:** give one consolidated handoff using the routes below.

Ask the user to review `git diff` and commit their changes in the kit and each affected root's repository. Include every Git-reported path and this run's writes; this skill commits nothing.

Use a bare slug only where `./references/workflow/task-layout.md` § *One task, one flat folder* resolves it. For grouped tasks in an unregistered canonical root, use paths. Resolve duplicate-slug ambiguity before other slug-based handoffs.

- Route oversized results, folders, and records to `/reconcile-task <slug>` for confirmed compaction or trimming; documentation deliverables may need their author.
- Route dead-anchor, goal-id, no-current-state, and active tasks to `/resume-task-reconcile <slug>` for content reconciliation and cited-link checks. Use `/plan-task <slug>` for no-plan tasks.
- Route dead-citation there only when the composite writes its citing file. Hand-repair deliverables and skipped-plan tasks (`./references/workflow/reconciliation-docs-to-reality.md`; `./references/workflow/reconciliation.md` § *Skipped plans are exempt*).
- Hand-rewrite citation-form findings under `./references/workflow/one-home.md` § *One home per fact*. An outside-store target requires moving it into a walked root or registering its root. A citation to the store root itself must name something it holds; neither case is fixed by rewriting form alone.
- Let the user decide stale tasks: `/resume-task <slug>` or archive once finished. For started-in-backlog, activate with `mv` under `./references/workflow/task-backlog.md` if work is underway, otherwise repair lifecycle. Archive backlogged terminal tasks by hand out of Backlog once confirmed.
- Hand-rename duplicate slugs and repoint citations. Hand-rename or relocate nested-task content to restore discovery. Resolve judgment folders manually; remove strays only after confirmation.
- Have the user land dirty/unpushed work in non-removable husks and rerun maintenance; force neither removal command.
- Suggest `/prepare-ticket` for concrete kit defects behind session findings. The user chooses whether to file; this ritual files no ticket.
