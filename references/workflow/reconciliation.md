# Reconciliation: Shared Contract

Some skills write a task folder's docs back into agreement with reality after the fact. There are two reconciliation **directions**, and **this file is the single source of truth for both** — the consent model, the write surface, the edit rules, the record format, and the finding-type → edit mappings. The **Shared mechanics** below hold for every reconciler; the **Direction rules** that follow apply only to the direction named, and each direction closes with the mappings of the skills that write in it — the skills cite these rather than restating them. When a mapping changes, update it here first, then the skill whose report prints the corresponding finding.

- **Docs → reality.** A composite whose first phase reports on a task folder and whose second, after that report is printed, writes its findings back so the docs stop *overstating* what's been built. Two composites reconcile in this direction today: `resume-task-reconcile` (its brief's drift findings) and `review-task-reconcile` (its review findings, plus the engineer answers it folds into the plan) — each adding the *External reference check* below, which their reporting phase does not run. The base skills they run — `resume-task` and `review-task` — are strictly read-only *and* sweep no citations of their own: they may read what a *claim* points at, but never the folder's reference list, so every cited link reaches the docs through a reconciler.
- **Session → docs.** `reconcile-task` reviews the current session against the task docs and writes back the information that surfaced in conversation but never reached the folder — the *enriching* direction. It has no flag; reconciling is its whole purpose, so it always writes — still printing the report first and asking about judgment items.

## Shared mechanics (all reconcilers)

### Consent model: obvious fixes only, ask for the rest

A reconciler applies **obvious** fixes without mid-run confirmation. A fix is obvious when the finding dictates exactly one edit: mechanical, evidence-backed, requiring no interpretation of intent, no choice among alternatives, and no wording beyond the documented annotation formats. (Invoking the composite is the consent for this in the docs-→-reality direction; invoking `reconcile-task` is the consent for it in the session direction.)

Everything else needs the engineer:

- Batch every judgment item into **one round of questions** after the report is printed (use the host agent's structured question tool when available; otherwise ask in chat). Reference the finding each question comes from and offer concrete options — not an open-ended "what should I do?".
- Apply only what the engineer actually answered — fold in exactly the answer given; don't redesign around it.
- Unanswered or declined items go to the "Not reconciled" list with the reason (`awaiting engineer answer`, or `needs real work via <skill>`).

### Docs, not the world

Reconciliation fixes the **docs, not the world**: no code changes, no git mutation, no writes to external systems. Every edit maps to a finding printed in the report (or to an engineer's answer about one) — a change without a finding behind it is invented detail; drop it. (The session direction may *run* verification to back a state change — see below — but running a check is read-only; it still changes no code and mutates nothing outside the task docs.)

### One home per fact

Every task-folder fact has one home file, and reconciliation respects it (`./task-layout.md` § *One home per fact*): an edit records a finding **once**, in its home — grounding in `CONTEXT.md`, acceptance in `goals.md`, execution content in `plan.md`, history in `result.md`, an answer where its question lives. The upstream *ask* lives in `ticket.md`, which reconciliation treats as **read-only** — a changed ask is surfaced for the user, never written here. A sibling file that needs the fact gets a `./` citation, never a copy. Mirroring one finding into two files authors the next round of drift — the exact thing reconciliation exists to remove. (The `## Reconciliation` record is not a mirror: it logs the *edit*, not a second copy of the fact.)

### Skipped plans are exempt

A `skipped` plan is exempt from reconciliation entirely — it's terminal; report it as abandoned and write nothing, even if drift or missing information exists.

### External reference check

External systems cited in a task folder drift independently of the work — a ticket closes, a thread answers an open question, a doc gets rewritten. This check — the **reference sweep** — is how a reconciler re-derives their freshness. Every reconciler runs it as part of assembling its finding set, and it is the **only** place that re-derives the freshness of a task folder's *cited references* (`./task-layout.md` § *One home per fact*, external-system facts); a reconciler that skips it leaves the folder's world-truth unverified. (`stage-doc` separately refreshes the scratch-page ledger it owns in `**Pointers:**` — a different surface, not this sweep.) The reporting skills are read-only and deliberately don't sweep — a finding they can't write down evaporates, so the check lives where it can be acted on.

Collect every external URL cited across the task files — including `ticket.md`'s References when present — (skip `mailto:`, `file://`, `localhost`, anchors-only, and relative links), deduplicate, and fetch each one **read-only** with the best capability the host agent offers; prefer a structured integration over raw HTML scraping when one exists. Read-only is absolute in both directions: nothing cited is ever commented on, updated, or posted to. The result's `## Current state` `**Pointers:**` entries are first-class citations — a PR or ticket pointer is fetched like any cited URL; a bare branch/SHA pointer isn't fetchable and is checked against the repo instead. Capture just enough to compare against the citing file's description: current title, status, last-updated. **The test that separates this from a reporting skill's drift check is enumeration, not the URL**: the sweep enumerates *every* cited URL and reports on each; a drift check opens *one specific artifact a claim names* to see whether that claim still holds. The same page can be reached both ways — swept here as a citation, read there as a claim's evidence — and that is not a conflict. Tag each reference:

- `info` — fetched cleanly, no material change since cited. Auth-walled links are also `info`, marked `auth required — re-check manually` — don't pretend they were fetched. So is a fetch that failed without establishing anything about the target (timeout, 5xx, rate limit, connector error), marked `unreachable — <error>, re-check manually`: nothing was learned, which is not the same as nothing changed, so it is surfaced rather than read as either confirmation or breakage.
- `warn` — material change: status flipped, new comments resolving an open question, doc substantively edited, PR merged or closed.
- `block` — broken (404, moved, deleted) — the docs point at something that no longer exists.

A failed fetch is a finding, never a halt — capture the error, tag the entry, continue. Print the results under a `## References` heading in the run's report, **rendered even when nothing was cited** (`No external references cited.`) — the absence line is the verification statement. What each tag then writes is the direction's business; the mappings below route `warn` and `block`. An `info` reference is a **no-op in every direction** — nothing was learned that the docs don't already say, and an auth-walled or unreachable one is surfaced in the `## References` block for manual re-check, never recorded as verified.

### The record

- **When `result.md` exists (or is created by the pairing repair)** — record every applied edit in one `## Reconciliation — YYYY-MM-DD` section appended to it (suffix ` (2)` if one for today already exists, keeping anchors unique). Prior sections — including a prior `## Acceptance` — are immutable; supersede them via this entry plus a status flip, never rewrite. Two surfaces sit outside this rule: `## Current state` — derived header metadata (contract in `./task-lifecycle.md`), rewritten in place, never appended — and `## Decision log` — an append-only index of dated pointer lines, appended, never rewritten.
- **When no result file exists and none is owed** (the plan is still `to-do`, or was just reverted to it) — no result record for any edit made in this state; the printed change list is the record. Don't create a result file just to log reconciliation.

```markdown
## Reconciliation — YYYY-MM-DD

**Trigger:** `<skill>` (`resume-task-reconcile` / `review-task-reconcile` / `reconcile-task`); report printed this session from pre-reconcile state.

- plan.md — Step 3 unchecked; shipped claim gone (`src/auth/handler.ts` no longer defines `validateToken`) — finding: Drift since plan [warn]. Prior record: `#step-3--add-token-validation`
- plan.md + result.md — Status `done` → `executing`; `## Acceptance` missing on a done plan — finding: Drift since plan [block]. `**Completed:**` line removed.
- CONTEXT.md — References: spec-doc link marked broken (404) — finding: References [block]

**Not reconciled:**

- G2 regressed — needs real work: re-run the acceptance gate via `/implement-task <slug>`
- Step 5 Verify criterion vague — awaiting engineer answer

---
```

### Annotation formats

Two in-place annotations recur across skills; the formats below fix both the wording and the line each one anchors to, so reconcilers don't invent either. Which files they may be written in is governed by the direction's write surface.

- **Broken external link** — **auto**: append `— _broken as of YYYY-MM-DD (404)_` to the citing line (in `CONTEXT.md`'s References or a `plan.md` step), or swap in the new URL when a redirect target is known. Links inside prior `result.md` sections, in `goals.md`, and in the upstream `ticket.md` are never touched — note them in the Reconciliation entry (when one is being written) only, never in those files.
- **Answered open question** — **auto** only when the source answers it unambiguously (quote or tightly paraphrase it): append `— _answered YYYY-MM-DD: <answer> ([source](url) when there is one)_` to the question line in `CONTEXT.md`'s or `plan.md`'s Open Questions. **Ask** when the answer needs interpretation. A goal marked `_(unresolved: …)_` is never annotated in `goals.md` — it's surfaced in chat (docs → reality), or handled through the new-goal confirmation row (session → docs).

### Current state refresh

Every reconciler that writes `result.md` ends the run by rewriting its `## Current state` block to post-edit reality: `_Updated: YYYY-MM-DD_`, a one-line status gloss consistent with the (possibly just-changed) `**Status:**`, `**Pointers:**` refreshed to the identifiers currently in play, `**Next:**` naming the concrete next action — ≤1 KB, superseded detail dropped; history lives in the log, not here. The block may never claim a stronger lifecycle state than the `**Status:**` header. In the docs → reality direction this rewrite is re-derivation of a digest constrained by the (possibly weakened) Status — not a strengthen: the weaken-only rule governs `**Status:**` and checkboxes, and the digest merely follows them. A legacy result with no `## Current state` block gains one here (per `./task-lifecycle.md`, create it at the next write). A result **already `done` when the run began** is the exception — and a partial one. Its narrative half, the status gloss and `**Next:**`, stays frozen as the final digest (`./task-lifecycle.md` — that half is expected on *live* results only), so a finding against a completed task is never recorded by re-glossing it. `**Pointers:**` is exempt from the freeze: external-system state is world-truth whose home *is* this rewritable block (`./task-layout.md` § *One home per fact*), so a moved or merged reference refreshes there on a `done` result exactly as on a live one, with `_Updated:_` re-dated to say when. Two runs fall outside the exception entirely and rewrite in full: one that itself *reaches* a terminal state — it writes the final digest first and freezes after, the way `implement-task` closes both terminal branches — and one that first flips a `done` plan back to `executing`, refreshing a live result again.

### The `plan.md` write surface

Every reconciler writes `plan.md` through the same five shared openings; the session direction adds two more of its own (see its write surface). Nothing else in `plan.md` is written in either direction. Which of the five a direction may use, and which way each may move, is the direction rule's business.

- step **checkboxes**, plus the trailing `([result](…))` link the box's new state requires — dropped when a box is cleared (shared repairs below); added, pointing at the section that records the evidence, when one is checked (session direction only — docs → reality never checks a box, and a `- [x]` step always carries its link);
- the `**Status:**` header (*Weaken, never strengthen* below; *Strengthen only on verified evidence* in the session direction);
- the `**Result:**` link-header — repointed at a skeleton `result.md`, or reverted to the pre-execution placeholder (shared repairs below);
- the two annotations whose formats are fixed above — a broken-link annotation on a step's citing line, an answered-question annotation on a line in `## Open Questions` — under the auto/ask condition those formats set;
- step content within the finding's scope, on the engineer's word only — an answer to the review's batched Questions under `review-task-reconcile`, a confirmed judgment item in the session direction: Verify criteria, gap details, the Scope partition, goal citations, and collapsing restated grounding to a citation of its home section (per *One home per fact* above).

**Step numbers are stable across both directions.** No reconciler renumbers: existing step numbers are the `#step-<n>--<slug>` anchors that `result.md`'s immutable prior sections already carry and that checked steps link to, so a renumber strands a record that can't be rewritten to match. Where a direction may insert a step, it inserts as `Step 3a` / `Step 3b` rather than shifting its siblings.

### Sequence and output

1. Print the skill's full report first — a faithful snapshot of **pre-reconcile** state, never regenerated after edits. Where the skill collects the reference sweep as one of its *own* findings (`reconcile-task`), run the sweep before composing this report: the report renders the `## References` block inline, so it isn't complete without it.
2. Run the *External reference check* above — **always before any edit**, and before composing the report in the case step 1 names. Its `## References` block prints where the run's report puts it: inline, where the reconciler owns its own report; at the start of the reconcile phase, where a composite's first phase owns the report. Its tagged entries join the report's findings as evidence for the edits below.
3. Auto-apply the obvious fixes, file-by-file: `result.md` first when a record is owed, then `plan.md`, then `CONTEXT.md`.
4. Ask the batched judgment questions; apply the answers.
5. Refresh `## Current state` (see *Current state refresh* above); then, if any `**Status:**` changed, regenerate the store index — walk up from the task folder for `scripts/generate-index.mjs`, run `node <that-root>/scripts/generate-index.mjs`, skip silently when the script or `node` is absent (see `./task-layout.md` § *Store-level artifacts*).
6. Close with the change list (or `Nothing to reconcile.` when nothing was actionable — and write nothing, not even an empty Reconciliation entry):

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag], or: engineer answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation> (finding: …)

**Not reconciled:**

- <finding> — <needs real work via <skill> / awaiting engineer answer>
```

## Direction: docs → reality (`resume-task-reconcile`, `review-task-reconcile`)

Findings come from a printed report comparing the docs against reality on disk, so this direction only ever *weakens* claims the docs overstate.

### Write surface

Exactly three task files, and nothing else:

- `plan.md` — the five writes above, under this direction's constraints: it only ever clears a checkbox, never checks one, and the `**Status:**` header moves only downward (*Weaken, never strengthen* below).
- `result.md` — append-only, except the `## Current state` block, which is rewritten in place (*Current state refresh*); see the record format above.
- `CONTEXT.md` — minimal annotations inside `## References` and `## Open Questions` only, per the carve-out in `./task-lifecycle.md`. Never the `**Status:**` origin marker, never prose rewrites.

`diagram.md` is **never** edited in either direction: repainting is authoring, which is interpretive and so fails the obvious-fixes bar, and a picture has no weaker direction for *Weaken, never strengthen* to move in. Diagram drift is flagged, never repaired — see the shared repair below.

`goals.md` and the upstream `ticket.md` are **never** edited — they are the user's contract. When a goal needs rewriting, print the suggested text for the user to apply; when the *ask* itself has changed, surface it for the user to update the ticket. An engineer answer still goes to the user as text, not into the file. This direction never re-runs the acceptance gate and never executes plan work.

### Weaken, never strengthen

Reconciliation in this direction may uncheck `- [x]` → `- [ ]`, flip `done → executing` or `in-review → executing`, or revert `executing → to-do`. It never checks a box, never sets `done` or `skipped`, and introduces `blocked` or `in-review` only by copying an already-evidenced sibling value. This holds **even with an engineer's answer** — "yes, that step was done" is a claim for `implement-task`'s verify gates to back, not for reconciliation to record. Engineer answers refine plan *content*; they never advance *state*.

### Shared repairs (both composites)

Both composites apply these; only the evidence source differs (the resume brief's drift check, the review's cross-file consistency check, and — for the reference row below — either pipeline's reference sweep). **auto** = obvious, applied unprompted; **ask** = engineer input first.

- **Unbacked `- [x]` step** — the shipped claim vanished from reality (file gone, symbol removed, change reverted), or no matching result section backs the checkbox — **auto**: flip the step to `- [ ]` and drop its trailing `([result](…))` link — pending steps carry no link; the historic record stays in `result.md`, and the Reconciliation entry cites the dropped anchor so it stays traceable. Never rewrite the step's **What**/**Verify** prose; never renumber.
- **Status-pairing / lifecycle repairs** — **auto**, always downward to the weaker claim: plan `done` + result `executing` → plan to `executing`; plan `executing` + result `blocked` with a `**Blocked:**` section → plan to `blocked`, or + result `in-review` with an `**In review:**` section → plan to `in-review` (copying evidenced state). Plan `done` with no `## Acceptance` in the result → flip plan and result `done → executing` and remove the result's closing `**Completed:**` line (header metadata, not narrative; `implement-task` re-adds it on re-finalize) — never fabricate an Acceptance section; that requires running the gate. Plan `executing` with no `result.md`: checked steps or drift-verified shipped work exist → create a skeleton `result.md` (`implement-task`'s init header, `**Status:** executing`) holding the Reconciliation section, and point the plan's `**Result:**` line at it; zero evidence → flip the plan `executing → to-do` (reverting its `**Result:**` line to the pre-execution placeholder) and create nothing; **ask** when the evidence is ambiguous (e.g. partial artifacts that may or may not be this task's work). Plan `blocked` or `in-review` with no `result.md` → **flag only**: the pairing rule's `**Blocked:**` / `**In review:**` section names a cause or a pending goal that can't be invented. Plan `done` with no `result.md` → flip the plan `done → executing` (nothing records the gate having run), then apply the `executing`-with-no-result rule above. A status outside the vocabulary registered in `./task-lifecycle.md` → **ask** (the intended state can't be inferred). A repair that would need an invented cause or an upward flip → flag only.
- **Result records work the plan doesn't show** (result section exists, plan still `- [ ]`) — flag only: checking the box would strengthen a claim this direction cannot attest; name `implement-task` (or the user) to confirm and flip.
- **`diagram.md` no longer matches reality** — flag only, and never an edit: repainting is authoring, outside this direction's write surface entirely. Name the nodes or edges that no longer hold and name `implement-task`, whose gate re-check is the repair. A task with no diagram raises nothing.
- **Cited reference materially changed** (reference check, `warn` — doc rewritten, ticket closed, PR merged) beyond answering an open question — **auto** for the world-truth surfaces only: refresh the affected `**Pointers:**` entry in the *Current state refresh*, and note the observation in the Reconciliation entry when other edits already warrant one (never append an entry just for it). Never a status flip on its own — this direction weakens claims, and a merged PR is not the acceptance gate. A changed reference that contradicts `CONTEXT.md` prose is **flag only** here: that prose is never rewritten in this direction — name `plan-task`.

### `resume-task-reconcile` — brief findings

Findings come from the brief's sections (Drift since plan, Open questions) and from this phase's own *External reference check* above — the brief itself sweeps nothing. Broken links and reference-answered questions use the shared annotation formats above; unbacked steps and status pairings use the shared repairs. The rest:

- **A `met` goal no longer holds** — **auto**: no checkbox change by itself; flip plan and result `done → executing` (or `in-review → executing` when the regressed goal backs an in-review task); the Reconciliation entry names the regressed `G<n>` and supersedes the prior `## Acceptance`; "Not reconciled" names `implement-task`.
- **`[info]` findings** (pending artifact already exists, adjacent refactor, auth-walled link) — no edit; info stays info — checking a box or noting completion would strengthen a claim this direction cannot attest.
- **External blocker cleared** (PR merged, ticket closed) — the `blocked`-clearing case of the shared *Cited reference materially changed* repair above: **apply that row in full**, including its `**Pointers:**` refresh. Its no-status-flip rule holds here for its own reason: `blocked` clears when work resumes, and reconciliation doesn't resume work. "Not reconciled" names `implement-task`.
- **Missing `goals.md` / missing `CONTEXT.md`** — cannot be fabricated; stays flagged, next skill `plan-task`.

### `review-task-reconcile` — assessment findings

Findings come from the assessment's sections and from this phase's own *External reference check* above — `review-task` sweeps nothing either. The check's reference findings take the shared annotation formats here, exactly as they do on the resume side.

Most of this review's findings need the engineer — that is what the assessment's Questions section is for. Under this composite, the Questions are not left rhetorical: put them to the engineer as one batched round (the concrete options already attached) and write the answers into the plan — exactly the answer given, no redesign around it. Cross-file drift findings use the shared repairs above; the rest:

- **Scope partition not total** (a goal ID neither delivered nor deferred) — **ask**: deliver it, defer it, or drop the goal (dropping means the user edits `goals.md`); apply the chosen partition to the plan's `## Scope`.
- **Stale or orphan goal citations** (a step cites a goal ID absent from `goals.md`; a non-infra step cites nothing) — **ask**: point the citation at the right goal, mark the step `none (infra/refactor)`, or remove the step; apply the answer.
- **Vague or untestable Verify criterion** — **ask**, offering the concrete rewrite suggested in the assessment; apply the accepted wording to the step's `**Verify:**` line.
- **Gaps and needs-clarification steps** — **ask** the targeted question from the Questions section; fold the answer into the step's **What**/**Verify** (or the plan's Scope).
- **Goal quality findings** (`weak` / `vague-or-untestable` / `unresolved`) — never edited: `goals.md` is the user's contract. Print the suggested rewrite for the user to apply; an engineer answer here still goes to the user as text, not into the file.
- **CONTEXT ↔ goals / CONTEXT ↔ plan contradictions** — **ask** which side is right, but apply the resolution only where the write surface allows: the plan's Scope/steps, or an annotation in CONTEXT's `## Open Questions` recording the ruling. CONTEXT prose (MVP scope, "Not Doing", Recommended Direction) is never rewritten — if the ruling changes direction, that's re-planning; name `plan-task`.
- **Restated grounding** (the same decision, finding, or question maintained in both `CONTEXT.md` and `plan.md`) — **ask**: confirm the fact's home (per `./task-layout.md` § *One home per fact* — grounding's home is `CONTEXT.md`) and whether the copies still agree, then collapse the restated content on the **plan side** to a citation of the home section, preserving any plan-time deltas interleaved with it. Never auto-applied — separating restatement from delta and choosing the surviving copy is interpretive, and diverged copies are a contradiction to rule on first (the row above). The CONTEXT side is never rewritten in this direction; if the plan copy carries newer content that should become the grounding, that's a `reconcile-task` (session → docs) or `plan-task` job.
- **Infeasible or conflicts-with-existing steps** — flag only: fixing them is redesign, out of scope even here; name `plan-task`.

## Direction: session → docs (`reconcile-task`)

Findings come from reviewing the current session against the docs, so this direction *enriches* — it writes information the docs are missing. It may write all four core task files (the upstream `ticket.md` is read-only — a changed ask is surfaced, not written), under two guardrails that keep it from silently redefining what's built or what "done" means.

### Write surface

All four core task files (never the upstream `ticket.md`, which is read-only — a changed ask is surfaced for the user; and never `diagram.md`, for the reason given in the other direction's write surface above). `result.md` as above; `plan.md` — the five writes above, plus **two additions**: a **new step**, only through a confirmed judgment item (the docs → reality direction closes against this because redesign is out of scope there; here, enriching the plan is the point) and inserted without renumbering, per the step-stability rule above; and a **new open-question line** appended to `## Open Questions` (auto — pure enrichment, distinct from the answered-question *annotation* the five already cover). Plus — only through a **confirmed** judgment item — `CONTEXT.md` prose sections (not annotation-only) and `goals.md`. Pure enrichment auto-applies: a new external reference into `## References`, an answered open question annotated in `## Open Questions`, a new open question appended there, session narrative appended to `result.md`. Each enrichment lands in the fact's **home file only** (per *One home per fact* above): a session decision goes to `CONTEXT.md` *or* the affected plan step — whichever the homes rule names — and an answer is annotated where its question lives, never mirrored into both files.

### Strengthen only on verified evidence

This direction may **advance** state — check a `- [ ]` step `→ - [x]`, mark a goal `met`, flip `to-do → executing`, `executing → done` (or `executing → in-review` when the only unsatisfied goals are `(external)` ones still awaiting their proxy), or `in-review → done` — but only after **re-verifying** it in-session the way `implement-task`'s acceptance gate would (the resolved domain's `verification.md`; `../engineering/verification.md` when the domain is code), recording the evidence in `result.md`. A step or goal it cannot verify this session stays unrecorded and is surfaced instead. It never advances state on a bare conversational assertion — witnessed-and-verified, or not at all. The one sanctioned exception: for a goal marked `(external)`, whose verification lives outside the session by design, its best-available proxy — the confirmation, receipt, or observed live state the user reports — *is* witnessed-and-verified evidence (per `./acceptance-criteria.md`), so `in-review → done` may advance on that proxy.

### Grounding docs change by confirmation, never silently

Writing `goals.md`, `CONTEXT.md` prose (`Recommended Direction`, `MVP Scope`, `Not Doing`, `Key Assumptions`), or a step's scope — anything that redefines scope or acceptance — is a **judgment item**: it goes through the batched confirmation round, never an unprompted auto-apply. `goals.md` edits obey the durable-ID scheme in `./task-layout.md`: a new goal takes the next free `G<n>`, IDs are never renumbered and a retired ID is never reused, and the file keeps its no-`**Status:**` / no-`## Description` shape.

### `reconcile-task` — session findings

Findings come from diffing the session against the docs, plus the *External reference check* above. Legend: **auto** = obvious, applied unprompted; **verify** = only after re-verifying in-session per the strengthen rule above; **ask** = the batched confirmation round first.

- **New reference / spec / ticket surfaced in session**, absent from `## References` → **auto**: append it to `CONTEXT.md`'s `## References` (label + URL, plus a short note of what it is).
- **Open question answered in session** → the shared answered-question annotation format above (**auto** when unambiguous, **ask** when interpretation is needed). A goal marked `_(unresolved: …)_` changes only via the new-goal row below.
- **Cited link broken** (reference check, `block`) → **auto**: the shared broken-link annotation format above — or the new URL when a redirect target is known.
- **Cited reference answers an open question** (reference check, `warn`) → the shared answered-question annotation format above, citing the fetched source; **auto** when it answers unambiguously, **ask** when it needs interpretation. Same treatment whether the answer came from the session or from the fetch — the question's home file is what decides where it lands.
- **Cited reference materially changed** (reference check, `warn` — PR merged, ticket closed, doc rewritten) → **auto** for the world-truth surfaces only: refresh the affected `**Pointers:**` entry in the *Current state refresh* and note the observation in the `## Reconciliation` entry when other edits already warrant one. Never a status flip on its own — a merged PR is not the acceptance gate, and `blocked` clears when work resumes; "Not reconciled" names `implement-task`. A changed reference that contradicts `CONTEXT.md` prose is an **ask**, per the grounding-docs rule.
- **New open question raised in session** → **auto**: append it to `## Open Questions` in the file the question belongs to (per *One home per fact* above) — `CONTEXT.md` when it questions the grounding, `plan.md` when it questions the plan's own execution.
- **Session narrative** — what was explored, tried, or decided that isn't itself a state change or a grounding rewrite → **auto**: append a `## Reconciliation — YYYY-MM-DD` section to `result.md` (creating the file and flipping `to-do → executing` when work is evidenced, per the pairing rule).
- **Step completed this session** → **verify**: re-check its `**Verify:**` criterion. Passes → check `- [x]` in `plan.md` and record the evidence in `result.md`. Fails or unverifiable → surface, leave `- [ ]`.
- **Goal met this session** → **verify**: re-check the goal's acceptance behavior. Passes → record it `met` (in the `## Acceptance` section when finalizing, or noted in the Reconciliation entry otherwise). Advance `executing → done` only when the full gate passes against every goal; when unmet goals are all `(external)` ones still awaiting their proxy, finalize to `in-review` instead. Fails → surface, no flip.
- **`(external)` goal confirmed this session** (the user reports the deploy check, the client sign-off, the receipt) → **verify**: re-check it against that best-available proxy per `./acceptance-criteria.md`. Passes → record the new `met` verdict (with the proxy) in the `## Reconciliation` entry, which supersedes the prior `## Acceptance` line (don't edit that line in place — the append-only rule holds); if it was the last one outstanding, advance `in-review → done` and add the closing `**Completed:**` line. Fails or no proxy → leave `pending external`, task stays `in-review`.
- **New goal, or a reworded goal, decided in session** → **ask**: confirm the exact wording, then write `goals.md` per the durable-ID scheme above.
- **Changed direction / MVP scope / Not Doing / Key Assumptions** → **ask**: confirm the exact prose, then write the matching `CONTEXT.md` section. Leave the `**Status:**` origin marker untouched.
- **Changed step scope / new step / changed Verify criterion** → **ask**: confirm, then write `plan.md` within the confirmed finding's scope (update `## Scope`'s goal-ID partition to stay total).
- **Changed ask** → flag only: the session shows the product requirement itself differs from what `ticket.md` states. The ticket is user-owned; surface it for the user to update (then re-derive goals via `plan-task`). Reconciliation never rewrites the ask.
- **Structure changed this session in a way `diagram.md` doesn't show** → flag only: the diagram is outside this direction's write surface too, so name the stale nodes or edges and name `implement-task`, whose gate re-check repaints it. A task with no diagram raises nothing — and deciding one is now warranted is a `plan-task` call, not a reconciliation one.
- **Work discussed but not done** → flag only: it isn't verified, so it isn't recorded; "Not reconciled" names `implement-task`.

### Compaction (size trigger)

At the end of a `reconcile-task` run, if `result.md` exceeds **20 KB**, add a judgment item to the batched round proposing compaction — never auto-apply it, and the docs → reality direction never compacts. Compaction is the one sanctioned removal of prior log sections, and it is safe only because the removed text stays recoverable:

- **Precondition:** the task folder is inside a git repository (`git -C <task-dir> rev-parse --git-dir` succeeds) — refuse otherwise, since compaction deletes text recoverable only via version history. Note in the proposal if the folder has uncommitted changes: the user should commit before consenting.
- **Collapse only superseded narrative** — sections a later `## Reconciliation` entry supersedes, verbose transcripts, step detail long overtaken by events. Always keep: the link header, `## Current state`, `## Decision log`, every `## Acceptance`, the latest `## Reconciliation`, and any active `**Blocked:**` / `**In review:**` section.
- Each removed section becomes one line under a single `## Compacted — YYYY-MM-DD` stub naming the collapsed anchors, closing with "full text in git history (pre-compaction state)."
