---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task folder (canonically under `.agents/tasks/`) — produces a chat-only briefing; pass `-r` to also reconcile the task docs to the brief's findings.
argument-hint: '[task folder path] [-r (reconcile task docs to reality)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core. This skill mostly observes; pull in deeper pack files only if you dig into a step's work. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill loads an existing task folder (canonically under `.agents/tasks/`, though a task folder anywhere on disk works the same) and produces a chat-only briefing — used to resume work after time away, hand off, review what was done, or answer questions about a task — whether in progress, blocked, or already shipped. It reads the four task artifacts (`CONTEXT.md`, `goals.md`, `plan.md`, `result.md`), reconstructs state from `- [ ]` / `- [x]` checkboxes, checks for drift between the plan's claims and current code/git, and prints a structured brief. With `-r`, after printing the brief it also reconciles the task docs to the findings (Step 7).

**CRITICAL**: In default mode (no `-r`) this skill is **read-only across the repo** — task files (`CONTEXT.md`, `goals.md`, `plan.md`, `result.md`) and source code are observed but never modified (no write, edit, rename, delete). The skill also never mutates git state (no add, commit, checkout, stash). External systems cited in `CONTEXT.md`, goals, plans, or results (Jira, Notion, Slack, Google Docs, PRs, dashboards, etc.) are fetched **read-only** in Step 5 — never commented on, updated, or otherwise mutated. Reading the work product is **expected and required** — the drift check in Step 4 verifies the plan/result claims against current reality (for code, grepping shipped paths and opening cited files). Output is **chat only** — do not write a `BRIEF.md` artifact. Briefings stale within hours and a fifth file would contradict the four-file contract that `plan-task` and `implement-task` rely on. Domain-pack checklists in `./references/<domain>/` are not preloaded — this skill mostly observes; consult them only if you dig into a pending step's work during the drift spot-check.

With `-r`, the write surface expands to exactly three task files — `plan.md`, `result.md`, and minimal annotations in `CONTEXT.md`'s References / Open Questions sections — and nothing else. In **both** modes: `goals.md` is never edited, source code is never written, git state is never mutated, external systems are fetched read-only, and no `BRIEF.md` or fifth artifact is created. `-r` fixes the **docs**, not the world — it never re-runs the acceptance gate or executes plan work. Only obvious, evidence-dictated fixes are applied unprompted; anything needing engineer judgment is asked first — the shared contract lives in `./references/workflow/reconciliation.md`. The brief always prints from pre-reconcile state before any edit.

## Flags

- `-r` — Reconcile: after printing the brief, auto-apply its obvious findings to the task docs and ask the engineer about the rest, per the shared contract in `./references/workflow/reconciliation.md`. Off by default; without `-r` the skill is strictly read-only. Passing `-r` is consent for the obvious, evidence-dictated fixes only — anything needing judgment is asked as one batched round of questions, and only answered items are applied. Step 7 carries this skill's finding-type mapping.

## When to Use

**Use when:**

- Returning to a task after time away (yours or someone else's) and you need to know where it stands
- Handing off to a teammate or another session — the brief is the handoff document
- Reviewing what was done before commenting, asking questions, or deciding next steps
- The plan was written a while ago and you suspect the code has moved underneath it (drift check)
- Pre-execution triage: "is this safe to pick up, or has the world moved?"
- The brief's findings should also be written back into the task docs — pass `-r` (stale statuses corrected, vanished claims unchecked, dead links annotated)

**Skip when:**

- No task folder exists yet → suggest `refine-idea` or `plan-task`
- Ready to actually execute the next step → use `implement-task` directly (it reads the same artifacts as a prelude to writing code)
- The task is fresh with no result file yet → just read the plan; there is no state to reconstruct
- The user wants feasibility validation, not status → use `review-task`
- The gap needs real work — code changes, re-running the acceptance gate, clearing a blocker — `-r` fixes docs only; use `implement-task`

## Process

### 1. Resolve the Task Folder

Discovery resolves a task folder, then reads its `plan.md`. Resolve it per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` — the same variant `implement-task` uses: a bare slug (resolved in the canonical root, falling back into `archive/` for a finished task), an explicit path used verbatim anywhere on disk, or a full `plan.md` path taken directly, or — when the user named nothing — the task already established **in this session** if there is one (e.g. from a preceding `refine-idea`, `plan-task`, or `review-task`), otherwise list active folders and ask which task.

**Read the plan** — once the folder is resolved, read its `plan.md` (one plan per folder). If the folder has no `plan.md`, tell the user the folder exists but has no plan; suggest `plan-task`. Don't guess between ambiguous candidates — ask.

### 2. Load Artifacts

Read in full, not skim:

- `CONTEXT.md` in the resolved task folder — the static grounding context (problem statement, scope summary, key assumptions, references).
- `goals.md` — capture the full `## Goals` list by `G<n>` ID. Note any goal marked `_(unresolved: ...)_`.
- `plan.md` — note its `**Status:**` header and its `**Goals:**` link.
- `result.md` — note `**Status:**`, find the latest per-step or full-run section, capture every `**Blocked:**` block verbatim, and capture any `## Acceptance` section verbatim.

Status values across the lifecycle-bearing files are defined in `./references/workflow/task-lifecycle.md` — consult it if you encounter an unfamiliar value, and use the **pairing rule** there to flag inconsistencies (e.g. plan `executing` with no result file, plan `done` with result `executing`). A `skipped` plan is terminal and needs no result file — don't flag a missing result for it as drift; report it as deliberately abandoned. A `blocked` plan is paused — on an external dependency or an unresolved failure — and a `blocked` plan with a `blocked` result and a `**Blocked:**` section is consistent (report it as paused and name the cause from the section), not drift. The goals file has no status — it's a static input.

Flag in the brief:

- `CONTEXT.md` missing → task scaffolded outside the standard flow.
- A plan with no sibling `goals.md` → `plan-task` was expected to produce one; without it the acceptance gate cannot run.

### 3. Reconstruct State from Checkboxes

For the plan:

- Count `- [x]` (done) vs `- [ ]` (pending) steps.
- Identify the next pending step. Pull its **What**, **Verify**, **Depends on**, any **Due** / **Lead time**, and the file paths it touches.
- For each `- [x]` step, follow the result anchor link to the matching section in the result file. **Match the anchor to the result file's actual shape:** a step-by-step run has `## Step N — <title>` headings (anchor `#step-n--<slug>`), but a full-plan run records a single `## Full Run — <date>` section (anchor `#full-run--<date>`) — in that case every step's `Done` link targets that one combined anchor, not a per-step anchor that doesn't exist.
- If the plan contains `### Checkpoint after Step N` headers, note which checkpoints have a corresponding `## Checkpoint after Step N` entry in the result file with `**Outcome:** passed`.
- Surface every `**Blocked:**` section from the result file verbatim — do not paraphrase.

State is reconstructed from the markers, not inferred from prose. If the prose and checkboxes disagree, trust the checkboxes and note the disagreement.

### 4. Drift Check Against Current Reality

The drift check is the load-bearing value over `cat plan.md` — without it, the brief is just a re-rendering of files the user could read themselves. Compare what the plan and result files **claim was done** against the current state of the world the task acts on; don't reconstruct it from history — observe what's there now.

Partition the claims by state, because they're checked differently:

- **Done / shipped claims** — anything a `**Shipped:**` block or a `- [x]` step asserts already exists or already happened. Checkable against reality now; a claim that no longer holds is drift.
- **Pending claims** — anything a `- [ ]` (not yet done) step will produce. These may legitimately not exist yet; absence is **not** drift. A pending artifact that *already* exists is worth an `info` (the step may be partly done, or there's a collision).

For each done/shipped claim, confirm it still holds and tag the finding. When the domain is code, follow the drift-verification recipe in `./references/engineering/exploration.md` (partition paths shipped vs pending, existence-check, symbol-survival grep, open a shipped file to confirm the change is present and not reverted). For other domains, verify each claim against the domain's own artifacts (a booking still confirmed, a document still signed, a commitment still standing).

**Goal sanity check (domain-neutral).** If the result file has an `## Acceptance` section, re-check the goals tagged `met` against current behavior. On a `done` plan the acceptance gate is the contract, so don't sample — re-check **every** `met` goal; on a still-`executing` plan, spot-check the `met` ones you can reach. If the result has no `## Acceptance` section but the plan is `done`, that itself is drift (the acceptance gate was skipped); flag it `block`. If a `met` goal no longer holds, flag it `warn` so the user can re-run the gate before relying on the prior result.

Tag each finding `info` (FYI), `warn` (review before resuming), or `block` (plan needs update before execution can proceed).

**Always render the "Drift since plan" heading** — print `No drift detected.` when clean. Absence of drift is a verification statement, not silence.

### 5. Refresh External References

External systems cited in `CONTEXT.md`, goals, plans, or results (Jira tickets, Slack threads, Notion pages, Google Docs, PRs, dashboards) have their own state that drifts independent of code. A ticket may have closed since the plan was written, a thread may resolve an open question, a doc may have been rewritten. The brief should reflect current external state, not stale text from `CONTEXT.md`.

This is the external counterpart to Step 4 — Step 4 catches drift on disk; Step 5 catches drift in the systems `CONTEXT.md` points at.

1. **Extract reference URLs.** Walk `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md` and collect every URL from:
    - The `## References` section (or equivalently named section) in `CONTEXT.md`
    - Markdown link bodies (`[label](url)`) anywhere in the files
    - Plain `https://` strings in prose
      Deduplicate. Skip `mailto:`, `file://`, `localhost`, anchors-only (`#section`), and relative paths (`./…`, `../…`, or any link without a scheme).

2. **Pick a fetcher per URL by domain.** Prefer a structured integration over HTML scraping when one is available in the current agent environment. The selection is capability-based, not tool-name-based — use whatever the host agent exposes:
    - `docs.google.com`, `drive.google.com` → a Google Drive integration (metadata + content) if present
    - `mail.google.com` → a Gmail integration if present
    - `calendar.google.com` → a Google Calendar integration if present
    - `github.com` PRs / issues / commits → the `gh` CLI via Bash (`gh pr view <url> --json state,title,updatedAt,comments`, `gh issue view`) when available
    - `*.atlassian.net` (Jira), `*.notion.so`, `*.slack.com`, and everything else → a domain-specific integration if one is available, otherwise a generic HTTP fetcher
    - When no integration matches, fall back to whatever generic HTTP-fetch capability the agent offers
    - Slack threads and private Notion/Drive links are often auth-walled — see step 4 below

3. **Fetch minimally.** Don't pull full content unless needed. For each URL, capture:
    - Current title / subject
    - Status if applicable (open/closed/merged/done/in-progress/archived)
    - Last-updated timestamp if visible
    - Whether new comments, edits, or messages appear since the citation was added (compare against `git log -1 --format=%aI -- <citing-file>` if useful; otherwise just surface a count or a "since" date)

4. **Compare against the citing file's description.** For each reference, tag:
    - `info` — fetched cleanly, no material change since cited
    - `warn` — material change (status flipped, new comments resolving an open question, doc edited substantively, PR merged or closed)
    - `block` — broken (404, moved, deleted) — the plan/CONTEXT is pointing at something that no longer exists
    - When a Slack/Jira/Notion link is auth-walled and you can't read it, tag `info` with `auth required — re-check manually` rather than blocking. Don't pretend it was fetched.

5. **Failures are non-blocking.** A single unfetchable URL must not halt the brief. Capture the error verbatim, tag the entry, continue to the next URL.

6. **Feed answered questions back to Step 6.** If a fetched reference materially answers an item in `CONTEXT.md`'s or a plan's "Open Questions" (or a goal marked `_(unresolved: ...)_`), note it — the "Open questions" section in the brief should drop those items and surface the new answer instead.

**Always render the "References update" heading** — print `No external references cited.` when no URLs were found. Absence is a verification statement.

### 6. Produce the Brief

Assemble per the output template below. Print to chat. In default mode this is the last step — stop here; no file is written. With `-r`, print the brief first — it must be a faithful snapshot of **pre-reconcile** state, never regenerated after edits — then continue to Step 7.

### 7. Reconcile the Docs (only with `-r`)

Skip this step entirely without the flag. With `-r`, apply the brief's findings to the task docs per the shared contract in `./references/workflow/reconciliation.md` — read it before editing. It defines the consent model (obvious fixes auto-applied; judgment items asked as one batched round of engineer questions, with only answered items applied), the write surface (`plan.md`, `result.md`, `CONTEXT.md` annotations — never `goals.md`), the weaken-never-strengthen rule, the `skipped`-plan exemption, the append-only `## Reconciliation` record, and the sequence ending in the printed change list. Two rules restated because they anchor this skill's mapping:

- **Every edit maps to a finding printed in the brief** (or to an engineer's answer about one). A change without a finding behind it is invented detail — drop it. No tidying, no reformatting, no drive-by fixes.
- **Docs, not work.** Findings that need real work (code changes, re-running the acceptance gate, clearing a blocker) stay unfixed — list them under "Not reconciled" with the next skill named (`implement-task`, `plan-task`).

Finding-type → edit mapping (**auto** = obvious, applied unprompted; **ask** = engineer input first):

- **Shipped claim on a `- [x]` step vanished** (file gone, symbol removed, change reverted) — **auto**: flip the step to `- [ ]` in `plan.md` and drop its trailing `([result](…))` link — pending steps carry no link; the historic record stays in `result.md`, and the Reconciliation entry cites the dropped anchor so it stays traceable. Never rewrite the step's **What**/**Verify** prose; never renumber.
- **A `met` goal no longer holds** — **auto**: no checkbox change by itself; flip plan and result `done → executing` (the gate must re-run); the Reconciliation entry names the regressed `G<n>` and supersedes the prior `## Acceptance`; "Not reconciled" names `implement-task`.
- **Plan `done` with no `## Acceptance` in the result** — **auto**: flip plan and result `done → executing` and remove the result's closing `**Completed:**` line (header metadata, not narrative; `implement-task` re-adds it on re-finalize). Never fabricate an Acceptance section — that requires running the gate.
- **Status-pairing mismatch** — **auto**: reconcile downward to the weaker claim: plan `done` + result `executing` → plan to `executing`; plan `executing` + result `blocked` with a `**Blocked:**` section → plan to `blocked` (copying evidenced state). A repair that would need an invented cause or an upward flip → flag only.
- **Plan `executing` with no `result.md`** — **auto** when the evidence is clear either way: checked steps or drift-verified shipped work exist → create a skeleton `result.md` (`implement-task`'s init header, `**Status:** executing`) holding the Reconciliation section, and point the plan's `**Result:**` line at it; zero evidence → flip the plan `executing → to-do` (reverting its `**Result:**` line to the pre-execution placeholder) and create nothing. **Ask** when the evidence is ambiguous (e.g. partial artifacts that may or may not be this task's work).
- **`[info]` findings** (pending artifact already exists, adjacent refactor, auth-walled link) → no edit; info stays info — checking a box or noting completion would strengthen a claim `-r` cannot attest.
- **Broken external link** — **auto**: annotate in place: in `CONTEXT.md`'s References (or a `plan.md` step), append `— _broken as of YYYY-MM-DD (404)_` to the line, or swap in the new URL when a redirect target is known. Links inside prior `result.md` sections and in `goals.md` are never touched — note them in the Reconciliation entry (when one is being written) only, never in those files.
- **Fetched reference answers an open question** — **auto** only when the reference answers it unambiguously (quote or tightly paraphrase the source): append `— _answered YYYY-MM-DD: <answer> ([source](url))_` to the question line in `CONTEXT.md`'s or `plan.md`'s Open Questions. **Ask** when the answer needs interpretation. Goals marked `_(unresolved: …)_` are surfaced in chat only — `goals.md` stays untouched.
- **External blocker cleared** (PR merged, ticket closed) → no status flip — `blocked` clears when work resumes, and `-r` doesn't resume work. Record the observation in the Reconciliation entry when other edits already warrant one (never append an entry just for it); either way "Not reconciled" names `implement-task`.
- **Missing `goals.md` / missing `CONTEXT.md`** → cannot be fabricated; stays flagged, next skill `plan-task`.

## Output Template

```markdown
# Resume: <task title>

**Task dir:** `<resolved task folder path>`
**Goals:** `goals.md`
**Plan:** `plan.md` (Status: <status>)
**Result:** `result.md` (Status: <status>) — or "not yet started"

## Status

<one paragraph: N of M steps done; executing / blocked / ready to resume / done / skipped; whether the acceptance gate has run>

## Goals

- G1 — <as written in goals.md> — _met / met with caveats / unmet / out of scope / not yet checked / unresolved_
- G2 — <as written in goals.md> — _…_

(Pull each goal verbatim from `goals.md`, with its `G<n>` ID. Outcomes come from the result file's `## Acceptance` section — tagged by ID — if present; carry each tag through verbatim, including `met with caveats` (keep the caveat note) and `out of scope`. If there's no `## Acceptance` section, mark every goal _not yet checked_. Surface any goal trailing `_(unresolved: ...)_` as `unresolved`.)

## Done

- Step 1 — <title> ([result](./result.md#step-1--<slug>))
- Step 2 — <title> ([result](…))

## Up next

- Step <N> — <title>
    - **Verify:** <criterion from plan>
    - **Depends on:** <prior steps>
    - **Due / Lead time:** <from plan, if set — otherwise omit>
    - **Touches:** <files from plan>

## Blocked

- <verbatim **Blocked:** sections from result file, one per block — or "none">

## Drift since plan

- [warn] `src/auth/handler.ts` — function `validateToken` cited in Step 3 result is no longer in the file
- [block] `src/legacy/auth.ts` — Step 2 result claims it was modified, but the file no longer exists on disk
- [info] `src/api/users.ts` — Step 4 (pending) plans to create this file, but it already exists; check whether the step is partially done or the filename collides
- [info] `src/cache/ttl.ts` — Step 1's shipped change still present, but adjacent code has been refactored; review before resuming Step 5
- [warn] G2 — result claims `met` but the named flow no longer behaves as the goal requires; re-run the acceptance gate before relying on the prior result

(or, when clean: `No drift detected.`)

## References update

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export" — Status: In Progress (unchanged since cited)
- [warn] [Notion: API contract](https://www.notion.so/...) — last edited 2026-05-23 by alice; the open question about pagination is now answered (cursor-based)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged 2026-05-20; Step 3's blocker no longer applies
- [block] [Original spec doc](https://docs.google.com/document/d/...) — 404 (moved or deleted); CONTEXT.md cites a now-broken link
- [info] [Slack #project-x](https://acme.slack.com/archives/...) — auth required, re-check manually

(or, when no references cited: `No external references cited.`)

## Open questions

- <deduped from CONTEXT.md "Open Questions" + plan "Open Questions" + any goals marked `_(unresolved: ...)_`; questions answered in the result file _or in fetched references (Step 5)_ are removed, and any new answers surfaced in their place>

## Where to start

<2–3 sentences naming the concrete first action — file to open, command to run (e.g. `/implement-task <slug>`), or a specific drift item to resolve before resuming>
```

With `-r`, after the edits are applied (and the batched engineer questions answered), additionally print:

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <section> [tag], or: engineer answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <annotation> (finding: …)

**Not reconciled:**

- <finding> — <needs real work via <skill> / awaiting engineer answer>
```

(or, when nothing is actionable: `Nothing to reconcile.` — and no file was written)

## Don't Rationalize

- "I'll run the next step while I'm here" — Even with `-r`, this skill never executes plan work; `-r` edits task docs only. Hand off to `implement-task` if the user wants execution.
- "The plan and result already explain everything; no need to read the code" — Result files describe what _was_ done, not what's in the code _now_. Code can be reverted, refactored, or removed after the fact. The drift check is the load-bearing value over `cat`.
- "The result file is recent, skip the drift check" — Recent ≠ unchanged. The implementation can shift after a step lands.
- "I'll write a `BRIEF.md` so the user has it later" — Briefings stale within hours; a fifth artifact contradicts the four-file contract. Print to chat only.
- "User said 'resume', so I'll just start coding" — In this skill, _resume_ means brief, then decide. The brief is the deliverable; the user picks the next move.
- "The Jira/Notion/PR link probably hasn't changed; skip the fetch" — External state drifts silently, and stale links are exactly what Step 5 is for. If a URL is cited and a tool can reach it, fetch it.
- "The fetch failed, I'll just omit that reference" — A failed fetch is a finding, not silence. Tag it `block` (broken) or `info` (auth required) and keep going. Omitting the reference hides drift.
- "I'll leave a comment on the Jira ticket to confirm status" — Step 5 is read-only. Never comment, update, transition, or otherwise write to an external system. Observe only.
- "I'll also tidy this section while I'm in the file" — Every `-r` edit maps to a finding printed in the brief. No finding, no edit.
- "It's probably what they'd want — I'll pick an interpretation and fix it" — If a fix needs a choice, wording judgment, or intent, it isn't obvious. Ask the engineer; apply only what they answer.
- "The code clearly does this, I'll check the box" — `-r` weakens stale claims; it never marks work done. Only `implement-task` checks boxes or sets `done`.
- "The old `## Acceptance` is wrong, I'll rewrite it" — Prior result sections are immutable. Supersede via the Reconciliation entry and the status flip.
- "goals.md contradicts reality, I'll fix it while reconciling" — The goals file is the user's contract. Surface it; never edit it.
- "The blocker cleared, I'll flip `blocked` back to `executing`" — Blocked clears when work resumes, and `-r` doesn't resume work. Record the observation and name `implement-task`.
- "Nothing changed, but I'll append a Reconciliation entry for the record" — A no-op entry is noise in an append-only file. Print `Nothing to reconcile.` and write nothing.
- "The brief looks different after my edits, I'll re-print it" — The brief is the pre-reconcile snapshot; the change list is the post-state record. Don't regenerate.

## Verification

- [ ] Task folder resolved (asked the user when ambiguous, never guessed)
- [ ] `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md` read in full
- [ ] A `skipped` plan reported as abandoned, not flagged for a missing result
- [ ] (no `-r`) No file in the task folder was written, edited, renamed, or deleted
- [ ] No git state was mutated (no add, commit, checkout, stash)
- [ ] Step state reconstructed from checkbox markers, not inferred from prose
- [ ] Goals section in the brief lists every goal verbatim by `G<n>` ID, with outcome from the result file's `## Acceptance` section (or `not yet checked` / `unresolved` when applicable)
- [ ] Plan with no sibling `goals.md` flagged
- [ ] All `**Blocked:**` sections in the result file surfaced verbatim
- [ ] Drift check compared plan/result claims against the current implementation on disk; findings listed (or `No drift detected.` stated explicitly)
- [ ] Plan-referenced paths partitioned into shipped vs. pending before existence-check; missing **shipped** paths flagged as `block`/`warn`, missing **pending** paths not flagged
- [ ] At least one `**Shipped:**` file from the latest result entry spot-checked against current source
- [ ] Goal sanity check ran: every `met` goal re-checked against live behavior on a `done` plan (spot-checked on an `executing` plan); missing `## Acceptance` section on a `done` plan flagged `block`
- [ ] Every URL in `CONTEXT.md` / goals / plan / result extracted, deduped, and fetched read-only with the appropriate tool (or `No external references cited.` stated explicitly)
- [ ] No external system was written to (no Jira comment, no Slack message, no Drive edit, no PR comment)
- [ ] Material changes since citation flagged `warn`; broken links flagged `block`; auth-walled links flagged `info` with `auth required — re-check manually`; failures captured, not omitted
- [ ] Open questions resolved by a fetched reference removed from "Open questions" and the new answer surfaced in "References update"
- [ ] Brief uses the documented template sections in order
- [ ] "Where to start" names a concrete first action (file + command), not a generic suggestion
- [ ] Open questions deduplicated across `CONTEXT.md`, plan, and any unresolved goals; already-answered ones removed
- [ ] No `BRIEF.md` or any other fifth artifact was created; with `-r`, writes touched only `plan.md`, `result.md`, and `CONTEXT.md` annotations
- [ ] (`-r`) Brief printed from pre-reconcile state before any edit; not regenerated after
- [ ] (`-r`) Only obvious, evidence-dictated fixes auto-applied; judgment items asked in one batched round with concrete options; unanswered items listed under "Not reconciled"
- [ ] (`-r`) Every edit maps to a finding printed in the brief (or an engineer's answer about one); no unflagged edits
- [ ] (`-r`) `goals.md` untouched
- [ ] (`-r`) No checkbox flipped to `- [x]`; no status set to `done` or `skipped`; no step added, removed, or renumbered
- [ ] (`-r`) Exactly one `## Reconciliation — YYYY-MM-DD` section appended per run when `result.md` was touched (per the shared contract) — or nothing written when clean; no prior result section edited (including `## Acceptance`)
- [ ] (`-r`) `CONTEXT.md` edits limited to References / Open Questions annotations; `**Status:**` origin marker and existing prose untouched
- [ ] (`-r`) No code written, no git mutation, no external write, acceptance gate not re-run; real-work findings listed under "Not reconciled" with the next skill named
- [ ] (`-r`) A `skipped` plan left untouched
- [ ] (`-r`) "Reconciliation applied" change list printed after the edits
