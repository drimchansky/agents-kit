---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task directory under `.agents/tasks/` — produces a chat-only briefing without mutating files.
argument-hint: '[task directory path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core. This skill mostly observes; pull in deeper pack files only if you dig into a step's work. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill loads an existing task directory under `.agents/tasks/` and produces a chat-only briefing — used to resume work after time away, hand off, review what was done, or answer questions about a task — whether in progress, blocked, or already shipped. It reads the four task artifacts (`CONTEXT.md`, every `*.spec.md`, every `*.plan.md`, every `*.result.md`), reconstructs state from `- [ ]` / `- [x]` checkboxes, checks for drift between the plan's claims and current code/git, and prints a structured brief.

**CRITICAL**: This skill is **read-only across the repo** — task files (`CONTEXT.md`, `*.spec.md`, `*.plan.md`, `*.result.md`) and source code are observed but never modified (no write, edit, rename, delete). The skill also never mutates git state (no add, commit, checkout, stash). External systems cited in `CONTEXT.md`, specs, plans, or results (Jira, Notion, Slack, Google Docs, PRs, dashboards, etc.) are fetched **read-only** in Step 5 — never commented on, updated, or otherwise mutated. Reading the work product is **expected and required** — the drift check in Step 4 verifies the plan/result claims against current reality (for code, grepping shipped paths and opening cited files). Output is **chat only** — do not write a `BRIEF.md` artifact. Briefings stale within hours and a fifth file would contradict the four-file contract that `plan-task` and `implement-task` rely on. Domain-pack checklists in `./references/<domain>/` are not preloaded — this skill mostly observes; consult them only if you dig into a pending step's work during the drift spot-check.

## When to Use

**Use when:**

- Returning to a task after time away (yours or someone else's) and you need to know where it stands
- Handing off to a teammate or another session — the brief is the handoff document
- Reviewing what was done before commenting, asking questions, or deciding next steps
- The plan was written a while ago and you suspect the code has moved underneath it (drift check)
- Pre-execution triage: "is this safe to pick up, or has the world moved?"

**Skip when:**

- No task directory exists yet → suggest `refine-idea` or `plan-task`
- Ready to actually execute the next step → use `implement-task` directly (it reads the same artifacts as a prelude to writing code)
- The task is fresh with no result file yet → just read the plan; there is no state to reconstruct
- The user wants feasibility validation, not status → use `review-task`

## Process

### 1. Resolve the Task Directory and Plan(s)

Discovery resolves a task directory first, then the plan(s) inside it. Mirror `implement-task`'s rules:

**Resolve the task directory:**

- **If the user gave a task directory path or slug** (e.g. `.agents/tasks/add-csv-export/` or `add-csv-export`), resolve it against active task directories per `./references/workflow/task-layout.md`: standalone `.agents/tasks/<slug>/` first, then project task subdirectories `.agents/tasks/*/<slug>/`, excluding `archive/`. If exactly one matches, use it. If none match, look inside `archive/`. If multiple match, ask.
- **If the user gave a full plan path**, use it directly and derive the task directory from its parent.
- **If the user gave nothing**, list active task directories per `./references/workflow/task-layout.md` (standalone tasks plus project task subdirectories, excluding `archive/`) and ask which task.

**Descend to the plan(s)** — once the directory is resolved, list its `*.plan.md` files (filter out `*.spec.md` and `*.result.md`):

- Exactly one plan → use it.
- Multiple plans → brief them all together; surface order if filenames are numbered (`01-`, `02-`).
- No plans → tell the user the directory exists but has no plan; suggest `plan-task`.

Don't guess between ambiguous candidates — ask.

Task directories may be standalone or grouped under a project, and finished tasks may sit in an `archive/` subdirectory — exclude `archive/` when listing, descend into a project group's task subdirectories, and look inside `archive/` when resolving a finished task by slug. See `./references/workflow/task-layout.md`.

### 2. Load Artifacts

Read in full, not skim:

- `CONTEXT.md` in the resolved task directory — the shared static context (problem statement, scope summary, key assumptions, references).
- If `CONTEXT.md` carries a `**Project:**` header, the linked `PROJECT.md` too — the shared project-level context (charter, decision log, cross-task references) above `CONTEXT.md`. Read-only, like every artifact here; fold its open questions and references into the brief.
- Every `*.spec.md` in the directory — capture each spec's description and the full bullet list of acceptance criteria. Note any criterion marked `_(unresolved: ...)_`.
- Every `*.plan.md` in the directory — note each plan's `**Status:**` header and its `**Spec:**` link.
- Every `*.result.md` — note `**Status:**`, find the latest per-step or full-run section, capture every `**Blocked:**` block verbatim, and capture any `## Acceptance` section verbatim.

Status values across the lifecycle-bearing files are defined in `./references/workflow/task-lifecycle.md` — consult it if you encounter an unfamiliar value, and use the **pairing rule** there to flag inconsistencies (e.g. plan `executing` with no result file, plan `done` with result `executing`). A `skipped` plan is terminal and needs no result file — don't flag a missing result for it as drift; report it as deliberately abandoned. A `blocked` plan is paused — on an external dependency or an unresolved failure — and a `blocked` plan with a `blocked` result and a `**Blocked:**` section is consistent (report it as paused and name the cause from the section), not drift. The spec file has no status — it's a static input.

Flag in the brief:

- `CONTEXT.md` missing → task scaffolded outside the standard flow.
- A plan with no sibling `*.spec.md` of the same stem → `plan-task` was expected to produce one; without it the acceptance gate cannot run.

### 3. Reconstruct State from Checkboxes

For each plan:

- Count `- [x]` (done) vs `- [ ]` (pending) steps.
- Identify the next pending step. Pull its **What**, **Verify**, **Depends on**, any **Due** / **Lead time**, and the file paths it touches.
- For each `- [x]` step, follow the result anchor link to the matching section in the result file.
- If the plan contains `### Checkpoint after Step N` headers, note which checkpoints have a corresponding `## Checkpoint after Step N` entry in the result file with `**Outcome:** passed`.
- Surface every `**Blocked:**` section from the result file verbatim — do not paraphrase.

State is reconstructed from the markers, not inferred from prose. If the prose and checkboxes disagree, trust the checkboxes and note the disagreement.

### 4. Drift Check Against Current Reality

The drift check is the load-bearing value over `cat plan.md` — without it, the brief is just a re-rendering of files the user could read themselves. Compare what the plan and result files **claim was done** against the current state of the world the task acts on; don't reconstruct it from history — observe what's there now.

Partition the claims by state, because they're checked differently:

- **Done / shipped claims** — anything a `**Shipped:**` block or a `- [x]` step asserts already exists or already happened. Checkable against reality now; a claim that no longer holds is drift.
- **Pending claims** — anything a `- [ ]` (not yet done) step will produce. These may legitimately not exist yet; absence is **not** drift. A pending artifact that *already* exists is worth an `info` (the step may be partly done, or there's a collision).

For each done/shipped claim, confirm it still holds and tag the finding. When the domain is code, follow the drift-verification recipe in `./references/engineering/exploration.md` (partition paths shipped vs pending, existence-check, symbol-survival grep, open a shipped file to confirm the change is present and not reverted). For other domains, verify each claim against the domain's own artifacts (a booking still confirmed, a document still signed, a commitment still standing).

**Spec sanity check (domain-neutral).** If the result file has an `## Acceptance` section, spot-check one criterion tagged `met` against current behavior and confirm it still holds. If the result has no `## Acceptance` section but the plan is `done`, that itself is drift (the acceptance gate was skipped); flag it `block`. If a `met` criterion no longer holds, flag it `warn` so the user can re-run the gate before relying on the prior result.

Tag each finding `info` (FYI), `warn` (review before resuming), or `block` (plan needs update before execution can proceed).

**Always render the "Drift since plan" heading** — print `No drift detected.` when clean. Absence of drift is a verification statement, not silence.

### 5. Refresh External References

External systems cited in `CONTEXT.md`, specs, plans, or results (Jira tickets, Slack threads, Notion pages, Google Docs, PRs, dashboards) have their own state that drifts independent of code. A ticket may have closed since the plan was written, a thread may resolve an open question, a doc may have been rewritten. The brief should reflect current external state, not stale text from `CONTEXT.md`.

This is the external counterpart to Step 4 — Step 4 catches drift on disk; Step 5 catches drift in the systems `CONTEXT.md` points at.

1. **Extract reference URLs.** Walk `CONTEXT.md`, every `*.spec.md`, every `*.plan.md`, and every `*.result.md` and collect every URL from:
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

6. **Feed answered questions back to Step 6.** If a fetched reference materially answers an item in `CONTEXT.md`'s or a plan's "Open Questions" (or a spec criterion marked `_(unresolved: ...)_`), note it — the "Open questions" section in the brief should drop those items and surface the new answer instead.

**Always render the "References update" heading** — print `No external references cited.` when no URLs were found. Absence is a verification statement.

### 6. Produce the Brief

Assemble per the output template below. Print to chat. Do not write any file.

## Output Template

```markdown
# Resume: <task title>

**Task dir:** `.agents/tasks/<slug>/`
**Spec(s):** `<task-slug>.spec.md` [, additional specs …]
**Plan(s):** `<task-slug>.plan.md` (Status: <status>) [, additional plans …]
**Result(s):** `<task-slug>.result.md` (Status: <status>) — or "not yet started"

## Status

<one paragraph: N of M steps done across <K> plans; executing / blocked / ready to resume / done / skipped; whether the acceptance gate has run>

## Acceptance criteria

- Criterion 1 — <as written in spec> — _met / unmet / not yet checked / unresolved_
- Criterion 2 — <as written in spec> — _…_

(Pull the criterion text verbatim from the spec. Outcomes come from the result file's `## Acceptance` section if present; otherwise mark every criterion _not yet checked_. Surface any criterion trailing `_(unresolved: ...)_` from the spec as `unresolved`.)

## Done

- Step 1 — <title> ([result](./<task-slug>.result.md#step-1--<slug>))
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
- [warn] Criterion 2 — result claims `met` but the named flow no longer behaves as the criterion requires; re-run the acceptance gate before relying on the prior result

(or, when clean: `No drift detected.`)

## References update

- [info] [Jira CRM-123](https://example.atlassian.net/browse/CRM-123) — "Add CSV export" — Status: In Progress (unchanged since cited)
- [warn] [Notion: API contract](https://www.notion.so/...) — last edited 2026-05-23 by alice; the open question about pagination is now answered (cursor-based)
- [warn] [PR #482](https://github.com/org/repo/pull/482) — merged 2026-05-20; Step 3's blocker no longer applies
- [block] [Original spec doc](https://docs.google.com/document/d/...) — 404 (moved or deleted); CONTEXT.md cites a now-broken link
- [info] [Slack #project-x](https://acme.slack.com/archives/...) — auth required, re-check manually

(or, when no references cited: `No external references cited.`)

## Open questions

- <deduped from CONTEXT.md "Open Questions" + plan "Open Questions" + any spec criteria marked `_(unresolved: ...)_`; questions answered in the result file _or in fetched references (Step 5)_ are removed, and any new answers surfaced in their place>

## Where to start

<2–3 sentences naming the concrete first action — file to open, command to run (e.g. `/implement-task <slug>`), or a specific drift item to resolve before resuming>
```

If multiple plans live in the directory, render one **Acceptance criteria** / **Done** / **Up next** / **Blocked** block per plan with a clear sub-heading; the **Drift**, **References update**, **Open questions**, and **Where to start** sections remain shared.

## Don't Rationalize

- "I'll run the next step while I'm here" — This skill is read-only. Hand off to `implement-task` if the user wants execution.
- "The plan and result already explain everything; no need to read the code" — Result files describe what _was_ done, not what's in the code _now_. Code can be reverted, refactored, or removed after the fact. The drift check is the load-bearing value over `cat`.
- "The result file is recent, skip the drift check" — Recent ≠ unchanged. The implementation can shift after a step lands.
- "I'll write a `BRIEF.md` so the user has it later" — Briefings stale within hours; a fifth artifact contradicts the four-file contract. Print to chat only.
- "User said 'resume', so I'll just start coding" — In this skill, _resume_ means brief, then decide. The brief is the deliverable; the user picks the next move.
- "The Jira/Notion/PR link probably hasn't changed; skip the fetch" — External state drifts silently, and stale links are exactly what Step 5 is for. If a URL is cited and a tool can reach it, fetch it.
- "The fetch failed, I'll just omit that reference" — A failed fetch is a finding, not silence. Tag it `block` (broken) or `info` (auth required) and keep going. Omitting the reference hides drift.
- "I'll leave a comment on the Jira ticket to confirm status" — Step 5 is read-only. Never comment, update, transition, or otherwise write to an external system. Observe only.

## Verification

- [ ] Task directory resolved (asked the user when ambiguous, never guessed)
- [ ] `CONTEXT.md`, every `*.spec.md`, every `*.plan.md`, and every `*.result.md` in the directory read in full
- [ ] When `CONTEXT.md` has a `**Project:**` header, the linked `PROJECT.md` read too; a `skipped` plan reported as abandoned, not flagged for a missing result
- [ ] No file in the task directory was written, edited, renamed, or deleted
- [ ] No git state was mutated (no add, commit, checkout, stash)
- [ ] Step state reconstructed from checkbox markers, not inferred from prose
- [ ] Acceptance Criteria section in the brief lists every spec criterion verbatim, with outcome from the result file's `## Acceptance` section (or `not yet checked` / `unresolved` when applicable)
- [ ] Plan with no sibling `*.spec.md` flagged
- [ ] All `**Blocked:**` sections in the result file surfaced verbatim
- [ ] Drift check compared plan/result claims against the current implementation on disk; findings listed (or `No drift detected.` stated explicitly)
- [ ] Plan-referenced paths partitioned into shipped vs. pending before existence-check; missing **shipped** paths flagged as `block`/`warn`, missing **pending** paths not flagged
- [ ] At least one `**Shipped:**` file from the latest result entry spot-checked against current source
- [ ] Spec sanity check ran: a `met` criterion spot-checked against live behavior; missing `## Acceptance` section on a `done` plan flagged `block`
- [ ] Every URL in `CONTEXT.md` / spec / plan / result extracted, deduped, and fetched read-only with the appropriate tool (or `No external references cited.` stated explicitly)
- [ ] No external system was written to (no Jira comment, no Slack message, no Drive edit, no PR comment)
- [ ] Material changes since citation flagged `warn`; broken links flagged `block`; auth-walled links flagged `info` with `auth required — re-check manually`; failures captured, not omitted
- [ ] Open questions resolved by a fetched reference removed from "Open questions" and the new answer surfaced in "References update"
- [ ] Brief uses the documented template sections in order
- [ ] "Where to start" names a concrete first action (file + command), not a generic suggestion
- [ ] Open questions deduplicated across `CONTEXT.md`, plan, and any unresolved spec criteria; already-answered ones removed
- [ ] No `BRIEF.md` (or any other file) was created
