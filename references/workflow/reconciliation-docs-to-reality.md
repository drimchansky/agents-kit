# Reconciliation: Docs → Reality

The direction `resume-task-reconcile` and `review-task-reconcile` write in. It runs on the shared mechanics in `./reconciliation.md` — consent model, reference sweep, record and annotation formats, `plan.md` openings, run sequence — which this file does not restate.

Findings come from a printed report comparing the docs against reality on disk, so this direction only ever *weakens* claims the docs overstate. Each composite adds `./reconciliation.md` § *External reference check*, which its reporting phase does not run.

## Write surface

Exactly four task files, and nothing else:

- `plan.md` — the five shared openings under this direction's constraints: it only ever clears a checkbox, never checks one, and `**Status:**` moves only downward (§ *Weaken, never strengthen*).
- `result.md` — append-only, except the `## Current state` block, rewritten in place (`./reconciliation.md` § *Current state refresh*); record format in that file's § *The record*.
- `CONTEXT.md` — minimal annotations inside `## References` and `## Open Questions` only, per the carve-out in `./task-lifecycle.md`. Never the `**Status:**` origin marker, never prose rewrites.
- `observations.md` — rewritten wholesale by the sweep: the check's own record, not an edit a finding evidences.

`diagram.md` is **never** edited in either direction — repainting is authoring, which fails the obvious-fixes bar and has no weaker direction to move in. Diagram drift is flagged, never repaired (shared repairs below).

`goals.md` and the upstream `ticket.md` are **never** edited: they are the user's contract. A goal needing a rewrite gets its suggested text printed for the user to apply; a changed *ask* is surfaced for the user to update the ticket. An engineer answer still goes to the user as text, not into the file. A doc task's **deliverable** is outside the surface for the same reason as the diagram — authored content, whose `**Published:**` line is `stage-doc`'s to flip or re-date: the sweep reads it, the never-annotated rule routes what it finds, nothing here writes it. This direction never re-runs the acceptance gate and never executes plan work.

## Weaken, never strengthen

Reconciliation in this direction may uncheck `- [x]` → `- [ ]`, flip `done → executing` or `in-review → executing`, or revert `executing → to-do`. It never checks a box, never sets `done` or `skipped`, and introduces `blocked` or `in-review` only by copying an already-evidenced sibling value. This holds **even with an engineer's answer** — "yes, that step was done" requires `implement-task`'s immediate outcome proof, and a changed-code run still needs that skill's declared health boundary before it is complete; neither is for reconciliation to record. Engineer answers refine plan *content*; they never advance *state*.

## Shared repairs (both composites)

Both composites apply these; only the evidence source differs (the resume brief's drift check, the review's cross-file consistency check, and — for the reference row — either pipeline's sweep). **auto** = obvious, applied unprompted; **ask** = engineer input first.

- **Unbacked `- [x]` step** — the shipped claim vanished (file gone, symbol removed, change reverted), or no result section backs the box — **auto**: flip it to `- [ ]` and drop its trailing `([result](…))` link; pending steps carry none, the record stays in `result.md`, and the Reconciliation entry cites the dropped anchor so it stays traceable. Never rewrite the step's **What**/**Verify**; never renumber.
- **Status-pairing / lifecycle repairs** — **auto**, always downward to the weaker claim. Never fabricate an `## Acceptance` section (that needs the gate run) or an invented cause, and never flip upward: those are flag only.
  - plan `done` + result `executing` → plan `executing`;
  - plan `executing` + result `blocked` with a `**Blocked:**` section, or `in-review` with an `**In review:**` section → plan to that status, copying the evidenced value;
  - plan `done`, result with no `## Acceptance` → flip plan and result `done → executing`, remove the result's closing `**Completed:**` line (header metadata, not narrative; `implement-task` re-adds it on re-finalize);
  - plan `executing`, no `result.md` → with checked steps or drift-verified shipped work, create a skeleton `result.md` (`implement-task`'s init header, `**Status:** executing`) holding the Reconciliation section and point the plan's `**Result:**` line at it; with zero evidence, flip `executing → to-do`, revert `**Result:**` to the pre-execution placeholder, create nothing; **ask** when the evidence is ambiguous (partial artifacts that may or may not be this task's work);
  - plan `blocked` or `in-review`, no `result.md` → **flag only**: the pairing section names a cause or pending goal that can't be invented;
  - plan `done`, no `result.md` → flip `done → executing` (nothing records the gate having run), then apply the no-`result.md` rule above;
  - a status outside the vocabulary registered in `./task-lifecycle.md` → **ask**; the intended state can't be inferred.
- **Result records work the plan doesn't show** (result section exists, plan still `- [ ]`) — flag only: checking the box would strengthen a claim this direction cannot attest. Name `implement-task` (or the user) to confirm and flip.
- **`diagram.md` no longer matches reality** — flag only, never an edit: repainting is outside this write surface entirely. Name the nodes or edges that no longer hold and name `implement-task`, whose gate re-check is the repair. A task with no diagram raises nothing.
- **Cited reference materially changed or gone** — `warn` (doc rewritten, ticket closed, PR merged) or `block` on a `**Pointers:**` entry (the artifact behind the pointer deleted or moved), beyond answering an open question. **auto** for the world-truth surfaces only: refresh the affected `**Pointers:**` entry in the Current state refresh — for a `block`, a dated gone/moved note keeping the identifier — and note the observation in the Reconciliation entry when other edits already warrant one, never appending one just for it. Then:
  - never a status flip on its own: a merged PR is not the acceptance gate;
  - a changed reference contradicting `CONTEXT.md` prose is **flag only** here, that prose never being rewritten in this direction — name `plan-task`;
  - a `block` on a `CONTEXT.md` or `plan.md` citing line takes the broken-link format of `./reconciliation.md` § *Annotation formats*, not this row; a `warn`/`block` on a never-annotated surface takes that file's never-annotated rule rather than either;
  - **route each citing occurrence by its own surface**: one URL named by both a `**Pointers:**` entry and the deliverable's `**Published:**` line produces both outcomes, never one in place of the other;
  - a **carried-forward tag routes no new edit**, and an already-correct gone/moved note is likewise a **no-op**, re-dated only when the observed failure itself changed (404 → moved, with a known target). A carried tag whose finding was **flag only** — the `CONTEXT.md`-prose contradiction above — is re-reported with its finding, not just its ledger line.
- **Never-annotated surface changed or broken** — `warn` or `block` on `ticket.md`, on a deliverable's `**Published:**` URL, or on the active pause section. `./reconciliation.md` § *External reference check*'s **never-annotated rule** governs and this row adds nothing, none of the three being in this write surface: on a `warn`, name the changed page and the claim it leaves stale (for a pause section, that the cause it names may no longer hold); on a `block`, name the page as gone.

## `resume-task-reconcile` — brief findings

Findings come from the brief's sections (Drift since plan, Open questions) and from this phase's own sweep — the brief itself sweeps nothing. Broken links and reference-answered questions use `./reconciliation.md` § *Annotation formats*; unbacked steps and status pairings use the shared repairs above. The rest:

- **A `met` goal no longer holds** — **auto**: no checkbox change by itself; flip plan and result `done → executing` (or `in-review → executing` when the regressed goal backs an in-review task); the Reconciliation entry names the regressed `G<n>` and supersedes the prior `## Acceptance`; "Not reconciled" names `implement-task`.
- **`[info]` findings** (pending artifact already exists, adjacent refactor, auth-walled link) — no edit; info stays info: checking a box or noting completion would strengthen a claim this direction cannot attest.
- **External blocker cleared** (PR merged, ticket closed) — the `blocked`-clearing case of *Cited reference materially changed or gone*: **apply that row in full**, its `**Pointers:**` refresh included, and **route by the surface the blocker is cited from** per that row's per-occurrence rule — a `**Pointers:**` entry takes the auto refresh; a URL cited only from the active pause section is **flag only** under the never-annotated rule, naming the cleared cause and writing nothing into the section. Its no-status-flip rule holds here for its own reason: `blocked` clears when work resumes, and reconciliation doesn't resume work. "Not reconciled" names `implement-task` either way.
- **Missing `goals.md` / missing `CONTEXT.md`** — cannot be fabricated; stays flagged, next skill `plan-task`.

## `review-task-reconcile` — assessment findings

Findings come from the assessment's sections and from this phase's own sweep — `review-task` sweeps nothing either; its reference findings take `./reconciliation.md` § *Annotation formats*, as on the resume side. Cross-file drift findings use the shared repairs above.

Most of this review's findings need the engineer — that is what the assessment's Questions section is for. Under this composite they are not left rhetorical: put them to the engineer as one batched round, the concrete options already attached, and write the answers into the plan exactly as given, with no redesign around them. The rest:

- **Scope partition not total** (a goal ID neither delivered nor deferred) — **ask**: deliver it, defer it, or drop the goal (dropping means the user edits `goals.md`); apply the chosen partition to the plan's `## Scope`.
- **Stale or orphan goal citations** (a step cites a goal ID absent from `goals.md`; a non-infra step cites nothing) — **ask**: point the citation at the right goal, mark the step `none (infra/refactor)`, or remove the step; apply the answer.
- **Vague or untestable Verify criterion** — **ask**, offering the concrete rewrite the assessment suggested; apply the accepted wording to the step's `**Verify:**` line.
- **Gaps and needs-clarification steps** — **ask** the targeted question from the Questions section; fold the answer into the step's **What**/**Verify** (or the plan's Scope).
- **Goal quality findings** (`weak` / `vague-or-untestable` / `unresolved`) — never edited: `goals.md` is the user's contract. Print the suggested rewrite for the user to apply; an engineer answer here still goes to the user as text.
- **CONTEXT ↔ goals / CONTEXT ↔ plan contradictions** — **ask** which side is right, applying the resolution only where the write surface allows: the plan's Scope/steps, or an annotation in CONTEXT's `## Open Questions` recording the ruling. CONTEXT prose (MVP scope, "Not Doing", Recommended Direction) is never rewritten — a ruling that changes direction is re-planning; name `plan-task`.
- **Restated grounding** (the same decision, finding, or question maintained in both `CONTEXT.md` and `plan.md`) — **ask**: confirm the fact's home (`./one-home.md` § *One home per fact* — grounding's home is `CONTEXT.md`) and whether the copies still agree, then collapse the restated content on the **plan side** to a citation of the home section, preserving any plan-time deltas interleaved with it. Never auto-applied: separating restatement from delta and choosing the surviving copy is interpretive, and diverged copies are a contradiction to rule on first (the row above). The CONTEXT side is never rewritten here; if the plan copy carries newer content that should become the grounding, that's a `reconcile-task` (session → docs) or `plan-task` job.
- **Infeasible or conflicts-with-existing steps** — flag only: fixing them is redesign, out of scope even here; name `plan-task`.
