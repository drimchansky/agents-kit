---
name: resume-task
description: Use when asked to resume, catch up on, brief, hand off, status of, or check progress on a task folder (canonically under `.agents/tasks/`) — produces a chat-only briefing; pass `-r` to also reconcile the task docs to the brief's findings.
argument-hint: '[task folder path] [-r (reconcile task docs to reality)]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core. This skill mostly observes; pull in deeper pack files only if you dig into a step's work. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill loads an existing task folder (canonically under `.agents/tasks/`, though a task folder anywhere on disk works the same) and produces a chat-only briefing — used to resume work after time away, hand off, review what was done, or answer questions about a task — whether in progress, blocked, or already shipped. It reads the four core task artifacts (`CONTEXT.md`, `goals.md`, `plan.md`, `result.md`) — plus the optional upstream `ticket.md` when present — reconstructs state from `- [ ]` / `- [x]` checkboxes, checks for drift between the plan's claims and current code/git, and prints a structured brief. With `-r`, after printing the brief it also reconciles the task docs to the findings (Step 7).

**CRITICAL**: In default mode (no `-r`) this skill is **read-only** — task files, source code, and git state are never modified, and external systems cited in the docs (Jira, Notion, Slack, Google Docs, PRs, dashboards, …) are fetched read-only, never commented on or updated. Reading the work product is expected and required — the drift check verifies the plan/result claims against current reality. Output is **chat only**: no `BRIEF.md` or scratch briefing file — briefings stale within hours, and the task folder's role files are what the other skills rely on.

With `-r`, the write surface expands to exactly three task files — `plan.md`, `result.md`, and minimal annotations in `CONTEXT.md`'s References / Open Questions sections — and nothing else. In **both** modes: `goals.md` and `ticket.md` are never edited (the ticket is user-owned; even `reconcile-task` treats it as read-only), source code is never written, git state is never mutated, external systems are fetched read-only, and no `BRIEF.md` or scratch briefing file is created. `-r` fixes the **docs**, not the world — it never re-runs the acceptance gate or executes plan work. Only obvious, evidence-dictated fixes are applied unprompted; anything needing engineer judgment is asked first — the shared contract lives in `./references/workflow/reconciliation.md`. The brief always prints from pre-reconcile state before any edit.

## Flags

- `-r` — Reconcile: after printing the brief, auto-apply its obvious findings to the task docs and ask the engineer about the rest, per the shared contract in `./references/workflow/reconciliation.md`. Off by default; without `-r` the skill is strictly read-only. Passing `-r` is consent for the obvious, evidence-dictated fixes only — anything needing judgment is asked as one batched round of questions, and only answered items are applied. This skill's finding-type → edit mapping lives in the contract's `resume-task -r` section.

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

Resolve a task folder per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` — cite it, don't restate it; a full `plan.md` path is taken directly.

**Read the plan** — once the folder is resolved, read its `plan.md` (one plan per folder). If the folder has no `plan.md`, tell the user the folder exists but has no plan; suggest `plan-task`. Don't guess between ambiguous candidates — ask.

### 2. Load Artifacts

Read all four core artifacts — plus `ticket.md` when present — don't answer from headers or the latest section alone:

- `ticket.md` (when present) — the product-facing ask and its acceptance criteria; the upstream origin `goals.md` derives from.
- `CONTEXT.md` in the resolved task folder — the static grounding context (problem statement, scope summary, key assumptions, references).
- `goals.md` — capture the full `## Goals` list by `G<n>` ID. Note any goal marked `_(unresolved: ...)_`.
- `plan.md` — note its `**Status:**` header and its `**Goals:**` link.
- `result.md` — read `## Current state` first for orientation (the digest of where things stand — but it's derived metadata, so every claim in it becomes a Step-4 doc claim to verify, never trusted ground truth); then note `**Status:**`, find the latest per-step or full-run section, capture every `**Blocked:**` and `**In review:**` block verbatim, and capture any `## Acceptance` section verbatim.

Status vocabulary and the **pairing rule** live in `./references/workflow/task-lifecycle.md` — flag mismatched pairs as drift. Deliberate pauses are not drift: a `skipped` plan is abandoned (a missing result file is expected), `blocked` + `**Blocked:**` is paused (name the cause), and `in-review` + `**In review:**` is parked awaiting the listed `(external)` goals. The goals file has no status.

Flag in the brief:

- `CONTEXT.md` missing → task scaffolded outside the standard flow.
- A plan with no sibling `goals.md` → `plan-task` was expected to produce one; without it the acceptance gate cannot run.

### 3. Reconstruct State from Checkboxes

For the plan:

- Count `- [x]` (done) vs `- [ ]` (pending) steps.
- Identify the next pending step. Pull its **What**, **Verify**, **Depends on**, any **Due** / **Lead time**, and the file paths it touches.
- For each `- [x]` step, follow the result anchor link to the matching section in the result file. **Match the anchor to the result file's actual shape:** a step-by-step run has `## Step N — <title>` headings (anchor `#step-n--<slug>`), but a full-plan run records a single `## Full Run — <date>` section (anchor `#full-run--<date>`) — in that case every step's `Done` link targets that one combined anchor, not a per-step anchor that doesn't exist.
- If the plan contains `### Checkpoint after Step N` headers, note which checkpoints have a corresponding `## Checkpoint after Step N` entry in the result file with `**Outcome:** passed`.
- Surface every `**Blocked:**` and `**In review:**` section from the result file verbatim — do not paraphrase.

State is reconstructed from the markers, not inferred from prose. If the prose and checkboxes disagree, trust the checkboxes and note the disagreement.

### 4. Drift Check Against Current Reality

The drift check is the load-bearing value over `cat plan.md` — without it, the brief is just a re-rendering of files the user could read themselves. Compare what the plan and result files **claim was done** against the current state of the world the task acts on; don't reconstruct it from history — observe what's there now.

Partition the claims by state, because they're checked differently:

- **Done / shipped claims** — anything a `**Shipped:**` block or a `- [x]` step asserts already exists or already happened. Checkable against reality now; a claim that no longer holds is drift.
- **Pending claims** — anything a `- [ ]` (not yet done) step will produce. These may legitimately not exist yet; absence is **not** drift. A pending artifact that *already* exists is worth an `info` (the step may be partly done, or there's a collision).
- **`## Current state` claims** — the digest's status gloss, `**Pointers:**` entries, and `**Next:**` line. The digest is derived, so it can rot without any checkbox moving: a gloss that no longer matches the markers, a `**Next:**` naming an action that already happened, or a pointer whose live state diverges from what the gloss implies (Step 5 fetches it) is drift — tag `warn`.

For each done/shipped claim, confirm it still holds and tag the finding. When the domain is code, follow the drift-verification recipe in `./references/engineering/exploration.md` (partition paths shipped vs pending, existence-check, symbol-survival grep, open a shipped file to confirm the change is present and not reverted). For other domains, verify each claim against the domain's own artifacts (a booking still confirmed, a document still signed, a commitment still standing).

**Goal sanity check (domain-neutral).** If the result file has an `## Acceptance` section, re-check the goals tagged `met` against current behavior. On a `done` plan the acceptance gate is the contract, so don't sample — re-check **every** `met` goal; on a still-`executing` plan, spot-check the `met` ones you can reach. If the result has no `## Acceptance` section but the plan is `done`, that itself is drift (the acceptance gate was skipped); flag it `block`. If a `met` goal no longer holds, flag it `warn` so the user can re-run the gate before relying on the prior result. A goal tagged `pending external` is neither drift nor `unmet` — it's an `(external)` goal awaiting verification outside the session; surface it as outstanding (with what's awaited) rather than re-checking it against in-session behavior.

Tag each finding `info` (FYI), `warn` (review before resuming), or `block` (plan needs update before execution can proceed).

**Always render the "Drift since plan" heading** — print `No drift detected.` when clean. Absence of drift is a verification statement, not silence.

### 5. Refresh External References

External systems cited in the task docs drift independently of the code — a ticket closes, a thread answers an open question, a doc gets rewritten. This is the external counterpart to Step 4: Step 4 catches drift on disk; this step catches drift in the systems the docs point at.

Collect every external URL cited across the task files — including `ticket.md`'s References when present — (skip `mailto:`, `file://`, `localhost`, anchors-only, and relative links), deduplicate, and fetch each one **read-only** with the best capability the host agent offers. The result's `## Current state` `**Pointers:**` entries are first-class citations — a PR or ticket pointer is fetched like any cited URL, and a live state diverging from the digest (a PR recorded as awaited that has merged or closed) is `warn`; a bare branch/SHA pointer isn't fetchable — it's checked against the repo in Step 4 instead. Prefer a structured integration over raw HTML scraping when one exists. Capture just enough to compare against the citing file's description: current title, status, last-updated. Tag each reference:

- `info` — fetched cleanly, no material change since cited. Auth-walled links are also `info`, marked `auth required — re-check manually` — don't pretend they were fetched.
- `warn` — material change: status flipped, new comments resolving an open question, doc substantively edited, PR merged or closed.
- `block` — broken (404, moved, deleted) — the docs point at something that no longer exists.

A failed fetch is a finding, never a halt — capture the error, tag the entry, continue. If a fetched reference materially answers an item in "Open Questions" (or a goal marked `_(unresolved: ...)_`), drop the question from the brief's Open-questions section and surface the answer instead.

**Always render the "References update" heading** — print `No external references cited.` when no URLs were found. Absence is a verification statement.

### 6. Produce the Brief

Assemble per the output template below. Print to chat. In default mode this is the last step — stop here; no file is written. With `-r`, print the brief first — it must be a faithful snapshot of **pre-reconcile** state, never regenerated after edits — then continue to Step 7.

### 7. Reconcile the Docs (only with `-r`)

Skip this step entirely without the flag. With `-r`, apply the brief's findings to the task docs per the shared contract in `./references/workflow/reconciliation.md` — read it before editing. It defines the shared mechanics (consent model, annotation formats, the append-only `## Reconciliation` record, the sequence ending in the printed change list), the docs → reality direction rules (write surface, weaken-never-strengthen), the shared `-r` repairs, and — in its `resume-task -r` section — this skill's finding-type → edit mapping. Findings that need real work (code changes, re-running the acceptance gate, clearing a blocker) stay unfixed — list them under "Not reconciled" with the next skill named (`implement-task`, `plan-task`).

## Output Template

```markdown
# Resume: <task title>

**Task dir:** `<resolved task folder path>`
**Goals:** `goals.md`
**Plan:** `plan.md` (Status: <status>)
**Result:** `result.md` (Status: <status>) — or "not yet started"

## Status

<one paragraph: N of M steps done; executing / blocked / in-review / ready to resume / done / skipped; whether the acceptance gate has run and whether any `(external)` goal is still pending. May quote the result's `## Current state` gloss — marked verified or stale per the Step-4 drift check, never repeated unchecked>

## Goals

- G1 — <as written in goals.md> — _met / met with caveats / unmet / out of scope / pending external / not yet checked / unresolved_
- G2 — <as written in goals.md> — _…_

(Pull each goal verbatim from `goals.md`, with its `G<n>` ID — keep any `(external)` marker. Outcomes come from the result file's `## Acceptance` section — tagged by ID — if present; carry each tag through verbatim, including `met with caveats` (keep the caveat note), `out of scope`, and `pending external` (keep what's awaited). If there's no `## Acceptance` section, mark every goal _not yet checked_. Surface any goal trailing `_(unresolved: ...)_` as `unresolved`.)

## Done

- Step 1 — <title> ([result](./result.md#step-1--<slug>))
- Step 2 — <title> ([result](…))

## Up next

- Step <N> — <title>
    - **Verify:** <criterion from plan>
    - **Depends on:** <prior steps>
    - **Due / Lead time:** <from plan, if set — otherwise omit>
    - **Touches:** <from plan, if set — otherwise omit>

## Blocked

- <verbatim **Blocked:** sections from result file, one per block>

## In review

- <verbatim **In review:** section from result file — the pending `(external)` goals and what each awaits>

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

Omit sections with nothing to report (a fresh task has no Done, Blocked, or In review) — **except** "Drift since plan" and "References update", which always render: their explicit absence line is the information.

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
- "The plan and result already explain everything; no need to read the code" — Result files describe what _was_ done, not what's in the code _now_. The drift check is the load-bearing value over `cat`.
- "The result file is recent, skip the drift check" — Recent ≠ unchanged. The implementation can shift after a step lands.
- "User said 'resume', so I'll just start coding" — In this skill, _resume_ means brief, then decide. The brief is the deliverable; the user picks the next move.
- "The Jira/Notion/PR link probably hasn't changed; skip the fetch" — External state drifts silently, and stale links are exactly what Step 5 is for. If a URL is cited and a tool can reach it, fetch it.
- "The fetch failed, I'll just omit that reference" — A failed fetch is a finding, not silence. Tag it and keep going. Omitting the reference hides drift.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Task folder resolved per `task-layout.md` (asked when ambiguous); all four core artifacts read (plus `ticket.md` when present); a missing `goals.md` flagged
- [ ] (no `-r`) Nothing written, edited, renamed, or deleted anywhere; in both modes: no git mutation, external systems fetched read-only, no `BRIEF.md` or scratch briefing file
- [ ] State reconstructed from checkbox markers, not prose; `**Blocked:**` / `**In review:**` sections surfaced verbatim; a `skipped` plan reported as abandoned, not drift
- [ ] Drift check compared done/shipped claims against current reality — paths partitioned shipped vs. pending, `## Current state` claims (gloss, Pointers, Next) included, every `met` goal re-checked on a `done` plan, a missing `## Acceptance` on a `done` plan flagged `block` — with "Drift since plan" rendered even when clean
- [ ] Every cited URL fetched read-only and tagged (`warn` on material change, `block` on broken, `info` on auth-walled); "References update" rendered even when none
- [ ] Brief printed to chat with the template sections and a concrete "Where to start" action
- [ ] (`-r`) Reconciliation followed the shared contract; brief printed from pre-reconcile state; every edit maps to a finding; closing change list printed with real-work findings under "Not reconciled"
