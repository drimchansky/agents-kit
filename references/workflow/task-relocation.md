# Relocating a Task Folder: The Shared Move Protocol

The procedure `archive-task` and `backlog-task` share for moving a whole task folder into a container beside it — `Archive/` per `./task-archiving.md`, `Backlog/` per `./task-backlog.md` — by running `scripts/task-move.ts`. **This file is the single source of truth for that procedure**: resolving the folder, running the script, reading its outcome, and reporting it. Each skill keeps only what its direction changes — the container, the gate the script applies, what qualifies as a task folder, and the branches its own listing and refusals add — and cites the step here for everything else.

## 1. Resolve the target task folder

Resolve per the **resolve-or-ask** base resolution in `./task-layout.md` § *Discovery rules for skills*, read at run time — that section owns every branch (a bare slug across the canonical root and every registered one, each with its container fallback; an explicit folder path; a `plan.md` path; and the nothing-named listing). Don't work from a copy: a skill that carried one went stale the moment the registry widened where a slug resolves.

Call the folder you resolve `SRC` — canonically inside a `.agents/tasks/` directory, but any location on disk works the same, and it may lie outside the current working directory entirely. Resolve it to an **absolute path**; that path is the whole of what step 2 acts on.

**Validate what `SRC` is before going further.** However it was produced — slug, folder path, or `plan.md` path — it must be a real task folder by **contents**, not by address shape, against the recognition the skill names for its direction. A folder that itself *contains* an `Archive/` or a `Backlog/` subdirectory (both matched case-insensitively, per `./task-archiving.md` and `./task-backlog.md`) is a task **parent**, not a task folder — **refuse**; moving it would drag its whole archive and backlog along.

## 2. Run the move

```bash
node <kit-root>/scripts/task-move.ts <SRC> --to <archive|backlog>
```

`<kit-root>` resolves per `./task-store.md` § *Resolving `<kit-root>`*, which owns that rule. With no kit root available, say the move can't be performed here and stop — a guarded move has no by-hand equivalent worth offering; the container's own file states what the move is for anyone doing it themselves.

`<kit-root>/SCRIPTS.md` § *`scripts/task-move.ts`* owns its CLI and its stdout contract — read that section, not the whole file. What it decides, so the skill doesn't:

- **The gate** — it reads the folder's state against the direction's own rule and refuses what fails it; each skill names which rule that is.
- **The destination** — location-relative, derived from `SRC`'s own parent, with the **case-insensitive recognition** of an existing container (an `archive/` or `backlog/` is moved into as it is spelled; normalizing a stray spelling is `maintain`'s format sweep, not this move).
- **The guards** — a symlinked source, a symlinked or non-directory container, and an occupied `<container>/<slug>` are each refused rather than overwritten or followed.

Read the outcome from the exit status:

- **0** → moved. Stdout is one line, `moved <src> -> <dest>`; the destination it names is what step 3 reports.
- **1** → refused. Stderr is one line giving the reason. Surface it **verbatim** and stop; nothing moved.
- **2** → the run couldn't be carried out — a usage error, a bare slug that matched nothing or several things, or an unexpected failure. Where the line names one of the first two, fix the invocation (pass `SRC` as the absolute path step 1 resolved) and re-run; where it reports a failure instead, report that and stop rather than re-running against it.

## 3. Report

Confirm what moved (`<slug>` → the `<dest>` the script printed), note that the folder's internal `./` links are intact, and remind the user that the task is now excluded from active listings. When the folder is inside a git repo, the change is working-tree-only — review with `git status` and commit; a task outside any repo has nothing to commit.

The move is the whole of this section's write surface: nothing is regenerated, refreshed, or recorded afterwards.

## Don't Rationalize

- "This `plan.md` path has an eligible plan, good enough to move" — Check *what* it is first: a task folder by contents, holding no `Archive/` or `Backlog/` of its own. A tasks-parent would drag its whole archive and backlog along; refuse it rather than handing it to the script.
- "I'll pass the slug and let the script find it" — Its slug resolution is a minimum, deliberately: ambiguity is the *skill's* question to ask, with the listing and the statuses in front of the user. Resolve first, then pass the absolute path.
- "The script refused, but the task really qualifies — I'll move it myself" — No. The refusal is the contract answering, and a hand-finished move would relocate a folder whose state nothing verified. Report the line and let the user act on it.
- "It refused because the destination is occupied, so I'll merge the two folders" — Never. Two folders holding one slug is a collision for the user to resolve; merging silently destroys one of them.
