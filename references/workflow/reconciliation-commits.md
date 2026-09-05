# Reconciliation: Commit Scan and Watermark

Two commit origins carry a task's work past its folder: a session where the folder was never opened, and a plain `git commit` outside the kit. The **scan** makes those commits visible; the **watermark** bounds it. Read it at the commits-since-watermark step — `resume-task` reading, a reconcile phase writing.

**The mechanics are a script.** `node <kit-root>/scripts/commit-scan.ts <task-dir>` enumerates and reports as JSON, writing nothing. `<kit-root>` resolves per `./task-store.md` § *Resolving `<kit-root>`*; `../scripts/commit-scan.md` owns its CLI form, stdout contract, and exit statuses. This file owns the judgment around it.

**A commit is a trigger, never evidence.** A commit — a revert included — *nominates* a pending step as a candidate; the box flips only where `./reconciliation.md` § *Strengthen only on verified evidence* attests it, by re-running that step's `**Verify:**` in the current run. The scan nominates and never weakens: unchecking a box whose work vanished is the unbacked-step repair's.

## The watermark

One entry on the result file's `## Current state` `**Pointers:**` line, written `SHA <sha> (recorded YYYY-MM-DD)`. That line is free prose holding the delivery vehicle's identifiers (`./task-authorship.md`), so the entry is additive — and machine-findable inside it. `scripts/commit-scan.ts` carries the machine-readable copy of that shape, since it cannot read this prose at run time — a sanctioned copy per `AGENTS.md` § *Consumer lists*: reword the entry here and change the pattern there in the same edit, or a task with a baseline scans as `no-watermark`.

It also carries a **second meaning**: the **last-observed tip of `<ref>`**, the floor every scan runs from — the SHA alone, `<ref>` being the task's own branch wherever one is recorded beside it (`./task-delivery.md` § *Branch and worktree creation*).

## The scan

**The repository is resolved, never assumed** — the git root containing a project-local `.agents/tasks/` folder, or the session's git root for one in a task store or registered root (`./task-store.md`), never a root inferred from the shell's working directory. Neither resolving omits the section; the script reaches only the first case — the store case reports `no-checkout` and renders **unscanned**, naming that repository (`../scripts/commit-scan.md`).

**A repository holding none of the plan's paths is not this task's.** At least one path a step names must **exist on disk** inside the resolved root — existence, not containment. Failing it omits the section: no scan, no seed, no re-seed. Both omissions arrive as `no-checkout`, never as an empty range.

## Degenerate cases

- **`no-watermark`.** Nothing reconstructs a range, and a guess is worse than none: the brief reports the missing baseline. The next reconcile phase seeds the entry at `<ref>`'s tip and reports `baseline seeded — no commits reconstructed` in its record, once a `result.md` exists to hold it; a plan still `to-do` is owed none (`./reconciliation.md` § *The record*), so the seed waits.
- **`orphaned`.** The recorded commit has left `<ref>`'s history — rebase, amend, force-push, rewrite. Report it; the reconcile phase re-seeds at `<ref>`'s tip and records the re-seed. Never scan a bogus range.

## The record — reconcile phase only

- **The scanned commit list** — dated, one line per commit — lands on the `**Commits:**` line of the run's `## Reconciliation` entry (`./reconciliation.md` § *The record*), closed over the report's 20-commit cap with `showing 20 of M since <sha>`: a cut is stated, never silent.
- **No entry, no advance.** Where the run writes no `## Reconciliation` entry — nothing was actionable (`./reconciliation.md` § *Sequence and output*), or no `result.md` holds one — the watermark does not move and no baseline is seeded — the advance and the record are one act. The next run re-scans the same range, the cost of that guarantee.
- **The watermark then advances** — the `**Pointers:**` entry rewritten to the scanned tip of `<ref>` and re-dated, in the Current state refresh (`./reconciliation.md` § *Current state refresh*).
- **A box this run checks links this run's own entry** — `([result](./result.md#reconciliation--YYYY-MM-DD))`, a same-day second entry slugged `-2`, which keeps `health-check.ts`'s `dead-anchor` check green.

## Read/write split

The scan **reads**, so it runs inside a strictly read-only brief; every watermark **write** — seed, re-seed, advance — is a reconcile-phase edit, and the brief neither seeds nor re-runs a candidate's `**Verify:**`. A candidate whose `**Verify:**` cannot re-run in this run — a narrative criterion, a session-only artifact — surfaces with its box open, per `./reconciliation.md` § *Strengthen only on verified evidence*.
