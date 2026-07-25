---
name: maintain
description: Use when asked to run the monthly maintenance ritual on the agents-kit and its task store — a report-first sweep that regenerates the store index, previews task-format migration on the kit, and reconciles the kit's own task folders to reality, then hands off the rest. Auto-applies only the idempotent index refresh; gates every other change. Never touches git.
argument-hint: '[kit path and/or store path — defaults to the canonical checkouts]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.

The monthly maintenance ritual: one command that keeps the kit and its task store from drifting between audits — the R6 recommendation of the July 2026 workflow audit, "maintenance has no owner; give it one." It runs three backed operations in order — a task-format sweep of the kit, a store-index refresh, and a docs→reality reconcile of the kit's own task folders — then reports what it found and hands the fixes back to you. It operates on the task-folder envelope and store artifacts, not on a task's domain content, so it resolves no `**Domain:**` pack of its own — though the `resume-task -r` it delegates to in Phase 3 still resolves each task's marker and applies that pack, per `./references/workflow/domain-packs.md`.

Each phase executes its skill file — read the sibling `SKILL.md` and run its full protocol. Three overrides apply pipeline-wide, to every phase:

- **Core Rules blocks** — the composite's own block above covers the run; inner skills' `AGENTS.md` read and `✅` echo are already satisfied and don't repeat. The override stops at those two: an inner skill's domain-pack step still runs, as `resume-task`'s does in Phase 3.
- **Chat display** — the final **Output** owns the consolidated report; each phase prints only a one-line progress note plus any inline confirmation gate it requires (a gate is a mutation control, not display to suppress — it must reach you).
- **Next pointers** — inner skills' follow-up suggestions are dropped; the composite's Output owns the single **Next**.

Past these three, a phase departs from its skill only where its own section below says so — never by improvisation.

**CRITICAL**:

- **Report-first; gate every mutation but one.** The store-index regeneration is idempotent and applies without a prompt. Everything else — migrate fixes, reconcile edits, folder removals — is previewed and applied only on confirmation, or handed off in **Next**. Never auto-apply a doc edit, never auto-delete.
- **Never touch git.** No add, commit, push, or checkout in any repo. All changes are working-tree only; you review with `git diff` and commit yourself — including the store's regenerated `INDEX.md`.
- **Coverage is partial by design.** Three of R6's six operations — memory GC, worktree-husk sweep, and the kit deploy-drift check — have no backing skill yet and are **not run**. Name them in the Output (see **Deferred**) rather than skipping silently.

## Setup — resolve targets

Resolve two roots before running any phase, and print them as the one setup line. Each is existence-checked and overridable by argument; if a default is absent, ask rather than guess (these canonical paths are the one environment-specific concession, justified because this is a personal ops ritual).

- **Kit root** — the agents-kit *source* checkout: the directory holding `setup.sh`, `CORE_RULES.md`, and `references/`. Default `~/Personal/agents-kit`. This is the source that redeploys — **not** the deployed `~/.claude` copy the running skill lives in.
- **Store root** — the central task store: the directory holding `scripts/generate-index.mjs` and `INDEX.md`. Default `~/Documents/Tasks`.

If an argument is given, interpret it as one or both roots (a path containing `setup.sh` is the kit; one containing `scripts/generate-index.mjs` is the store). If neither default exists and none is named, say so and stop — there is nothing to maintain.

## Phase 1 — Migrate-format sweep (kit)

Execute `../migrate-task-format/SKILL.md` against the **kit root** — a project root with `.agents/tasks/`. Run its full protocol including its inline preview and confirmation gate: it classifies each task folder (conformant / structurally-fixable / needs-judgment), previews, and applies only lossless structural fixes on your confirmation. Its preview surfaces inline — it is what you confirm against; the **Output** then carries the final per-folder summary.

Scope limit: `migrate-task-format` is canonical-root-scoped (`<project>/.agents/tasks/`). The central store nests tasks under area directories, not `.agents/tasks/`, so its format conformance is **out of this phase's scope** — do not point `migrate-task-format` at the store root.

## Phase 2 — Index refresh (store)

Refresh the store index per the store-artifacts contract in `./references/workflow/task-layout.md`: from the **store root**, locate `scripts/generate-index.mjs` (walk up if needed) and run it with `node <path-to-located-script>`. This is the **one auto-applied** change — the regeneration is idempotent and, per the contract, needs no reconciliation finding to run. If the script is absent, or `node` is unavailable, **skip silently** and say so in the Output. Report whether `INDEX.md` changed; leave it uncommitted for you to review and commit.

## Phase 3 — Reconcile the kit's own tasks

For each **active** task folder under `<kit-root>/.agents/tasks/` — non-terminal `**Status:**` (not `done`/`skipped`), excluding the `Archive/` container (matched case-insensitively) — Execute `../resume-task/SKILL.md -r` (passing the folder path) in a **preview posture**: run its docs→reality reconcile *analysis* — which only ever weakens overstated claims (unchecks unbacked steps, reverts unevidenced state, repairs status pairings, adds a missing `## Current state` block; it never advances to `done` or checks a box) — but **apply nothing until confirmed**. This is the phase's declared departure from `resume-task -r`, whose fixes are normally automatic: under this report-first ritual even those are gated.

Collect every folder's proposed reconciliations, then apply the obvious ones behind a **single confirmation** for the phase; list the judgment calls (the ones `resume-task -r` would ask about) in the Output for you to decide. Do not block per-folder.

Also scan `.agents/tasks/` for **stray/invalid folders** — a directory under `.agents/tasks/` (excluding `Archive/`) with **no role files** (`CONTEXT.md`, `goals.md`, `plan.md`, `result.md`, `ticket.md`), which every discovery rule ignores and which `resume-task` / `migrate-task-format` never surface. Flag each for removal in the Output; **never auto-delete**.

## Output

Lists, never tables.

- **Targets** — the resolved kit root and store root.
- **Migrate** — the Phase-1 summary: `N conformant, M structurally-fixable, K needs-judgment`, with each non-conformant folder's issue and whether its structural fixes were applied or declined.
- **Index** — `regenerated` (`INDEX.md` changed / unchanged) or `skipped (<reason>)`.
- **Reconcile** — per active kit task: drift found, obvious fixes applied (after the phase confirm) or declined, and judgment items left to decide; then any **stray folders** flagged for removal.
- **Deferred (not yet wired)** — the three operations this ritual does not yet run, each one line:
    - *memory GC* — prune and de-duplicate the memory silos and the `MEMORY.md` index; needs a memory-GC procedure.
    - *worktree-husk sweep* — find and remove orphaned or dirty leftover git worktrees; awaits the R5 worktree-lifecycle skills.
    - *kit deploy-drift check* — diff the kit source against the deployed `~/.claude` / `~/.codex`; a `setup.sh --check` mode for this was declined in R4, so it stays unwired.
- **Next:** review `git diff` and commit the kit (any migrate / reconcile edits) and the store (`INDEX.md`); resolve the flagged judgment items (`/reconcile-task <slug>`, or by hand); remove confirmed stray folders.

## Verification

Confirm the protocol invariants before finishing:

- [ ] `✅ Core agents-kit rules applied` echoed once; sub-skills did not re-echo
- [ ] Kit root and store root resolved, existence-checked, and printed; a missing default asked-about, not guessed
- [ ] Each phase ran from its skill file (`migrate-task-format`, `resume-task -r`) or the named contract (`task-layout.md`) — none improvised from memory
- [ ] `INDEX.md` regeneration was the **only** change applied without a prompt; migrate fixes, reconcile edits, and folder removals were each previewed and gated or handed off
- [ ] No git mutation in any repo; nothing outside the resolved kit root and store root was touched
- [ ] The three deferred operations are named in the Output, not silently skipped
- [ ] Output carries the resolved Targets and the single **Next**
