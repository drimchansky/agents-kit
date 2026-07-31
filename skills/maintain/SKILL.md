---
name: maintain
description: Use when asked to run the monthly maintenance ritual on the agents-kit and its task store — a report-first sweep that checks the kit's task folders against the current format and regenerates the store index, then hands off the rest. Auto-applies only the idempotent index refresh; gates every other change. Never touches git.
argument-hint: '[kit path and/or store path — defaults to the canonical checkouts]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.

The monthly maintenance ritual: one command that keeps the kit and its task store from drifting between audits — the R6 recommendation of the July 2026 workflow audit, "maintenance has no owner; give it one." It runs three operations in order — a format-conformance sweep of the kit's task folders, a store-index refresh, and a listing of the active tasks for handoff — then reports what it found and hands the fixes back to you. It operates on the task-folder **envelope** and store artifacts, not on any task's domain *content*, so it resolves no `**Domain:**` pack, delegates to no skill, and reconciles nothing: the docs→reality reconcile of a task's own content is `resume-task-reconcile`'s job, handed off in **Next** rather than run here.

All three phases run inline against the reference contracts they name. Two overrides apply pipeline-wide:

- **Chat display** — the final **Output** owns the consolidated report; each phase prints only a one-line progress note plus any inline confirmation gate it requires (a gate is a mutation control, not display to suppress — it must reach you).
- **Next pointers** — the Output owns the single **Next**.

Past these two, a phase departs from the contract it names only where its own section below says so — never by improvisation.

**CRITICAL**:

- **Report-first; gate every mutation but one.** The store-index regeneration is idempotent and applies without a prompt. Everything else — format fixes, folder removals — is previewed and applied only on confirmation, or handed off in **Next**. Never auto-apply a doc edit, never auto-delete.
- **Never touch git.** No add, commit, push, or checkout in any repo. All changes are working-tree only; you review with `git diff` and commit yourself — including the store's regenerated `INDEX.md`.
- **Coverage is partial by design.** Of R6's six operations this ritual runs two — the format sweep and the index refresh. Three — memory GC, worktree-husk sweep, and the kit deploy-drift check — have no backing skill yet and are **not run**; name them in the Output (see **Deferred**) rather than skipping silently. The sixth, the docs→reality reconcile, is wired but deliberately not run here: it is handed to `resume-task-reconcile` in **Next**.

## Setup — resolve targets

Resolve two roots before running any phase, and print them as the one setup line. Each is existence-checked and overridable by argument; if a default is absent, ask rather than guess (these canonical paths are the one environment-specific concession, justified because this is a personal ops ritual).

- **Kit root** — the agents-kit *source* checkout: the directory holding `setup.sh`, `CORE_RULES.md`, and `references/`. Default `~/Personal/agents-kit`. This is the source that redeploys — **not** the deployed `~/.claude` copy the running skill lives in.
- **Store root** — the central task store: the directory holding `scripts/generate-index.mjs` and `INDEX.md`. Default `~/Documents/Tasks`.

If an argument is given, interpret it as one or both roots (a path containing `setup.sh` is the kit; one containing `scripts/generate-index.mjs` is the store). If neither default exists and none is named, say so and stop — there is nothing to maintain.

## Phase 1 — Format-conformance sweep (kit)

Bring the kit's own task folders under `<kit-root>/.agents/tasks/` into conformance with the **current** format. The format evolves, so folders written under an older convention drift out of shape; this phase finds that drift, previews it, and repairs only what can be repaired without judgment.

**Derive the format — never restate it.** Read the envelope contracts under `./references/workflow/` at run time and treat them as the only source of truth: `task-layout.md` (folder shape, the role-file set with its exact spelling and casing, link-header targets, multi-part siblings, the archive container, discovery) and `task-lifecycle.md` (the `**Status:**` vocabulary, which differs *per file* — check each file against its own column — plus the `## Current state` liveness rule). When classifying a file whose internal shape another workflow doc owns, read that doc too (`context-schema.md`, `ticket-format.md`, `acceptance-criteria.md`). This skill deliberately carries **no** copy of the format: read each value out of the docs every run rather than against a remembered shape. The one carve-out is recognizing the *legacy* names the docs no longer define — undocumentable by construction, so the transforms below enumerate them; the **current** format still comes only from the docs. If you believe a rule holds but can find no home for it in the docs, surface that gap in the preview and do not enforce it.

**Classify** every directory directly under `.agents/tasks/`, excluding the archive container itself — it is a container, not a task, and is matched case-insensitively per `task-layout.md`. Assign each exactly one label:

- **conformant** — matches the derived format. An optional file's absence is conformance, not a deviation.
- **structurally-fixable** — deviates *only* in ways a **lossless, content-free** transform repairs: renaming a file to its role name, normalizing a name's case, repointing a link at its `./`-relative role name, or normalizing the archive container's own case when no canonical `Archive/` sits beside it. Nothing else qualifies. A file **renames onto a role name** when its role suffix identifies it (`*.plan.md`, `*.result.md`, `*.ticket.md` — match the suffix, never assume the stem is the folder's slug), when only its case is wrong, or when it carries the legacy goals name (`spec.md` / `*.spec.md`) *and* is already goal-shaped; a legacy goals file that isn't is needs-judgment, not a rename. A link **repoints** when it names a file this sweep renames, or when it reaches **this folder's own** role file by anything other than its `./`-relative role name — the `**Header:**` lines *and* the in-body links alike, including a plan step's `([result](./<stem>.result.md#…))`; a rename that leaves either behind strands a dead link. A link reaching *out* of the folder is never repointed: `./` role-name targets are a within-folder convention (`task-layout.md`), so rewriting a cross-task citation retargets it rather than repairing it. The legacy `**Spec:**` header additionally takes the `**Goals:**` label, retired together with the file name it points at — the one label change that qualifies.
- **needs-judgment** — anything that would derive, remap, or delete content: assigning goal IDs, extracting criteria out of a plan, remapping an out-of-vocabulary status, stripping a header that shouldn't be there, writing a missing `## Current state` block, resolving a collision where a *distinct* file already holds a destination role name (a case-only difference is not one — see below), or collapsing an older *grouping* layout (a `PROJECT.md` and/or nested task subdirectories) whose shared context has to be redistributed into each task by hand. Also anything you can't confidently match to the derived format — describe what you saw rather than guessing a transform. The same at root level: two archive containers (`archive/` *and* `Archive/`, possible only on a case-sensitive filesystem) are a judgment call, never a rename — flag it and leave both untouched.
- **stray** — a directory holding **no task content at all**: no role file, no file that renames onto one (see **structurally-fixable**), and nothing task-shaped nested inside. Every discovery rule ignores it and `resume-task` never surfaces it. Not a task; flag it for removal and **never auto-delete**.

**Precedence:** any judgment issue makes the whole folder needs-judgment even when structural issues also exist, and the folder is left **entirely** untouched — applying its structural fixes in isolation is the half-migration that strands content. Resolving the judgment issue by hand and re-running picks the structural fixes up safely.

If `.agents/tasks/` doesn't exist, or no folder has a planned operation and no container rename is pending — every folder conformant, or the deviations are all needs-judgment or stray — say so and move to Phase 2, carrying the judgment and stray folders into the Output; don't raise a confirmation gate for zero fixes. Otherwise preview every planned operation as a concrete `old → new` list and apply, on the phase's single confirmation, only what was previewed. Never delete content, never rewrite prose or a status value, never touch anything outside `.agents/tasks/`, and never touch git. A link-header that is still a prose placeholder rather than a link is conformant for its lifecycle state — leave it; linking it to a file that doesn't exist fabricates a dead link. Rewrite only a link's target, never the surrounding prose; the one `**Spec:**` → `**Goals:**` label named above is the sole exception. Carry any anchor over verbatim — it is heading-derived, not name-derived, so it survives the rename untouched. **A case-only difference is the rename to perform, not a collision**: on a case-insensitive filesystem (macOS's APFS) `Context.md` and `CONTEXT.md` resolve to the same path, so don't read the destination as occupied — rename via a temp name if the OS won't do a case-only rename directly. Every transform is idempotent, so a re-run over a conformant folder changes nothing.

Scope limit: this sweep is canonical-root-scoped (`<root>/.agents/tasks/`). The central store nests tasks under area directories rather than a canonical root, so **store** format conformance is out of this phase's scope — do not point the sweep at the store root.

## Phase 2 — Index refresh (store)

Refresh the store index per the store-artifacts contract in `./references/workflow/task-layout.md`: from the **store root**, locate `scripts/generate-index.mjs` (walk up if needed) and run it with `node <path-to-located-script>`. This is the **one auto-applied** change — the regeneration is idempotent and, per the contract, needs no reconciliation finding to run. If the script is absent, or `node` is unavailable, **skip silently** and say so in the Output. Report whether `INDEX.md` changed; leave it uncommitted for you to review and commit.

## Phase 3 — List the active tasks (no reconcile)

Name the folders under `<kit-root>/.agents/tasks/` whose `plan.md` `**Status:**` is non-terminal — reading the terminal set from the **plan-state vocabulary** in `./references/workflow/task-lifecycle.md` **at run time** rather than against a remembered list, and excluding the `Archive/` container (matched case-insensitively per `task-layout.md`). A folder with **no `plan.md`** — a young task holding only a `ticket.md`, `CONTEXT.md`, or a hand-authored `goals.md` (`task-layout.md` § *Discovery rules for skills*) — has no status to be terminal and counts as active: name it `no plan yet`. A list for the **Next** handoff, nothing more: this ritual reconciles no task content and reads no task's `**Domain:**`. Stray and needs-judgment folders are Phase 1's concern and are not repeated here.

## Output

Lists, never tables.

- **Targets** — the resolved kit root and store root.
- **Format** — the Phase-1 summary: `N conformant, M structurally-fixable, K needs-judgment`, with each non-conformant folder's issue and whether its lossless fixes were applied or declined; then any **stray folders** flagged for removal, and any format rule you expected but found no home for in the docs.
- **Index** — `regenerated` (`INDEX.md` changed / unchanged) or `skipped (<reason>)`.
- **Active kit tasks** — Phase 3's list, named for the **Next** handoff. A list, not an analysis.
- **Deferred (not yet wired)** — the three operations with no backing skill yet, each one line:
    - *memory GC* — prune and de-duplicate the memory silos and the `MEMORY.md` index; needs a memory-GC procedure.
    - *worktree-husk sweep* — find and remove orphaned or dirty leftover git worktrees; awaits the R5 worktree-lifecycle skills.
    - *kit deploy-drift check* — diff the kit source against the deployed `~/.claude` / `~/.codex`; a `setup.sh --check` mode for this was declined in R4, so it stays unwired.
- **Next:** review `git diff` and commit the kit (any format edits) and the store (`INDEX.md`); run `/resume-task-reconcile <slug>` on the active tasks listed above to reconcile their content and re-check their cited links (`/plan-task <slug>` for any listed `no plan yet`); resolve the flagged judgment folders by hand; remove confirmed stray folders.

## Verification

Confirm the protocol invariants before finishing:

- [ ] `✅ Core agents-kit rules applied` echoed once
- [ ] Kit root and store root resolved, existence-checked, and printed; a missing default asked-about, not guessed
- [ ] Phase 1 derived the format from `./references/workflow/` at run time — never from memory or a copy in this file — and surfaced, rather than enforced, any rule with no home in those docs
- [ ] Phase 1 applied exactly the previewed lossless transforms — every link repointed that named a renamed file or missed its `./`-relative role name within its own folder (headers and in-body alike, anchors preserved), no cross-folder link retargeted, case-only renames performed rather than read as collisions; every folder carrying a judgment issue was left entirely untouched, and no stray folder was deleted
- [ ] Phase 2 followed the `task-layout.md` store contract — not improvised
- [ ] No task's content was reconciled and no task's `**Domain:**` was resolved; Phase 3 listed the active set for the handoff, with the terminal states read from `task-lifecycle.md` at run time — never from a remembered list
- [ ] `INDEX.md` regeneration was the **only** change applied without a prompt; format fixes and folder removals were each previewed and gated or handed off
- [ ] No git mutation in any repo; nothing outside the resolved kit root and store root was touched
- [ ] The three deferred operations are named in the Output, not silently skipped
- [ ] Output carries the resolved Targets and the single **Next**
