# Reconciliation: Shared Contract

Some skills write a task folder's docs back into agreement with reality after the fact. There are two reconciliation **directions**, and this file is the **single source of truth for the mechanics they share** — consent model and mapping legend, record and annotation formats, the surfaces neither direction writes, `plan.md` openings, run sequence, and the verify-and-write engine every state advance goes through, plus the satellites it names for the reference sweep's mechanics (`./reconciliation-sweep.md`), the commit scan (`./reconciliation-commits.md`), and compaction (`./reconciliation-compaction.md`). Each direction's write surface, edit rules, and finding-type → edit mappings live in its own file; the skills cite these files rather than restating them.

- **Docs → reality** (`./reconciliation-docs-to-reality.md`) — the composites `resume-task-reconcile` and `review-task-reconcile`, which report on a task folder, then write that report's findings back so the docs stop *overstating* what's built. The base skills they run, `resume-task` and `review-task`, are strictly read-only *and* sweep no citations of their own: they may read what a *claim* points at, never the folder's reference list, so every link cited from an actionable surface reaches the docs through a reconciler.
- **Session → docs** (`./reconciliation-session-to-docs.md`) — `reconcile-task`, which reviews the current session against the docs and writes back what surfaced in conversation but never reached the folder: the *enriching* direction. It gates its write behind no flag — writing back is the whole purpose of the skill, so it always writes.

## Consent model: findings apply, the record carries them

A reconciler applies **every** fix its findings evidence, and asks nothing mid-run. Two routes reach that outcome. A fix is **obvious** when the finding dictates exactly one edit: mechanical, evidence-backed, needing no interpretation of intent, no choice among alternatives, and no wording beyond the documented annotation formats. A fix is **judged** when the finding admits more than one defensible edit — a goal to reword, a scope partition to settle, a contradiction between two artifacts to rule on. There the reconciler picks the reading its evidence best supports and writes it. (A *user's* invocation is that consent in either direction. These skills are model-invocable, so a run the user did not ask for carries no such consent: it asks before applying even an obvious fix, reading which door it came through per `./skill-conventions.md` § *The invocation gate*.)

**Applying is not hiding.** A judged edit is licensed by the record it leaves, so it owes the `## Reconciliation` entry two things past the edit itself: the readings it passed over, and what chose between them (§ *The record*). An edit whose alternatives cannot be named that way was never a judged fix — it is a redesign, which no reconciler performs; route it **flag only** to the skill that owns the redesign. What a run leaves unwritten goes to the "Not reconciled" list, each line opening with one of two labels — **this section is the one home for the labels**; the direction files and the skills cite it rather than restating it:

- **Needs work** — the docs can't carry the fix, or the run could not re-verify the claim; the line names the skill (`via /implement-task <slug>`, `via /plan-task <slug>`), with the reason where a criterion isn't re-runnable. A mapping row saying "Not reconciled" names `implement-task` or `plan-task` lands here, and so does every step or goal surfaced unverified.
- **Yours to apply** — the single user-owned surface no reconciler writes: a deliverable's `**Published:**` line (§ *Never-annotated surfaces*). The proposed text is attached, so the repair is a paste.

## The mapping legend

Every row of a direction file's finding-type → edit mapping carries the route it takes, and the four values mean the same thing in both directions. **This section is the one home for them**; the direction files cite it rather than restating it.

- **auto** — obvious, applied unprompted (§ *Consent model: findings apply, the record carries them*).
- **judged** — more than one defensible edit; the run chooses on its evidence, applies, and records the alternatives it declined, per that same section.
- **verify** — only after re-verifying the claim in the current run (§ *Strengthen only on verified evidence*): the finding nominates, the re-run attests.
- **flag only** — no edit at all: surfaced with the owner who can repair it named, and re-reported per § *Flag-only findings are re-reported*.

## Docs, not the world

Reconciliation fixes the **docs, not the world**: no code changes, no git mutation, no writes to external systems. Every edit maps to a finding printed in the report; drop anything else. Two run-record writes are the registered exceptions, each licensed where it is defined rather than by a finding: the sweep's `observations.md` rewrite or removal (`./reconciliation-sweep.md`) and the commit watermark's seed, re-seed, and advance (`./reconciliation-commits.md` § *Degenerate cases* for the first two, § *The record* for the advance). (A reconciler may *run* verification to back a state change, but running a check is read-only — no code changes, nothing outside the task docs mutates.)

## One home per fact

Every task-folder fact has one home file, and reconciliation respects it (`./one-home.md` § *One home per fact*): an edit records a finding **once**, in its home — grounding in `CONTEXT.md`, acceptance in `goals.md`, execution content in `plan.md`, history in `result.md`, an answer where its question lives. The upstream *ask* lives in `ticket.md`, which a reconciler writes on the added terms of § *The upstream ask is writable, and never rewritten quietly*. A sibling needing the fact gets a `./` citation, never a copy.

## Grounding docs change on evidence, never silently

Writing `goals.md`, `CONTEXT.md` prose (`Recommended Direction`, `MVP Scope`, `Not Doing`, `Key Assumptions`), or a step's scope — anything that redefines scope or acceptance — is a **judged** edit in either direction (§ *Consent model: findings apply, the record carries them*): the run applies it on its own evidence, and the `## Reconciliation` entry carries the before and after wording plus the readings it declined. What nominates the change is the direction's own evidence source — a session decision, a review's suggested rewrite, a ruling on a contradiction. What licenses it is that the change is **recorded**: never mixed into an unrelated edit's line, never left to a diff the engineer has to reconstruct. `goals.md` edits obey the durable-ID scheme in `./task-goals.md`: a new goal takes the next free `G<n>`, IDs are never renumbered, a retired ID is never reused, and the file keeps its no-`**Status:**` / no-`## Description` shape. The upstream `ticket.md` takes § *The upstream ask is writable, and never rewritten quietly* on top of this one. **This section is the one home for the rule**; the direction files and the skills cite it rather than restating it.

Redefining scope does not redefine what was *achieved*. A goal reworded, retired, or added by a run is not thereby met, and a scope partition rewritten to defer a goal does not deliver it: an acceptance verdict moves only through § *Strengthen only on verified evidence*, whose re-verification this section never substitutes for. A run that edits `goals.md` and in the same breath records a goal `met` on that edit alone has graded its own paper — every verdict it reports is void, and the next run re-derives them.

## The upstream ask is writable, and never rewritten quietly

`ticket.md` states the product-facing ask the goals derive from, and an applicable `GROUP_CONTEXT.md` (`./task-store.md` § *Shared group context*) states grounding shared by every task under it. Both are **writable** by either direction, as **judged** edits under the consent model, so a correction lands where it belongs instead of being handed back as a paste. Both reach past this task folder, which fixes what a write to them owes:

1. **The record names the surface as external.** The `## Reconciliation` entry's line for a group-file edit gives that file's path from the selected root; for `ticket.md`, the section rewritten. A shared surface changed without that line is the one failure this rule exists to stop.
2. **Quote what changed on both sides.** A group file governs siblings this run never read, and a ticket states an ask the run did not receive: the entry carries the prior wording and the new, so the owner can reverse it by reading one entry.
3. **Edit the statement, never the standard it is measured by in this run.** A ticket rewritten to match what was built, or a group constraint relaxed because a step tripped on it, is drift laundering — route it *Needs work* naming `plan-task` instead. What licenses a ticket edit is evidence the *ask itself* moved (the requester said so, the linked source changed), not evidence the work diverged from it.
4. **A changed ask still re-derives goals.** Writing `ticket.md` does not update `goals.md` in step: name `plan-task` under "Not reconciled" when the new ask reaches criteria the goals don't cover, since deriving goals from an ask is planning, not reconciliation.

**This section is the one home for the rule**; the direction files and the skills cite it rather than restating it.

## Strengthen only on verified evidence

A reconciler may **advance** state — check a `- [ ]` step `→ - [x]`, mark a goal `met`, flip `to-do → executing`, `executing → done` (or `executing → in-review` when the only unsatisfied goals are `(external)` ones still awaiting their proxy), or `in-review → done` — but only after **re-verifying** the claim in the current run the way `implement-task` would: a step's full unit-outcome tier (`./execution-loop.md` § *Two verification tiers*) and a goal's acceptance behavior, against the resolved domain's `verification.md` (`../engineering/verification.md` when the domain is code). What **nominates** a claim for verification is the direction's own evidence source — the session's witnessed work, a report's findings — and nomination is never evidence: only the re-run verification is. Before any advance that presents the task as complete — `executing → done`, `executing → in-review`, or `in-review → done`, each of which reports implementation finished — the resolved domain's integrated-health recipe must freshly pass in the current reconciliation run on the current work product (`../engineering/verification.md` § *Two verification tiers* for code, `../documentation/verification.md` § *Integrated health — declared boundaries* for documents), regardless of whether the run changed work-product bytes. The durable record carries no exact work-product identity for an earlier boundary, so it cannot establish that earlier evidence belongs to the current state across runs; no earlier health evidence may be reused (`./execution-loop.md` § *Health boundaries*). A non-final advance — a step's box, a goal recorded `met` short of finalizing — owes its unit-outcome tier and no more, exactly as a step between boundaries does (`./execution-loop.md` § *Health boundaries*). **This section is the one home for that precondition**; the direction files and the skills running them cite it rather than restating its trigger. Record the fresh evidence as the entry's `**Health:**` line (§ *The record*). A step or goal a reconciler cannot verify in the current run stays unrecorded and is surfaced instead. State never advances on a bare conversational assertion — witnessed-and-verified, or not at all. The one sanctioned exception: for a goal marked `(external)`, whose verification lives outside the run by design, the best-available proxy — the confirmation, receipt, or observed live state the user reports — *is* witnessed-and-verified evidence (per `./acceptance-criteria.md`), so `in-review → done` may advance on it.

## Skipped plans are exempt

A `skipped` plan is exempt from reconciliation entirely — it's terminal; report it as abandoned, run no reference sweep, and write nothing, even if drift or missing information exists.

## The reference sweep

The **reference sweep** re-derives the freshness of the external systems a task folder cites. A reconciler runs the sweep while assembling its finding set, and the sweep is the **only** re-deriver of cited-reference freshness (`./one-home.md` § *One home per fact*, external-system facts). Its mechanics — the `observations.md` ledger, the in- and out-of-scope surfaces, fetching, tags, and output routing — are `./reconciliation-sweep.md`; read it before sweeping.

## Authored surfaces are never written

A doc task's **deliverable** sits outside both directions' write surfaces: supplying deliverable content is **authoring**, not choosing among readings a finding leaves open, so it is neither of the two routes § *Consent model: findings apply, the record carries them* recognizes, and it offers § *Strengthen only on verified evidence* no `**Verify:**` criterion to attest it with instead. Divergence is therefore **flag only**: name the deliverable section and what it should carry, name `implement-task`, and write nothing; a task with no deliverable raises nothing. **This section is the one home for the exclusion and its flag**; each direction file adds only its own nomination source and routing. A deliverable's `**Published:**` line is not this section's — it is a swept citation surface, routed by § *Never-annotated surfaces*.

## Never-annotated surfaces

Two swept surfaces are never written into: a deliverable's `**Published:**` line, and the active pause section. Both stay in scope as **live citation surfaces the folder maintains, with a named owner for a `warn` or `block`** — the inclusion test every out-of-scope surface fails (`./reconciliation-sweep.md` § *Scope*). What keeps them out is not consent but attestation: each states something only its owner can establish. **The never-annotated rule** the direction mappings cite rather than restate: a `warn` or `block` cited from one of the two is **flag only** —

1. surfaced with its owner named: `**Published:**` → the user, who owns the authority claim on the deliverable's published copy and decides the repair; the active pause section → `implement-task`, which clears a blocker by resuming work;
2. noted in the Reconciliation entry only when other edits already warrant one, never appended just for it;
3. never written into the file;
4. **repaired only at the owning surface** — the user re-dating the `**Published:**` line, or `implement-task` clearing the blocker and closing the section — and re-reported until then, per § *Flag-only findings are re-reported*.

**`ticket.md` and an applicable `GROUP_CONTEXT.md` are not among them**, though both reach past the folder the same way: they are writable, on the added terms in § *The upstream ask is writable, and never rewritten quietly*. A `warn` or `block` cited from the ticket takes the ordinary broken-link format of § *Annotation formats*, and a correction whose home is a group file is applied there. A group file is still not *swept*: it reaches a run off disk rather than through an enumerated citation, so it passes no inclusion test and offers the sweep nothing to fetch, and the URLs inside it stay unswept, unannotated, and undated by anything here.

## Flag-only findings are re-reported

A finding routed **flag only** — every finding on the two surfaces above, and every mapping row marked so — is re-reported *with its finding*, never reduced to its ledger line, until the owner named with it records the repair. Where a sweep tag carries the finding, re-reporting reaches exactly as far as that tag does, and no further: **every** sweep on a fetched `block`, **every** sweep on a carried `warn`/`block`, but **once** for a `warn` that a later clean fetch re-tags `info` (`./reconciliation-sweep.md` § *Tags*), past which no observation carries it. A finding carrying no tag at all — what a doc task's excluded deliverable produces (§ *Authored surfaces are never written*) — has nothing that could retire it, so it is re-reported on **every** run that can still see it until that repair is recorded: divergence between the deliverable and the docs is re-read off disk each run, and a finding noted in a `## Reconciliation` entry is re-read from there. A finding only the session established — an answered question, a constraint the session learned had changed — and that no entry carried (term 2 above writes none just for it) leaves nothing a later run can read, so it is reported in full on the run that found it, and the owner named with it holds the only record. **This section is the one home for the rule and fixes its one scope**; the direction files and `./reconciliation-sweep.md` cite it rather than restating either.

## The record

- **`result.md` exists (or is created by the missing-companion repair)** — record every applied edit in one `## Reconciliation — YYYY-MM-DD` section appended to it (suffix ` (2)` if one for today exists, keeping anchors unique). Prior sections, a prior `## Acceptance` included, are immutable: supersede via this entry plus the plan's status flip, never rewrite. Two surfaces sit outside the rule — `## Current state`, derived header metadata (contract in `./task-authorship.md`) rewritten in place, never appended; and `## Decision log`, an append-only index of dated pointer lines, appended, never rewritten.
- **No result file exists and none is owed** (the plan is still `to-do`, or was just reverted to it) — no result record for any edit made in this state; the printed change list is the record. Don't create a result file just to log reconciliation.
- **A judged edit's line carries its alternatives** (§ *Consent model: findings apply, the record carries them*) — the edit, then `— chose <reading> over <reading>: <what decided it>`. A grounding rewrite quotes the prior wording alongside the new (§ *Grounding docs change on evidence, never silently*); an edit to `ticket.md` or a group file adds the external-surface line its own rule requires (§ *The upstream ask is writable, and never rewritten quietly*).

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill>`; report printed this session from pre-reconcile state.
**Health:** <the boundary this run's advance required, recorded to the shape the resolved domain fixes (`../engineering/verification.md` § *What a boundary records* for code); omit when no advance required one>
**Commits:** <the scan's dated commit list, one line per commit, when a scan ran; `./reconciliation-commits.md` § *The record* fixes the line content and the cap>

- plan.md — Step 3 unchecked; shipped claim gone (`src/auth/handler.ts` no longer defines `validateToken`) — finding: Drift since plan [warn]. Prior record: `#step-3--add-token-validation`
- CONTEXT.md — References: spec-doc link marked broken (404) — finding: References [block]
- goals.md — G4 reworded from "export works" to "CSV export of a 10k-row table completes under 5s" — finding: Goal quality [weak] — chose the reviewer's threshold over dropping G4: `ticket.md` states the latency criterion, so the goal is under-specified rather than spurious
- ticket.md — Acceptance criteria: added the row-cap criterion the requester stated in the linked issue on 2026-09-02 — external surface: `ticket.md` § Acceptance criteria; was "any table exports", now "tables up to 50k rows export" — finding: ticket ↔ goals drift
- GROUP_CONTEXT.md — external surface: `billing/GROUP_CONTEXT.md` § Key constraints; was "all writes go through the ledger service", now adds "reads may bypass it" — finding: group context ↔ plan contradiction — chose the group file over Step 4's scope: the ledger ADR it cites was superseded

**Not reconciled:**

- Needs work — G2 regressed — re-run the acceptance gate via `/implement-task <slug>`
- Needs work — the new ticket criterion reaches acceptance the goals don't cover — re-derive via `/plan-task <slug>`

---
```

## Annotation formats

Two in-place annotations recur across skills; the formats below fix the wording and the line each anchors to, so reconcilers invent neither. Which files they may be written in is the direction's write surface.

- **Broken external link** — **auto**: append `— _broken as of YYYY-MM-DD (404)_` to the citing line (`CONTEXT.md`'s References or `## Open Questions`, a `plan.md` step or its `## Open Questions`, a citing line in `ticket.md`), or swap in the new URL when a redirect target is known. **An annotation already correct on that line is a no-op**, re-dated in place only when the observed failure itself changed (404 → moved, with a known target), never appended twice. The two never-annotated surfaces take the never-annotated rule (§ *Never-annotated surfaces*) instead, never this format; prior `result.md` sections, `goals.md`, and every group file carry no swept links at all (`./reconciliation-sweep.md` § *Scope*), so nothing there is annotatable.
- **Answered open question** — **auto** when the source answers it unambiguously (quote or tightly paraphrase it), **judged** when the answer needs interpretation, the reading declined recorded either way it was close: append `— _answered YYYY-MM-DD: <answer> ([source](url) when there is one)_` to the question line in `CONTEXT.md`'s or `plan.md`'s Open Questions. A question whose home is a group file is annotated there, on the added terms of § *The upstream ask is writable, and never rewritten quietly*. A goal marked `_(unresolved: …)_` is never annotated in `goals.md` — its resolution goes through each direction's goal row (*Goal quality findings* on the docs → reality side, *New, reworded, or retired goal decided in session* on the session → docs side), per § *Grounding docs change on evidence, never silently*.

**A carried-forward tag routes no new edit** in either direction: this sweep's fetch established nothing, so the last observation's `warn`/`block` simply stands (`./reconciliation-sweep.md` § *Tags*). The no-op above holds identically for an already-correct gone/moved note on a `**Pointers:**` entry — re-dated only when the observed failure itself changed, never written twice. **This section is the one home for both no-ops**; the direction files cite it rather than restating either. What a carried tag does still route is its *finding*, where that was flag only (§ *Flag-only findings are re-reported*).

## Cited reference changed

The sweep's `warn` (doc rewritten, ticket closed, PR merged) or `block` on a `**Pointers:**` entry — the artifact behind the pointer deleted or moved — beyond answering an open question, which takes § *Annotation formats* instead. **This section is the one home for the row**; each direction file cites it rather than restating it. **auto** for the world-truth surfaces only: refresh the affected `**Pointers:**` entry in § *Current state refresh* — for a `block`, a dated gone/moved note keeping the identifier — and note the observation in the `## Reconciliation` entry when other edits already warrant one, never appending one just for it. Then:

- never a status flip on its own: a merged PR is not the acceptance gate, and `blocked` clears when work resumes, and reconciliation doesn't resume work;
- a `block` on a `CONTEXT.md` or `plan.md` citing line takes the broken-link format of § *Annotation formats*, not this row; a `warn`/`block` on a never-annotated surface takes § *Never-annotated surfaces* rather than either;
- **route each citing occurrence by its own surface** (`./reconciliation-sweep.md` § *Fetching*): one URL named by both a `**Pointers:**` entry and the deliverable's `**Published:**` line produces both outcomes, never one in place of the other;
- a carried-forward tag and an already-correct gone/moved note route nothing new (§ *Annotation formats*); where that carried tag's finding was flag only, the finding itself is re-reported (§ *Flag-only findings are re-reported*).

A changed reference contradicting `CONTEXT.md` prose is **judged** in both directions, per § *Grounding docs change on evidence, never silently*: rule on which side the fetch supports, write the matching section, and record the reading declined.

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
- the two annotations fixed above — broken-link on a step's citing line or a line in `## Open Questions`, answered-question on a line in `## Open Questions` — under the auto/judged condition those formats set;
- step content within the finding's scope, applied as a **judged** edit in either direction: Verify criteria, gap details, the Scope partition, goal citations, and collapsing restated grounding to a citation of its home section (§ *One home per fact*). Within the finding's scope is the whole of the licence — a step rewritten past what its finding reached is redesign, which routes *Needs work* naming `plan-task`.

**Step numbers are stable across both directions.** No reconciler renumbers: existing numbers are the `#step-<n>--<slug>` anchors that `result.md`'s immutable prior sections carry and checked steps link to, so a renumber strands a record that can't be rewritten to match. Where a direction may insert a step, it inserts as `Step 3a` / `Step 3b` rather than shifting its siblings.

## Sequence and output

1. Print the skill's full report first — a faithful snapshot of **pre-reconcile** state, never regenerated after edits. Where the skill collects the sweep as one of its *own* findings (`reconcile-task`), run the sweep before composing that report, which renders the `## References` block inline and isn't complete without it.
2. Run the reference sweep (`./reconciliation-sweep.md`), **always before any edit**, and before composing the report in the case step 1 names. Its `## References` block prints where the run's report puts it: inline where the reconciler owns its own report, at the start of the reconcile phase where a composite's first phase owns it. Its tagged entries join the report's findings as evidence for the edits below, and its `observations.md` rewrite lands with the sweep — part of the check, not one of the edits.
3. Apply the obvious fixes, file-by-file: `result.md` first when a record is owed, then `plan.md`, then `CONTEXT.md`.
4. Apply the judged fixes, in the same file order and then the external surfaces last — `goals.md`, `ticket.md`, any group file — writing each one's record line as it lands, never in a batch afterwards.
5. Refresh `## Current state` (§ *Current state refresh*).
6. Close with the change list (or `Nothing to reconcile.` when nothing was actionable — writing nothing beyond the sweep's `observations.md` rewrite, not even an empty Reconciliation entry, and so advancing no watermark either (`./reconciliation-commits.md` § *The record*: the advance and the record are one act)):

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag])
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation, or prose rewrite> (finding: …)
- `goals.md` — <edit> (finding: …)
- `ticket.md` — <edit> (finding: …) — external surface
- `<path>/GROUP_CONTEXT.md` — <edit> (finding: …) — external surface

**Not reconciled:**

- <Needs work | Yours to apply> — <finding> — <skill, or the proposed text>
```
