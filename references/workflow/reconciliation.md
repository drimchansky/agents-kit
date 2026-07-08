# Reconciliation: Shared Contract

Some skills write a task folder's docs back into agreement with reality after the fact. There are two reconciliation **directions**, and **this file is the single source of truth for both** — the consent model, the write surface, the edit rules, and the record format. The **Shared mechanics** below hold for every reconciler; the **Direction rules** that follow apply only to the direction named. Each skill's SKILL.md carries its own finding-type → edit mapping.

- **Docs → reality (`-r` mode).** A skill that reports on a task folder accepts a `-r` flag that, after the report is printed, writes the report's findings back so the docs stop *overstating* what's been built. Two skills carry the flag today: `resume-task` (reconciles its brief's drift findings) and `review-task` (reconciles its review findings and folds engineer answers into the plan).
- **Session → docs.** `reconcile-task` reviews the current session against the task docs and writes back the information that surfaced in conversation but never reached the folder — the *enriching* direction. It has no flag; reconciling is its whole purpose, so it always writes — still printing the report first and asking about judgment items.

## Shared mechanics (all reconcilers)

### Consent model: obvious fixes only, ask for the rest

A reconciler applies **obvious** fixes without mid-run confirmation. A fix is obvious when the finding dictates exactly one edit: mechanical, evidence-backed, requiring no interpretation of intent, no choice among alternatives, and no wording beyond the documented annotation formats. (Passing `-r` is the consent for this in the docs-→-reality skills; invoking `reconcile-task` is the consent for it in the session direction.)

Everything else needs the engineer:

- Batch every judgment item into **one round of questions** after the report is printed (use the host agent's structured question tool when available; otherwise ask in chat). Reference the finding each question comes from and offer concrete options — not an open-ended "what should I do?".
- Apply only what the engineer actually answered — fold in exactly the answer given; don't redesign around it.
- Unanswered or declined items go to the "Not reconciled" list with the reason (`awaiting engineer answer`, or `needs real work via <skill>`).

### Docs, not the world

Reconciliation fixes the **docs, not the world**: no code changes, no git mutation, no writes to external systems. Every edit maps to a finding printed in the report (or to an engineer's answer about one) — a change without a finding behind it is invented detail; drop it. (The session direction may *run* verification to back a state change — see below — but running a check is read-only; it still changes no code and mutates nothing outside the task docs.)

### Skipped plans are exempt

A `skipped` plan is exempt from reconciliation entirely — it's terminal; report it as abandoned and write nothing, even if drift or missing information exists.

### The record

- **When `result.md` exists (or is created by the pairing repair)** — record every applied edit in one `## Reconciliation — YYYY-MM-DD` section appended to it (suffix ` (2)` if one for today already exists, keeping anchors unique). Prior sections — including a prior `## Acceptance` — are immutable; supersede them via this entry plus a status flip, never rewrite.
- **When no result file exists and none is owed** (the plan is still `to-do`, or was just reverted to it) — no result record for any edit made in this state; the printed change list is the record. Don't create a result file just to log reconciliation.

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill>` (`resume-task -r` / `review-task -r` / `reconcile-task`); report printed this session from pre-reconcile state.

- plan.md — Step 3 unchecked; shipped claim gone (`src/auth/handler.ts` no longer defines `validateToken`) — finding: Drift since plan [warn]. Prior record: `#step-3--add-token-validation`
- plan.md + result.md — Status `done` → `executing`; `## Acceptance` missing on a done plan — finding: Drift since plan [block]. `**Completed:**` line removed.
- CONTEXT.md — References: spec-doc link marked broken (404) — finding: References update [block]

**Not reconciled:**

- G2 regressed — needs real work: re-run the acceptance gate via `/implement-task <slug>`
- Step 5 Verify criterion vague — awaiting engineer answer

---
```

### Sequence and output

1. Print the skill's full report first — a faithful snapshot of **pre-reconcile** state, never regenerated after edits.
2. Auto-apply the obvious fixes, file-by-file: `result.md` first when a record is owed, then `plan.md`, then `CONTEXT.md`.
3. Ask the batched judgment questions; apply the answers.
4. Close with the change list (or `Nothing to reconcile.` when nothing was actionable — and write nothing, not even an empty Reconciliation entry):

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag], or: engineer answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation> (finding: …)

**Not reconciled:**

- <finding> — <needs real work via <skill> / awaiting engineer answer>
```

## Direction: docs → reality (`-r` — `resume-task`, `review-task`)

Findings come from a printed report comparing the docs against reality on disk, so this direction only ever *weakens* claims the docs overstate.

### Write surface

Exactly three task files, and nothing else:

- `plan.md` — checkboxes, the `**Status:**` header, and (with an engineer answer) step content within the review's scope: Verify criteria, gap details, the Scope partition, goal citations.
- `result.md` — append-only; see the record format above.
- `CONTEXT.md` — minimal annotations inside `## References` and `## Open Questions` only, per the carve-out in `./task-lifecycle.md`. Never the `**Status:**` origin marker, never prose rewrites.

`goals.md` is **never** edited — it is the user's contract. When a goal needs rewriting, print the suggested text for the user to apply; an engineer answer still goes to the user as text, not into the file. `-r` never re-runs the acceptance gate and never executes plan work.

### Weaken, never strengthen

Reconciliation in this direction may uncheck `- [x]` → `- [ ]`, flip `done → executing` or `in-review → executing`, or revert `executing → to-do`. It never checks a box, never sets `done` or `skipped`, and introduces `blocked` or `in-review` only by copying an already-evidenced sibling value. This holds **even with an engineer's answer** — "yes, that step was done" is a claim for `implement-task`'s verify gates to back, not for reconciliation to record. Engineer answers refine plan *content*; they never advance *state*.

## Direction: session → docs (`reconcile-task`)

Findings come from reviewing the current session against the docs, so this direction *enriches* — it writes information the docs are missing. It may write all four task files, under two guardrails that keep it from silently redefining what's built or what "done" means.

### Write surface

All four task files. `plan.md` and `result.md` as above, plus — only through a **confirmed** judgment item — `CONTEXT.md` prose sections (not annotation-only) and `goals.md`. Pure enrichment auto-applies: a new external reference into `## References`, an answered open question annotated in `## Open Questions`, session narrative appended to `result.md`.

### Strengthen only on verified evidence

This direction may **advance** state — check a `- [ ]` step `→ - [x]`, mark a goal `met`, flip `to-do → executing`, `executing → done` (or `executing → in-review` when the only unsatisfied goals are `(external)` ones still awaiting their proxy), or `in-review → done` — but only after **re-verifying** it in-session the way `implement-task`'s acceptance gate would (`../engineering/verification.md`), recording the evidence in `result.md`. A step or goal it cannot verify this session stays unrecorded and is surfaced instead. It never advances state on a bare conversational assertion — witnessed-and-verified, or not at all. The one sanctioned exception: for a goal marked `(external)`, whose verification lives outside the session by design, its best-available proxy — the confirmation, receipt, or observed live state the user reports — *is* witnessed-and-verified evidence (per `./acceptance-criteria.md`), so `in-review → done` may advance on that proxy.

### Grounding docs change by confirmation, never silently

Writing `goals.md`, `CONTEXT.md` prose (`Recommended Direction`, `MVP Scope`, `Not Doing`, `Key Assumptions`), or a step's scope — anything that redefines scope or acceptance — is a **judgment item**: it goes through the batched confirmation round, never an unprompted auto-apply. `goals.md` edits obey the durable-ID scheme in `./task-layout.md`: a new goal takes the next free `G<n>`, IDs are never renumbered and a retired ID is never reused, and the file keeps its no-`**Status:**` / no-`## Description` shape.
