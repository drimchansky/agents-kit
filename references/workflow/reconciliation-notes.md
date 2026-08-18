# Reconciliation: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contracts — `./reconciliation.md` and the two direction files, `./reconciliation-docs-to-reality.md` and `./reconciliation-session-to-docs.md` — are the sole source of truth for behavior. Where behavior and these notes disagree, the contracts win. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Maintaining the direction map

`./reconciliation.md`, the direction map. When a mapping changes, update it in the owning direction file first, then the skill whose report prints the corresponding finding. The contracts are the source of truth and the skills cite them, so the propagation runs one way only.

The map deliberately says just which skills write in which direction and where each direction's rules live. Everything the old single file said *about* a direction — what a composite's two phases do, why the enriching direction always writes — belongs to that direction's own file or to nothing at all.

## Why every edit needs a printed finding

`./reconciliation.md` § *Docs, not the world*. A change with no finding behind it is invented detail: the run would be authoring content while claiming to be recording it.

## Why a fact gets one home and a citation elsewhere

`./reconciliation.md` § *One home per fact*. Mirroring one finding into two files authors the next round of drift — the exact thing reconciliation exists to remove.

## Why the reporting skills don't sweep

`./reconciliation.md`, the direction map, and § *External reference check*. `resume-task` and `review-task` are read-only, so a finding they surfaced would evaporate with the run: there is nowhere for them to write it down. The check therefore lives in the reconcilers, where it can be acted on.

## Why the out-of-scope surfaces are out of scope

`./reconciliation.md` § *External reference check*, the out-of-scope list. Per surface:

- `result.md` below `## Current state`, and the append-only `## Decision log` — frozen history, only ever appended to (`./reconciliation.md` § *The record*); an annotation there would rewrite a record the contract calls immutable.
- The `## Current state` status gloss and `**Next:**` line — regenerated on every refresh (`./reconciliation.md` § *Current state refresh*), which would erase an annotation anyway.
- `goals.md` — the user's contract; reconciliation prints suggested text instead of editing.
- `CONTEXT.md` prose and `plan.md`'s other sections — rewritten wholesale by the skill that owns them, never annotated in place.

The common failure they share is having no owner to route a finding to. Sweeping them would persist an observation no repair row can act on, re-fetched every run for the life of the folder.

## What re-reporting a flag-only finding can and cannot promise

`./reconciliation.md` § *External reference check*, the never-annotated rule, item 4. Nothing is written into a never-annotated surface, and the ledger is rewritten wholesale with no pendency field of its own. So once a clean fetch re-tags a `warn` line `info`, there is nothing left for the next sweep to re-report from — that is the limit of what re-reporting can promise here, and stating it as unconditional would only be a rule no sweep could execute.

The same section's inclusion test turns on a surface being live and owned, not on the repair actually landing. Repair is the strongest form of landing, not the test itself.

## Why enumeration is the boundary, not the URL

`./reconciliation.md` § *External reference check*, the enumeration rule. The split is not disk versus network. A report phase verifies *claims* wherever their artifacts live — on disk, or in whatever artifact a claim names, including one behind a URL — while the sweep captures just enough per citation (title, status, last-updated) to judge freshness. Different cuts of one folder, which is why the same page can be reached both ways without conflict.

## Why a failed fetch keeps a carried tag

`./reconciliation.md` § *External reference check*, the `info` tag. The sweep learned nothing that would weaken what the last successful fetch established, and a tag that contradicts its own payload teaches the next reader the opposite of what was observed.

## Why compaction demands a `HEAD`-resolvable file

`./reconciliation-compaction.md`, the precondition. Two weaker preconditions were considered and rejected:

- **Repo membership** (`rev-parse --git-dir`) — an *ignored* task folder passes it while holding nothing in history, and `git status --porcelain` prints nothing for it, so both that precondition and the uncommitted-changes note would read clean over a file no commit can restore.
- **Being tracked** (`ls-files --error-unmatch`) — a staged-but-never-committed file passes while no commit holds its text. Index membership is not history.

Only a `HEAD`-resolvable version makes the tombstone's "full text in git history (pre-compaction state)" line true.

## Why `diagram.md` is never repaired

`./reconciliation-docs-to-reality.md` § *Write surface*, and the diagram rows in both directions. Repainting a diagram is authoring: it is interpretive, so it fails the obvious-fixes bar of `./reconciliation.md` § *Consent model: obvious fixes only, ask for the rest*. And a picture has no weaker direction for `./reconciliation-docs-to-reality.md` § *Weaken, never strengthen* to move in — there is no partial repaint that overstates less. A doc task's deliverable is excluded for the same reason, which is why both directions flag rather than edit.

## Where a flag can and cannot reach

`./reconciliation.md`, the direction map, the session → docs bullet. (`reconcile-task` takes no flag at all; the composite's flags are its review phase's, forwarded there and without effect on the write.)

## Why the record is not a second home

`./reconciliation.md` § *One home per fact*. (The `## Reconciliation` record is not a mirror — it logs the *edit*, not a second copy of the fact.)

## Why the sweep exemption changes no ownership

`./reconciliation.md` § *External reference check*, the exempt paragraph. The exemption transfers no ownership: `reconcile-task` stays this direction's sweep owner and still sweeps the same folder, so the folder's citations keep being swept and the sweep stays their only re-deriver.

## What the session direction's two guardrails are for

`./reconciliation-session-to-docs.md`, the opening paragraph, over §§ *Strengthen only on verified evidence* and *Grounding docs change by confirmation, never silently*. It may write all four core task files (the upstream `ticket.md` is read-only — a changed ask is surfaced, not written), under two guardrails that keep it from silently redefining what's built or what "done" means.
