# Reconciliation: Commit Scan and Watermark

Two commit origins carry a task's work past its folder with no gate in between: a session where the folder was never opened, and a plain `git commit` outside the kit. The **scan** makes those commits visible to a resume brief; the **watermark** bounds what it looks at. Read this file when a run reaches the commits-since-watermark step — `resume-task`'s drift check reading, a reconcile phase writing.

**A commit is a trigger, never evidence.** A commit — a revert included — *nominates* a pending step as a candidate; the box flips only where `./reconciliation.md` § *Strengthen only on verified evidence* attests it, by re-running that step's `**Verify:**` in the current run. This file owns the scan and the watermark; that engine owns every write's precondition, and `./reconciliation-docs-to-reality.md` owns which finding routes to which edit.

## The watermark

One entry on the result file's `## Current state` `**Pointers:**` line, written `SHA <sha> (recorded YYYY-MM-DD)`. That line is free prose holding the delivery vehicle's identifiers (`./task-authorship.md`; `./one-home.md` § *One home per fact*, external-system facts), so the entry is additive to whatever prose is already there — and machine-findable inside it.

It deliberately carries a **second meaning**: not only an identifier for the delivery vehicle but the **last-observed tip of `<ref>`**, the floor every scan runs from. A bare SHA has no `observations.md` ledger line — that file is keyed by URL by design — so its freshness is re-derived against the repo on demand, which is exactly what the scan does.

## The scan

**The repository is resolved, never assumed.** A task folder under a project-local `.agents/tasks/` acts on the git root containing it; a folder in a task store or a registered root elsewhere (`./task-store.md`) acts on the session's git root. Neither resolving means the task acts on no repository the run can name, so the section is omitted — the scan never runs against a root inferred from the shell's working directory.

**A repository holding none of the plan's paths is not this task's.** Before scanning, confirm at least one path in a step's path set **exists on disk** inside the resolved root. Existence, not containment: a repo-relative `**Touches:**` path lies inside *any* root, so a containment test would never discriminate a wrong one, which is the whole point of this gate. None does → omit the section and write nothing: no scan, no seed, no re-seed. A wrong root self-omits rather than seeding a foreign HEAD onto `**Pointers:**`, which would leave every later scan in the right repository orphaned against it.

Given a watermark and that resolved repository, enumerate `<sha>..<ref>` — `git log --name-only --date=short --pretty=format:'%h %ad %s' <sha>..<ref>` — and keep the commits touching a path a plan step names. **`<ref>` is the task's own branch wherever one is recorded**, read off the same `**Pointers:**` line the watermark occupies, where `./task-delivery.md` § *Branch and worktree creation* puts the branch and deliberately puts no worktree path — the branch is the identity here exactly as `./task-delivery-edges.md` § *Re-entry on resume* reads it. A task's commits land on that branch inside its worktree while the resolved root's `HEAD` stays on the default branch, so enumerating `HEAD` walks a ref the work is not on and returns an empty range for work that is committed. **No branch recorded → `<ref>` is `HEAD`**, exactly as today. Either way the enumeration runs from the resolved root: a repository's refs are shared across its worktrees, so the branch resolves there whether or not its worktree still stands. **A recorded branch that no longer resolves** — deleted at removal (`./task-delivery-edges.md` § *Removal*) or by hand — takes that same fallback, named in the brief: `<ref>` is `HEAD`, where a merged branch's work now sits, and the degenerate cases below judge and re-seed against that fallback ref rather than erroring on the dead name.

- **Two distinct path tests run here** — don't read them as one: **name-match** decides which commits to keep (the commit touches a path a step names, whether or not that path exists), while **existence under the resolved root** gates both the section (above) and a step's candidacy (below).
- **A step's path set is the union** of its `**Touches:**` paths and the paths its `**What:**` names. `Touches:` is a parallelism declaration, so its absence never disqualifies a step.
- **A commit touching a pending (`- [ ]`) step's paths nominates that step** as a candidate for the engine's verification.
- **A commit touching only checked (`- [x]`) steps' paths is reported `[info]`.** The scan nominates; it never weakens. Weakening has its own paths — the drift check re-verifies shipped claims, and the unbacked-step repair unchecks a box whose work vanished, which is where a revert lands.
- **A step none of whose named paths exists on disk never becomes a candidate**, whatever moved in the repo.

The brief prints each kept commit with its date and the step(s) it nominates, and writes nothing.

## Degenerate cases — report, scan nothing

- **No watermark recorded.** Nothing reconstructs a range, and a guessed one is worse than none: the brief reports the missing baseline and scans no commits. The next reconcile phase seeds the entry at `<ref>`'s current tip and reports `baseline seeded — no commits reconstructed` in its record — once a `result.md` exists to hold it. A plan still `to-do` has none and is owed none (`./reconciliation.md` § *The record*), so the seed waits and the brief re-reports the missing baseline until then.
- **Orphaned watermark.** `git merge-base --is-ancestor <sha> <ref>` exiting non-zero means the recorded commit is no longer in `<ref>`'s history — rebase, amend, force-push, history rewrite. Report it orphaned and scan nothing; the reconcile phase re-seeds at `<ref>`'s tip and records the re-seed. Never scan a bogus range.

Both cases presuppose a resolved repository whose paths the plan reaches; where § *The scan*'s two conditions omit the section, neither degenerate case is reached and nothing is seeded. A task early enough that no named path exists yet is the ordinary instance: it omits, seeds nothing, and starts scanning once some step's path lands — which costs nothing, a plan still `to-do` being owed no baseline in the first place.

The entry is a floor, not a ref: it carries the SHA alone, and `<ref>` comes from the branch recorded beside it. An ancestor watermark reached from a sibling branch still scans fine, and a candidate a sibling's commits nominate is harmless, since the engine's re-verification decides every write — over-nominating costs nothing. Under-nominating is the failure that matters, and enumerating a ref the task's work is not on is how it happens: the range comes back empty and the brief reports no commits for work that is committed.

## The record — reconcile phase only

- **The scanned commit list** — dated, one line per commit — lands on the entry's `**Commits:**` line, the slot `./reconciliation.md` § *The record* fixes, in the run's `## Reconciliation — YYYY-MM-DD` entry, whose append-only history cannot overstate what the run found.
- **Cap 20 commits per entry.** Over the cap, list the 20 most recent and close with `showing 20 of M since <sha>`: a cut is stated, never silent.
- **No entry, no advance.** Where the run writes no `## Reconciliation` entry — nothing was actionable (`./reconciliation.md` § *Sequence and output*), or no `result.md` exists to hold one — the watermark does not move and no baseline is seeded: the advance and the record are one act, so the floor never passes commits nothing recorded. The next run re-scans the same range, which is the cost of that guarantee. A watermark write is itself an applied edit, so a run that has one to make is never the quiet run this bullet describes.
- **The watermark then advances** — rewrite the `**Pointers:**` entry to the scanned tip of `<ref>`, re-dated to today, in the Current state refresh (`./reconciliation.md` § *Current state refresh*), that block's world-truth surface staying live even on a `done` result.
- **A box this run checks links this run's own entry** — `([result](./result.md#reconciliation--YYYY-MM-DD))` — the entry being the evidence record for the advance. A second entry the same day takes the ` (2)` suffix, whose slug carries it as `-2` (`#reconciliation--YYYY-MM-DD-2`); linking the suffixed anchor is what keeps `scripts/health-check.ts`'s `dead-anchor` check green.

## Read/write split

The scan **reads** — `git log`, `git merge-base` — so it runs inside a strictly read-only brief. Every watermark **write** — seed, re-seed, advance — is a reconcile-phase edit under that direction's write surface: the brief never seeds, and never runs a candidate's `**Verify:**`, running one being the reconcile phase's act under the engine.

A candidate whose `**Verify:**` cannot re-run in the current run — a narrative criterion, a session-only artifact — surfaces with its box open, per `./reconciliation.md` § *Strengthen only on verified evidence*.
