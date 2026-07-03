# Reconcile Mode (`-r`): Shared Contract

Some skills that report on a task folder accept a `-r` flag that, after the report is printed, writes the report's findings back into the task docs so they match reality again. **This file is the single source of truth for that contract** — the consent model, the write surface, the edit rules, and the record format. Two skills carry the flag today: `resume-task` (reconciles its brief's drift findings) and `review-task` (reconciles its review findings and folds engineer answers into the plan). Each skill's SKILL.md carries its own finding-type → edit mapping; everything below applies to both.

## Consent model: obvious fixes only, ask for the rest

Passing `-r` consents to **obvious** fixes only — applied without mid-run confirmation. A fix is obvious when the finding dictates exactly one edit: mechanical, evidence-backed, requiring no interpretation of intent, no choice among alternatives, and no wording beyond the documented annotation formats.

Everything else needs the engineer:

- Batch every judgment item into **one round of questions** after the report is printed (use the host agent's structured question tool when available; otherwise ask in chat). Reference the finding each question comes from and offer concrete options — not an open-ended "what should I do?".
- Apply only what the engineer actually answered — fold in exactly the answer given; don't redesign around it.
- Unanswered or declined items go to the "Not reconciled" list with the reason (`awaiting engineer answer`, or `needs real work via <skill>`).

## Write surface

Exactly three task files, and nothing else:

- `plan.md` — checkboxes, the `**Status:**` header, and (with an engineer answer) step content within the review's scope: Verify criteria, gap details, the Scope partition, goal citations.
- `result.md` — append-only; see the record format below.
- `CONTEXT.md` — minimal annotations inside `## References` and `## Open Questions` only, per the carve-out in `./task-lifecycle.md`. Never the `**Status:**` origin marker, never prose rewrites.

`goals.md` is **never** edited — it is the user's contract. When a goal needs rewriting, print the suggested text for the user to apply; an engineer answer still goes to the user as text, not into the file. `-r` fixes the **docs, not the world**: no code, no acceptance-gate run, no git mutation, no writes to external systems. Every edit maps to a finding printed in the report (or to an engineer's answer about one) — a change without a finding behind it is invented detail; drop it.

## Weaken, never strengthen

Reconciliation may uncheck `- [x]` → `- [ ]`, flip `done → executing`, or revert `executing → to-do`. It never checks a box, never sets `done` or `skipped`, and introduces `blocked` only by copying an already-evidenced sibling value. This holds **even with an engineer's answer** — "yes, that step was done" is a claim for `implement-task`'s verify gates to back, not for reconciliation to record. Engineer answers refine plan *content*; they never advance *state*.

A `skipped` plan is exempt from reconciliation entirely — it's terminal; report it as abandoned and write nothing, even if drift exists.

## The record

- **When `result.md` exists (or is created by the pairing repair)** — record every applied edit in one `## Reconciliation — YYYY-MM-DD` section appended to it (suffix ` (2)` if one for today already exists, keeping anchors unique). Prior sections — including a prior `## Acceptance` — are immutable; supersede them via this entry plus a status flip, never rewrite.
- **When no result file exists and none is owed** (the plan is still `to-do`, or was just reverted to it) — no result record for any edit made in this state, whether an engineer-answered plan-content edit or the `executing → to-do` flip itself; the printed change list is the record. Don't create a result file just to log reconciliation.

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill> -r`; report printed this session from pre-reconcile state.

- plan.md — Step 3 unchecked; shipped claim gone (`src/auth/handler.ts` no longer defines `validateToken`) — finding: Drift since plan [warn]. Prior record: `#step-3--add-token-validation`
- plan.md + result.md — Status `done` → `executing`; `## Acceptance` missing on a done plan — finding: Drift since plan [block]. `**Completed:**` line removed.
- CONTEXT.md — References: spec-doc link marked broken (404) — finding: References update [block]

**Not reconciled:**

- G2 regressed — needs real work: re-run the acceptance gate via `/implement-task <slug>`
- Step 5 Verify criterion vague — awaiting engineer answer

---
```

## Sequence and output

1. Print the skill's full report first — a faithful snapshot of **pre-reconcile** state, never regenerated after edits.
2. Auto-apply the obvious fixes, file-by-file: `result.md` first when a record is owed, then `plan.md`, then `CONTEXT.md` annotations.
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
