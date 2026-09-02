# Reconciliation: Shared Contract

Some skills write a task folder's docs back into agreement with reality after the fact. There are two reconciliation **directions**, and this file is the **single source of truth for the mechanics they share** — consent model and mapping legend, record and annotation formats, the surfaces neither direction writes, `plan.md` openings, run sequence, and the verify-and-write engine every state advance goes through, plus the satellites it names for the reference sweep's mechanics (`./reconciliation-sweep.md`), the commit scan (`./reconciliation-commits.md`), and compaction (`./reconciliation-compaction.md`). Each direction's write surface, edit rules, and finding-type → edit mappings live in its own file; the skills cite these files rather than restating them.

- **Docs → reality** (`./reconciliation-docs-to-reality.md`) — the composites `resume-task-reconcile` and `review-task-reconcile`, which report on a task folder, then write that report's findings back so the docs stop *overstating* what's built. The base skills they run, `resume-task` and `review-task`, are strictly read-only *and* sweep no citations of their own: they may read what a *claim* points at, never the folder's reference list, so every link cited from an actionable surface reaches the docs through a reconciler.
- **Session → docs** (`./reconciliation-session-to-docs.md`) — `reconcile-task`, which reviews the current session against the docs and writes back what surfaced in conversation but never reached the folder: the *enriching* direction. It gates its write behind no flag — writing back is the whole purpose of the skill, so it always writes.

## Consent model: obvious fixes only, ask for the rest

A reconciler applies **obvious** fixes without mid-run confirmation. A fix is obvious when the finding dictates exactly one edit: mechanical, evidence-backed, needing no interpretation of intent, no choice among alternatives, and no wording beyond the documented annotation formats. (A *user's* invocation is that consent in either direction. These skills are model-invocable, so a run the user did not ask for carries no such consent: it asks before applying even an obvious fix, reading which door it came through per `./skill-conventions.md` § *The invocation gate*.)

Everything else needs the engineer:

1. Batch every judgment item into **one round of questions** after the report is printed — the host agent's structured question tool when available, otherwise chat. Reference the finding each question comes from and offer concrete options, not an open-ended "what should I do?".
2. Apply only what the engineer actually answered: exactly the answer given, no redesign around it.
3. Unanswered or declined items go to the "Not reconciled" list with the reason (`awaiting engineer answer`, or `needs real work via <skill>`).

## The mapping legend

Every row of a direction file's finding-type → edit mapping carries the route it takes, and the four values mean the same thing in both directions. **This section is the one home for them**; the direction files cite it rather than restating it.

- **auto** — obvious, applied unprompted (§ *Consent model: obvious fixes only, ask for the rest*).
- **ask** — the engineer first, in that section's one batched round.
- **verify** — only after re-verifying the claim in the current run (§ *Strengthen only on verified evidence*): the finding nominates, the re-run attests.
- **flag only** — no edit at all: surfaced with the owner who can repair it named, and re-reported per § *Flag-only findings are re-reported*.

## Docs, not the world

Reconciliation fixes the **docs, not the world**: no code changes, no git mutation, no writes to external systems. Every edit maps to a finding printed in the report, or to an engineer's answer about one; drop anything else. Two run-record writes are the registered exceptions, each licensed where it is defined rather than by a finding: the sweep's `observations.md` rewrite or removal (`./reconciliation-sweep.md`) and the commit watermark's seed, re-seed, and advance (`./reconciliation-commits.md` § *Degenerate cases* for the first two, § *The record* for the advance). (A reconciler may *run* verification to back a state change, but running a check is read-only — no code changes, nothing outside the task docs mutates.)

## One home per fact

Every task-folder fact has one home file, and reconciliation respects it (`./one-home.md` § *One home per fact*): an edit records a finding **once**, in its home — grounding in `CONTEXT.md`, acceptance in `goals.md`, execution content in `plan.md`, history in `result.md`, an answer where its question lives. The upstream *ask* lives in `ticket.md`, **read-only** here: a changed ask is surfaced for the user, never written. A sibling needing the fact gets a `./` citation, never a copy.

## Strengthen only on verified evidence

A reconciler may **advance** state — check a `- [ ]` step `→ - [x]`, mark a goal `met`, flip `to-do → executing`, `executing → done` (or `executing → in-review` when the only unsatisfied goals are `(external)` ones still awaiting their proxy), or `in-review → done` — but only after **re-verifying** the claim in the current run the way `implement-task` would: a step's full unit-outcome tier (`./execution-loop.md` § *Two verification tiers*) and a goal's acceptance behavior, against the resolved domain's `verification.md` (`../engineering/verification.md` when the domain is code). What **nominates** a claim for verification is the direction's own evidence source — the session's witnessed work, a report's findings — and nomination is never evidence: only the re-run verification is. Before any advance that presents the task as complete — `executing → done`, `executing → in-review`, or `in-review → done`, each of which reports implementation finished — the resolved domain's integrated-health recipe must freshly pass in the current reconciliation run on the current work product (`../engineering/verification.md` § *Two verification tiers* for code, `../documentation/verification.md` § *Integrated health — declared boundaries* for documents), regardless of whether the run changed work-product bytes. The durable record carries no exact work-product identity for an earlier boundary, so it cannot establish that earlier evidence belongs to the current state across runs; no earlier health evidence may be reused (`./execution-loop.md` § *Health boundaries*). Two of those advances owe a second precondition: for `executing → done` and `executing → in-review`, a task carrying a `diagram.md` whose shape the shipped work has diverged from is a **stop** — the run stays at `executing` and flags the divergence, naming the stale nodes or edges and naming `implement-task`, whose gate re-check repaints them. Neither direction may repaint (§ *Authored surfaces are never written*), so finalizing behind a stale diagram would launder the gap; a task with no diagram raises nothing, and `in-review → done` sits outside the stop, its shape gated when the task parked. A non-final advance — a step's box, a goal recorded `met` short of finalizing — owes its unit-outcome tier and no more, exactly as a step between boundaries does (`./execution-loop.md` § *Health boundaries*). **This section is the one home for both preconditions**; the direction files and the skills running them cite it rather than restating either trigger. Record the fresh evidence as the entry's `**Health:**` line (§ *The record*). A step or goal a reconciler cannot verify in the current run stays unrecorded and is surfaced instead. State never advances on a bare conversational assertion — witnessed-and-verified, or not at all. The one sanctioned exception: for a goal marked `(external)`, whose verification lives outside the run by design, the best-available proxy — the confirmation, receipt, or observed live state the user reports — *is* witnessed-and-verified evidence (per `./acceptance-criteria.md`), so `in-review → done` may advance on it.

## Skipped plans are exempt

A `skipped` plan is exempt from reconciliation entirely — it's terminal; report it as abandoned, run no reference sweep, and write nothing, even if drift or missing information exists.

## The reference sweep

The **reference sweep** re-derives the freshness of the external systems a task folder cites. A reconciler runs the sweep while assembling its finding set, and the sweep is the **only** re-deriver of cited-reference freshness (`./one-home.md` § *One home per fact*, external-system facts). Its mechanics — the `observations.md` ledger, the in- and out-of-scope surfaces, fetching, tags, and output routing — are `./reconciliation-sweep.md`; read it before sweeping.

## Authored surfaces are never written

`diagram.md` and a doc task's **deliverable** sit outside both directions' write surfaces: repainting a diagram or supplying deliverable content is **authoring**, which fails the obvious-fixes bar (§ *Consent model: obvious fixes only, ask for the rest*) and offers § *Strengthen only on verified evidence* no `**Verify:**` criterion to attest it with instead. Divergence is therefore **flag only**: name the stale nodes or edges, or the deliverable section and what it should carry, name `implement-task`, whose gate re-check repaints a diagram, and write nothing; a task with no diagram, or no deliverable, raises nothing. **This section is the one home for the exclusion and its flag**; each direction file adds only its own nomination source and routing. A deliverable's `**Published:**` line is not this section's — it is a swept citation surface, routed by § *Never-annotated surfaces*.

## Never-annotated surfaces

Three swept surfaces are never written into: `ticket.md`, a deliverable's `**Published:**` line, and the active pause section. All three stay in scope as **live citation surfaces the folder maintains, with a named owner for a `warn` or `block`** — the inclusion test every out-of-scope surface fails (`./reconciliation-sweep.md` § *Scope*). **The never-annotated rule** the direction mappings cite rather than restate: a `warn` or `block` cited from one of the three is **flag only** —

1. surfaced with its owner named: `ticket.md` → the user, whose ask it states; `**Published:**` → the user, who owns the authority claim on the deliverable's published copy and decides the repair; the active pause section → `implement-task`, which clears a blocker by resuming work;
2. noted in the Reconciliation entry only when other edits already warrant one, never appended just for it;
3. never written into the file;
4. **repaired only at the owning surface** — the user editing `ticket.md` (citation corrected, or the ask restated when the fetch shows the ask itself moved), the user re-dating the `**Published:**` line, or `implement-task` clearing the blocker and closing the section — and re-reported until then, per § *Flag-only findings are re-reported*.

## Flag-only findings are re-reported

A finding routed **flag only** — every finding on the three surfaces above, and every mapping row marked so — is re-reported *with its finding*, never reduced to its ledger line, until the owner named with it records the repair. Re-reporting reaches exactly as far as a tag still carries the finding, and no further: **every** sweep on a fetched `block`, **every** sweep on a carried `warn`/`block`, but **once** for a `warn` that a later clean fetch re-tags `info` (`./reconciliation-sweep.md` § *Tags*), past which no observation carries it. **This section is the one home for the rule and fixes its one scope**; the direction files and `./reconciliation-sweep.md` cite it rather than restating either.

## The record

- **`result.md` exists (or is created by the missing-companion repair)** — record every applied edit in one `## Reconciliation — YYYY-MM-DD` section appended to it (suffix ` (2)` if one for today exists, keeping anchors unique). Prior sections, a prior `## Acceptance` included, are immutable: supersede via this entry plus the plan's status flip, never rewrite. Two surfaces sit outside the rule — `## Current state`, derived header metadata (contract in `./task-authorship.md`) rewritten in place, never appended; and `## Decision log`, an append-only index of dated pointer lines, appended, never rewritten.
- **No result file exists and none is owed** (the plan is still `to-do`, or was just reverted to it) — no result record for any edit made in this state; the printed change list is the record. Don't create a result file just to log reconciliation.

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill>`; report printed this session from pre-reconcile state.
**Health:** <the boundary this run's advance required, recorded to the shape the resolved domain fixes (`../engineering/verification.md` § *What a boundary records* for code); omit when no advance required one>
**Commits:** <the scan's dated commit list, one line per commit, when a scan ran; `./reconciliation-commits.md` § *The record* fixes the line content and the cap>

- plan.md — Step 3 unchecked; shipped claim gone (`src/auth/handler.ts` no longer defines `validateToken`) — finding: Drift since plan [warn]. Prior record: `#step-3--add-token-validation`
- CONTEXT.md — References: spec-doc link marked broken (404) — finding: References [block]

**Not reconciled:**

- G2 regressed — needs real work: re-run the acceptance gate via `/implement-task <slug>`
- Step 5 Verify criterion vague — awaiting engineer answer

---
```

## Annotation formats

Two in-place annotations recur across skills; the formats below fix the wording and the line each anchors to, so reconcilers invent neither. Which files they may be written in is the direction's write surface.

- **Broken external link** — **auto**: append `— _broken as of YYYY-MM-DD (404)_` to the citing line (`CONTEXT.md`'s References or `## Open Questions`, a `plan.md` step or its `## Open Questions`), or swap in the new URL when a redirect target is known. **An annotation already correct on that line is a no-op**, re-dated in place only when the observed failure itself changed (404 → moved, with a known target), never appended twice. The three never-annotated surfaces take the never-annotated rule (§ *Never-annotated surfaces*) instead, never this format; prior `result.md` sections and `goals.md` carry no swept links at all (`./reconciliation-sweep.md` § *Scope*), so nothing there is annotatable.
- **Answered open question** — **auto** only when the source answers it unambiguously (quote or tightly paraphrase it): append `— _answered YYYY-MM-DD: <answer> ([source](url) when there is one)_` to the question line in `CONTEXT.md`'s or `plan.md`'s Open Questions. **Ask** when the answer needs interpretation. A goal marked `_(unresolved: …)_` is never annotated in `goals.md` — it is surfaced in chat (docs → reality), or handled through the new-goal confirmation row (session → docs).

**A carried-forward tag routes no new edit** in either direction: this sweep's fetch established nothing, so the last observation's `warn`/`block` simply stands (`./reconciliation-sweep.md` § *Tags*). The no-op above holds identically for an already-correct gone/moved note on a `**Pointers:**` entry — re-dated only when the observed failure itself changed, never written twice. **This section is the one home for both no-ops**; the direction files cite it rather than restating either. What a carried tag does still route is its *finding*, where that was flag only (§ *Flag-only findings are re-reported*).

## Cited reference changed

The sweep's `warn` (doc rewritten, ticket closed, PR merged) or `block` on a `**Pointers:**` entry — the artifact behind the pointer deleted or moved — beyond answering an open question, which takes § *Annotation formats* instead. **This section is the one home for the row**; each direction file cites it and names only which of the deltas below it takes. **auto** for the world-truth surfaces only: refresh the affected `**Pointers:**` entry in § *Current state refresh* — for a `block`, a dated gone/moved note keeping the identifier — and note the observation in the `## Reconciliation` entry when other edits already warrant one, never appending one just for it. Then:

- never a status flip on its own: a merged PR is not the acceptance gate, and `blocked` clears when work resumes, and reconciliation doesn't resume work;
- a `block` on a `CONTEXT.md` or `plan.md` citing line takes the broken-link format of § *Annotation formats*, not this row; a `warn`/`block` on a never-annotated surface takes § *Never-annotated surfaces* rather than either;
- **route each citing occurrence by its own surface** (`./reconciliation-sweep.md` § *Fetching*): one URL named by both a `**Pointers:**` entry and the deliverable's `**Published:**` line produces both outcomes, never one in place of the other;
- a carried-forward tag and an already-correct gone/moved note route nothing new (§ *Annotation formats*); where that carried tag's finding was flag only, or its ask declined or unanswered, the finding itself is re-reported (§ *Flag-only findings are re-reported*).

**Two deltas, one per direction**, on the one case the directions route apart — a changed reference contradicting `CONTEXT.md` prose:

- **docs → reality** — **flag only**, that prose never being rewritten in that direction: name `plan-task`.
- **session → docs** — an **ask**, per that direction's `./reconciliation-session-to-docs.md` § *Grounding docs change by confirmation, never silently*.

## Current state refresh

Every reconciler that writes `result.md` closes by rewriting its `## Current state` block to post-edit reality, superseded detail dropped; history lives in the log. The block's shape, budget, and legacy-result rule are the contract in `./task-authorship.md`, which this section does not restate — what it fixes is which run rewrites the block, and how far. By the plan's status when the run began:

- **Live (`executing`/`blocked`/`in-review`) — full rewrite:** every field of the block re-derived, `**Next:**` naming the concrete next action. The `**Pointers:**` rewrite carries the commit watermark forward untouched, as that contract binds every writer of the field; a reconciler is additionally the only thing that *advances* it, and only where `./reconciliation-commits.md` says. In either direction the rewrite is re-derivation of a digest constrained by the plan's `**Status:**`, never a claim of its own: that `**Status:**` and its checkboxes move under the direction's own rules — a downward repair, or an advance through § *Strengthen only on verified evidence* — and the digest follows wherever the run left them.
- **The plan already `done` when the run began — partial freeze:** the narrative half, gloss and `**Next:**`, stays frozen as the final digest (`./task-authorship.md`: that half is expected while the plan is live), so a finding against a completed task is never recorded by re-glossing it.
- **Exempt from that freeze — `**Pointers:**`:** its entries digest world-truth whose home, `observations.md`, is rewritable by design (`./one-home.md` § *One home per fact*), so a moved or merged reference updates the entry on a `done` result exactly as on a live one, `_Updated:_` re-dated to say when.
- **Outside the freeze — two runs rewrite in full:** one that itself *reaches* a terminal state writes the final digest first and freezes after, as `implement-task` closes both terminal branches; and one that first flips a `done` plan back to `executing` is refreshing a live result again.

## The `plan.md` write surface

Every reconciler writes `plan.md` through the same five shared openings; the session direction adds two of its own (see its write surface). Nothing else in `plan.md` is written in either direction. Which of the five a direction may use, and which way each may move, is the direction rule's business.

- step **checkboxes**, plus the trailing `([result](…))` link the box's new state requires — dropped when a box is cleared; added, pointing at the section recording the evidence, when one is checked (a box is checked in either direction only through § *Strengthen only on verified evidence*, and a `- [x]` step always carries its link);
- the `**Status:**` header (§ *Strengthen only on verified evidence* for any advance, `./reconciliation-docs-to-reality.md` § *Repairs weaken; advances go through the shared engine* for that direction's repairs);
- the `**Result:**` link-header — repointed at a skeleton `result.md`, or reverted to the pre-execution placeholder (docs → reality's shared repairs);
- the two annotations fixed above — broken-link on a step's citing line or a line in `## Open Questions`, answered-question on a line in `## Open Questions` — under the auto/ask condition those formats set;
- step content within the finding's scope, on the engineer's word only (an answer to the review's batched Questions under `review-task-reconcile`, a confirmed judgment item in the session direction): Verify criteria, gap details, the Scope partition, goal citations, and collapsing restated grounding to a citation of its home section (§ *One home per fact*).

**Step numbers are stable across both directions.** No reconciler renumbers: existing numbers are the `#step-<n>--<slug>` anchors that `result.md`'s immutable prior sections carry and checked steps link to, so a renumber strands a record that can't be rewritten to match. Where a direction may insert a step, it inserts as `Step 3a` / `Step 3b` rather than shifting its siblings.

## Sequence and output

1. Print the skill's full report first — a faithful snapshot of **pre-reconcile** state, never regenerated after edits. Where the skill collects the sweep as one of its *own* findings (`reconcile-task`), run the sweep before composing that report, which renders the `## References` block inline and isn't complete without it.
2. Run the reference sweep (`./reconciliation-sweep.md`), **always before any edit**, and before composing the report in the case step 1 names. Its `## References` block prints where the run's report puts it: inline where the reconciler owns its own report, at the start of the reconcile phase where a composite's first phase owns it. Its tagged entries join the report's findings as evidence for the edits below, and its `observations.md` rewrite lands with the sweep — part of the check, not one of the edits.
3. Auto-apply the obvious fixes, file-by-file: `result.md` first when a record is owed, then `plan.md`, then `CONTEXT.md`.
4. Ask the batched judgment questions; apply the answers.
5. Refresh `## Current state` (§ *Current state refresh*).
6. Close with the change list (or `Nothing to reconcile.` when nothing was actionable — writing nothing beyond the sweep's `observations.md` rewrite, not even an empty Reconciliation entry, and so advancing no watermark either (`./reconciliation-commits.md` § *The record*: the advance and the record are one act)):

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag], or: engineer answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation> (finding: …)

**Not reconciled:**

- <finding> — <needs real work via <skill> / awaiting engineer answer>
```
