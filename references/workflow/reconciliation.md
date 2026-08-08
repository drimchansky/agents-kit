# Reconciliation: Shared Contract

Some skills write a task folder's docs back into agreement with reality after the fact. There are two reconciliation **directions**, and this file is the **single source of truth for the mechanics they share** — consent model, reference sweep, record and annotation formats, `plan.md` openings, run sequence. Each direction's write surface, edit rules, and finding-type → edit mappings live in its own file; the skills cite these files rather than restating them.

- **Docs → reality** (`./reconciliation-docs-to-reality.md`) — the composites `resume-task-reconcile` and `review-task-reconcile`, which report on a task folder, then write that report's findings back so the docs stop *overstating* what's built. The base skills they run, `resume-task` and `review-task`, are strictly read-only *and* sweep no citations of their own: they may read what a *claim* points at, never the folder's reference list, so every link cited from an actionable surface reaches the docs through a reconciler.
- **Session → docs** (`./reconciliation-session-to-docs.md`) — `reconcile-task`, which reviews the current session against the docs and writes back what surfaced in conversation but never reached the folder: the *enriching* direction. It has no flag — reconciling is its whole purpose, so it always writes.

## Consent model: obvious fixes only, ask for the rest

A reconciler applies **obvious** fixes without mid-run confirmation. A fix is obvious when the finding dictates exactly one edit: mechanical, evidence-backed, needing no interpretation of intent, no choice among alternatives, and no wording beyond the documented annotation formats. (Invoking the composite is that consent in docs → reality; invoking `reconcile-task` is it in the session direction.)

Everything else needs the engineer:

1. Batch every judgment item into **one round of questions** after the report is printed — the host agent's structured question tool when available, otherwise chat. Reference the finding each question comes from and offer concrete options, not an open-ended "what should I do?".
2. Apply only what the engineer actually answered: exactly the answer given, no redesign around it.
3. Unanswered or declined items go to the "Not reconciled" list with the reason (`awaiting engineer answer`, or `needs real work via <skill>`).

## Docs, not the world

Reconciliation fixes the **docs, not the world**: no code changes, no git mutation, no writes to external systems. Every edit maps to a finding printed in the report, or to an engineer's answer about one; drop anything else. (The session direction may *run* verification to back a state change, but running a check is read-only — no code changes, nothing outside the task docs mutates.)

## One home per fact

Every task-folder fact has one home file, and reconciliation respects it (`./task-layout.md` § *One home per fact*): an edit records a finding **once**, in its home — grounding in `CONTEXT.md`, acceptance in `goals.md`, execution content in `plan.md`, history in `result.md`, an answer where its question lives. The upstream *ask* lives in `ticket.md`, **read-only** here: a changed ask is surfaced for the user, never written. A sibling needing the fact gets a `./` citation, never a copy. (The `## Reconciliation` record is not a mirror — it logs the *edit*, not a second copy of the fact.)

## Skipped plans are exempt

A `skipped` plan is exempt from reconciliation entirely — it's terminal; report it as abandoned, run no reference sweep, and write nothing, even if drift or missing information exists.

## External reference check

The **reference sweep** re-derives the freshness of the external systems a task folder cites. Every reconciler runs it while assembling its finding set, and it is the **only** re-deriver of cited-reference freshness (`./task-layout.md` § *One home per fact*, external-system facts) — distinct from `stage-doc`'s refresh of the scratch-page ledger it owns in `**Pointers:**`.

**Ledger.** `observations.md` is the sweep's record (`./task-layout.md` § *The observations file*). Read it **before the sweep**: its lines are both the diff baseline and what a failed fetch carries forward. Rewrite it **wholesale** at the end, one dated line per swept URL, `info` included. The rewrite is part of the check, not an evidenced edit, and is the one write an otherwise-empty run still makes. A folder citing nothing from an actionable surface gets no file; a stale one from a broader earlier sweep is deleted.

**In scope** — every external URL cited from an **actionable surface**:

- `CONTEXT.md`'s `## References` and `## Open Questions`;
- `plan.md` steps and its `## Open Questions`;
- `ticket.md`'s References;
- the result's `## Current state` `**Pointers:**` entries, first-class citations: a PR or ticket pointer is fetched like any URL, a bare branch/SHA pointer checked against the repo instead;
- the result's **active pause section** — the `**Blocked:**` / `**In review:**` section a current status pairs with: only when `**Status:**` is `blocked` or `in-review`, and then only the most recent one;
- a doc-task deliverable's `**Published:**` URL, the deliverable resolved per `./task-layout.md` § *Doc-task files* (fixed without the plan's optional `**Deliverable:**` header).

**Out of scope**, however much they cite: `observations.md`, the sweep's own record; `result.md` below `## Current state` bar the active pause section (prior log sections and the append-only `## Decision log` alike); the `## Current state` gloss and `**Next:**` line; `goals.md`; `CONTEXT.md` prose; `plan.md` outside its steps and `## Open Questions`. No annotation row targets them — nothing there is repairable.

**Never annotated.** Three swept surfaces are never written into: `ticket.md`, a deliverable's `**Published:**` line, and the active pause section. All three stay in scope as **live citation surfaces the folder maintains, with a named owner for a `warn` or `block`** — the inclusion test every out-of-scope surface fails. **The never-annotated rule** the direction mappings cite rather than restate: a `warn` or `block` cited from one of the three is **flag only** —

1. surfaced with its owner named: `ticket.md` → the user, whose ask it states; `**Published:**` → `stage-doc`, which owns the authority claim, though absent a trigger for an externally changed page the repair is the user's call; the active pause section → `implement-task`, which clears a blocker by resuming work;
2. noted in the Reconciliation entry only when other edits already warrant one, never appended just for it;
3. never written into the file;
4. **re-reported until the owning surface records the repair** — the user editing `ticket.md` (citation corrected, or the ask restated when the fetch shows the ask itself moved), the `**Published:**` line re-dated (by the user, or by `stage-doc` once it has a trigger), or `implement-task` clearing the blocker and closing the section — **while a tag still carries it**: every sweep on a fetched `block`, every sweep on a carried `warn`/`block`, but **once** for a `warn` a later clean fetch re-tags `info`.

**Fetching.** Skip `mailto:`, `file://`, `localhost`, anchors-only, and relative links. **Deduplicate for fetching and for the ledger line by URL, retaining every citing surface**: compare the fetch against **every** occurrence's description, take the strongest tag for the one ledger line (`block` over `warn` over `info`), and route each occurrence's own finding by its own surface. Fetch **read-only** with the best capability the host agent offers, a structured integration over raw HTML scraping; read-only is absolute in both directions — nothing cited is ever commented on, updated, or posted to. Capture title, status, and last-updated, diffed against the URL's previous ledger line; on a first sweep, or a URL new to the file, fall back to the citing file's description.

**Enumeration, not the URL, separates this from a reporting skill's drift check**: the sweep enumerates *every* URL cited from an actionable surface and reports on each, where a drift check opens *one artifact a claim names* to test that claim. The same page reached both ways is no conflict, and the sweep never substitutes for claim-level verification.

**Tags.**

- `info` — fetched cleanly, no material change since the baseline. A fetch establishing **nothing** also tags `info`, but only absent a prior `warn`/`block` to carry forward: auth-walled, marked `auth required — re-check manually`; or failed without establishing anything about the target (timeout, 5xx, rate limit, connector error), marked `unreachable — <error>, re-check manually`. Don't pretend either was fetched. With a prior `warn`/`block` line, the carried line **keeps its tag**, the dated failed attempt appended.
- `warn` — material change: status flipped, new comments resolving an open question, doc substantively edited, PR merged or closed.
- `block` — broken (404, moved, deleted): the docs point at something gone. **A state tag, not a change tag** — deciding *existence* where `warn` and `info` decide *change* against the baseline — so a re-observed 404 re-tags `block` every sweep, never `info`, and its finding is **re-reported** every sweep while the *edit* it routes to fires once (the annotation formats are idempotent).

**Output and routing.** A failed fetch is a finding, never a halt: capture the error, tag it, continue. Print the results under a `## References` heading in the run's report, **rendered even when nothing was in scope** (`No external references in sweep scope.`) — the absence line is the verification statement, and speaks to the swept surfaces, not the folder. Auth-walled and unreachable URLs are surfaced there for manual re-check, never recorded as verified, each carrying its last observation forward with the failed attempt dated. What a tag writes *beyond* the ledger is the direction's business, its mappings routing `warn` and `block`; `info` is a **no-op in every direction** past its ledger line. A **flag-only finding whose repair hasn't landed** rides the non-`info` tags, re-reported with its finding while a fresh `block` or a carried `warn`/`block` still carries it; a `warn` that a later clean fetch re-tags `info` is where that stops.

## The record

- **`result.md` exists (or is created by the pairing repair)** — record every applied edit in one `## Reconciliation — YYYY-MM-DD` section appended to it (suffix ` (2)` if one for today exists, keeping anchors unique). Prior sections, a prior `## Acceptance` included, are immutable: supersede via this entry plus a status flip, never rewrite. Two surfaces sit outside the rule — `## Current state`, derived header metadata (contract in `./task-lifecycle.md`) rewritten in place, never appended; and `## Decision log`, an append-only index of dated pointer lines, appended, never rewritten.
- **No result file exists and none is owed** (the plan is still `to-do`, or was just reverted to it) — no result record for any edit made in this state; the printed change list is the record. Don't create a result file just to log reconciliation.

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill>`; report printed this session from pre-reconcile state.

- plan.md — Step 3 unchecked; shipped claim gone (`src/auth/handler.ts` no longer defines `validateToken`) — finding: Drift since plan [warn]. Prior record: `#step-3--add-token-validation`
- CONTEXT.md — References: spec-doc link marked broken (404) — finding: References [block]

**Not reconciled:**

- G2 regressed — needs real work: re-run the acceptance gate via `/implement-task <slug>`
- Step 5 Verify criterion vague — awaiting engineer answer

---
```

## Annotation formats

Two in-place annotations recur across skills; the formats below fix the wording and the line each anchors to, so reconcilers invent neither. Which files they may be written in is the direction's write surface.

- **Broken external link** — **auto**: append `— _broken as of YYYY-MM-DD (404)_` to the citing line (`CONTEXT.md`'s References or `## Open Questions`, a `plan.md` step or its `## Open Questions`), or swap in the new URL when a redirect target is known. **An annotation already correct on that line is a no-op**, re-dated in place only when the observed failure itself changed (404 → moved, with a known target), never appended twice. The three never-annotated surfaces take the never-annotated rule (§ *External reference check*) instead, never this format; prior `result.md` sections and `goals.md` carry no swept links at all (same section), so nothing there is annotatable.
- **Answered open question** — **auto** only when the source answers it unambiguously (quote or tightly paraphrase it): append `— _answered YYYY-MM-DD: <answer> ([source](url) when there is one)_` to the question line in `CONTEXT.md`'s or `plan.md`'s Open Questions. **Ask** when the answer needs interpretation. A goal marked `_(unresolved: …)_` is never annotated in `goals.md` — it is surfaced in chat (docs → reality), or handled through the new-goal confirmation row (session → docs).

## Current state refresh

Every reconciler that writes `result.md` closes by rewriting its `## Current state` block to post-edit reality — ≤1 KB, superseded detail dropped; history lives in the log. A legacy result without the block gains one here (per `./task-lifecycle.md`, created at the next write). By the result's state when the run began:

- **Live (`executing`/`blocked`/`in-review`) — full rewrite:** `_Updated: YYYY-MM-DD_`, a one-line gloss consistent with the (possibly just-changed) `**Status:**`, `**Pointers:**` refreshed to the identifiers in play, `**Next:**` naming the concrete next action. The block may never claim a stronger lifecycle state than `**Status:**`. In docs → reality it is re-derivation of a digest constrained by the (possibly weakened) Status, not a strengthen: weaken-only governs `**Status:**` and checkboxes, and the digest follows them.
- **Already `done` when the run began — partial freeze:** the narrative half, gloss and `**Next:**`, stays frozen as the final digest (`./task-lifecycle.md`: that half is expected on *live* results only), so a finding against a completed task is never recorded by re-glossing it.
- **Exempt from that freeze — `**Pointers:**`:** its entries digest world-truth whose home, `observations.md`, is rewritable by design (`./task-layout.md` § *One home per fact*), so a moved or merged reference updates the entry on a `done` result exactly as on a live one, `_Updated:_` re-dated to say when.
- **Outside the freeze — two runs rewrite in full:** one that itself *reaches* a terminal state writes the final digest first and freezes after, as `implement-task` closes both terminal branches; and one that first flips a `done` plan back to `executing` is refreshing a live result again.

## The `plan.md` write surface

Every reconciler writes `plan.md` through the same five shared openings; the session direction adds two of its own (see its write surface). Nothing else in `plan.md` is written in either direction. Which of the five a direction may use, and which way each may move, is the direction rule's business.

- step **checkboxes**, plus the trailing `([result](…))` link the box's new state requires — dropped when a box is cleared; added, pointing at the section recording the evidence, when one is checked (session direction only: docs → reality never checks a box, and a `- [x]` step always carries its link);
- the `**Status:**` header (`./reconciliation-docs-to-reality.md` § *Weaken, never strengthen*, `./reconciliation-session-to-docs.md` § *Strengthen only on verified evidence*);
- the `**Result:**` link-header — repointed at a skeleton `result.md`, or reverted to the pre-execution placeholder (docs → reality's shared repairs);
- the two annotations fixed above — broken-link on a step's citing line or a line in `## Open Questions`, answered-question on a line in `## Open Questions` — under the auto/ask condition those formats set;
- step content within the finding's scope, on the engineer's word only (an answer to the review's batched Questions under `review-task-reconcile`, a confirmed judgment item in the session direction): Verify criteria, gap details, the Scope partition, goal citations, and collapsing restated grounding to a citation of its home section (§ *One home per fact*).

**Step numbers are stable across both directions.** No reconciler renumbers: existing numbers are the `#step-<n>--<slug>` anchors that `result.md`'s immutable prior sections carry and checked steps link to, so a renumber strands a record that can't be rewritten to match. Where a direction may insert a step, it inserts as `Step 3a` / `Step 3b` rather than shifting its siblings.

## Sequence and output

1. Print the skill's full report first — a faithful snapshot of **pre-reconcile** state, never regenerated after edits. Where the skill collects the sweep as one of its *own* findings (`reconcile-task`), run the sweep before composing that report, which renders the `## References` block inline and isn't complete without it.
2. Run § *External reference check* — **always before any edit**, and before composing the report in the case step 1 names. Its `## References` block prints where the run's report puts it: inline where the reconciler owns its own report, at the start of the reconcile phase where a composite's first phase owns it. Its tagged entries join the report's findings as evidence for the edits below, and its `observations.md` rewrite lands with the sweep — part of the check, not one of the edits.
3. Auto-apply the obvious fixes, file-by-file: `result.md` first when a record is owed, then `plan.md`, then `CONTEXT.md`.
4. Ask the batched judgment questions; apply the answers.
5. Refresh `## Current state` (§ *Current state refresh*).
6. Close with the change list (or `Nothing to reconcile.` when nothing was actionable — writing nothing beyond the sweep's `observations.md` rewrite, not even an empty Reconciliation entry):

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag], or: engineer answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation> (finding: …)

**Not reconciled:**

- <finding> — <needs real work via <skill> / awaiting engineer answer>
```

## Compaction (size trigger)

At the end of a `reconcile-task` run, if `result.md` exceeds **20 KB**, add a judgment item to the batched round proposing compaction — never auto-apply it, and docs → reality never compacts. Compaction is the one sanctioned removal of prior log sections, safe only because the removed text stays recoverable:

- **Precondition:** the result file **resolves at `HEAD`** — `git -C <task-dir> cat-file -e HEAD:./<result-file>` succeeds — refuse otherwise, since compaction deletes text recoverable only via version history. Repo membership is not enough: an **ignored** task folder passes it while holding nothing in history. Being **tracked** is not enough either: a staged-but-never-committed file has no commit holding its text, and index membership is not history. Only a `HEAD`-resolvable version makes the tombstone's "full text in git history" line true. Note in the proposal if the file has uncommitted changes: the user should commit before consenting.
- **Collapse only superseded narrative** — sections a later `## Reconciliation` entry supersedes, verbose transcripts, step detail long overtaken by events. Always keep: the link header, `## Current state`, `## Decision log`, every `## Acceptance`, the latest `## Reconciliation`, and any active pause section.
- Each removed section becomes one line under a single `## Compacted — YYYY-MM-DD` stub naming the collapsed anchors, closing with "full text in git history (pre-compaction state)."
