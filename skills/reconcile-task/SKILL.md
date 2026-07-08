---
name: reconcile-task
description: Use when asked to reconcile, sync, capture, or write back into a task folder the important information that emerged in the current session — decisions, constraints, references, answered questions, and verified progress — that never made it into `CONTEXT.md`, `goals.md`, `plan.md`, or `result.md`.
argument-hint: '[task folder path]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.
3. Load the domain pack: once `CONTEXT.md` is resolved, take its `**Domain:**` (default `engineering`) and apply `./references/<domain>/rules.md` on top of the core, plus `verification.md` — this skill re-verifies before it records any progress. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill closes the gap a working or design session opens: things get decided, discovered, answered, or actually built in the conversation, but the task folder still reflects the state from before the session. `reconcile-task` reviews **this session against the task docs** and writes the missing information back — the *enriching* direction of reconciliation. It is the counterpart to the `-r` reconcile mode of `resume-task` / `review-task`, which reconciles the other way (docs that overstate reality, weakened down to match). The shared contract for both directions lives in `./references/workflow/reconciliation.md`.

**CRITICAL**: This skill writes to the task docs by design — that is its purpose, so there is no opt-in flag; invoking it *is* the consent (see the shared contract's consent model). But it stays inside two guardrails and one boundary:

- **Strengthen only on verified evidence.** It may record progress (check a step, mark a goal `met`, advance status) **only after re-verifying it this session** the way the acceptance gate would (`./references/engineering/verification.md`). A claim it cannot verify is surfaced, never recorded. "Done" means verified, not asserted in chat.
- **Grounding docs change by confirmation.** Writing `goals.md`, `CONTEXT.md` prose, or a step's scope — anything that redefines scope or acceptance — goes through **one batched confirmation round** first; it is never auto-applied. Pure enrichment (references, answered questions, session narrative) auto-applies.
- **Docs, not the world.** No source code is written, no git state is mutated (no add, commit, checkout, stash), and no external system is updated. Verification in this skill *runs* checks read-only to back a state change — it changes nothing outside the four task files. Output is those files plus a chat change list — no fifth artifact.

## When to Use

**Use when:**

- A session produced decisions, constraints, or a chosen direction the task docs don't yet reflect
- References, specs, or tickets surfaced in chat and should be captured in `CONTEXT.md`
- An open question was answered (or a new one raised) during the session
- Work was actually done and verified in-session outside a formal `implement-task` run, and the plan/result should record it
- You're wrapping up a session and want the folder to be a faithful handoff for the next one

**Skip when:**

- No task folder exists yet → suggest `refine-idea` or `plan-task`
- The docs already overstate reality (stale statuses, vanished shipped claims) → that's the other direction; use `resume-task -r` or `review-task -r`
- You want to execute the next planned step → use `implement-task`; it records its own work as it goes
- The session only discussed work that wasn't done — there's nothing verified to record; the skill will surface it, not check it
- The plan is `skipped` (terminal) → nothing is reconciled; report it as abandoned

## Process

### 1. Resolve the Task Folder

Resolve a task folder per the **resolve-current-or-ask** discovery rules in `./references/workflow/task-layout.md` — the same variant `implement-task` and `resume-task` use: a bare slug (resolved in the canonical root, falling back into `archive/` for a finished task), an explicit path used verbatim anywhere on disk, or a full `plan.md` path taken directly, or — when the user named nothing — the task already established **in this session** if there is one (e.g. from a preceding `refine-idea`, `plan-task`, `review-task`, or `implement-task`), otherwise list active folders and ask which task.

The in-session task is the common case: reconcile is usually run at the end of a session that was already about a specific task. If nothing is established and nothing is named, ask — never guess between candidates.

### 2. Load Artifacts

Read in full, not skim — the docs are the baseline you diff the session against:

- `CONTEXT.md` — the static grounding context (problem statement, recommended direction, key assumptions, MVP scope, not-doing, open questions, references). Note the exact wording of prose sections; you compare, you don't paraphrase.
- `goals.md` — capture the full `## Goals` list by `G<n>` ID, and the highest ID in use (a new goal takes the next free number).
- `plan.md` — its `**Status:**`, its steps and their `- [ ]` / `- [x]` markers, each step's **What** / **Verify** / **Goal** / **Depends on**, and the `## Scope` partition.
- `result.md` — its `**Status:**`, the latest per-step / full-run section, any `**Blocked:**` block, any `**In review:**` block, any `## Acceptance` section. If none exists, note it: work recorded this session may create it (per the pairing rule in `./references/workflow/task-lifecycle.md`).

A `skipped` plan is terminal — report it as abandoned and stop; write nothing. A plan with no sibling `goals.md` is a gap — surface it (`plan-task` is expected to produce one) rather than fabricating goals.

### 3. Review the Session Against the Docs

This is the load-bearing step. Walk the current session and collect everything material that the task docs don't already carry, then classify each item by where it belongs and how it may be written. Look for:

- **Decisions and direction** — a chosen approach, a rejected alternative, a scope change, a new constraint, a "we're not doing X" — that contradicts or extends `CONTEXT.md`'s prose.
- **New goals or refined goals** — an outcome the session committed to that `goals.md` doesn't list, or a goal the session sharpened.
- **References** — links, specs, tickets, docs mentioned in chat that aren't in `## References`.
- **Answered / new open questions** — a question in `CONTEXT.md` or the plan that the session resolved, or a new one it raised.
- **Verified progress** — a step or goal the session actually completed *and* whose result you can confirm now (Step 4), plus work merely discussed but not done (surface only).
- **Plan changes** — a step whose scope, verify criterion, or ordering the session changed.

Group findings by target file (`CONTEXT.md` / `goals.md` / `plan.md` / `result.md`). If the session adds nothing beyond what the docs already hold, there is nothing to reconcile — say so in Step 6 and write nothing.

### 4. Verify Before Recording State

Any finding that would **advance state** — check a step, mark a goal `met`, flip a status upward — passes through the acceptance gate first, per `./references/engineering/verification.md`. Re-verify the step's `**Verify:**` criterion or the goal's acceptance behavior *now*, in this session, the way `implement-task` would:

- Verifies cleanly → it's recordable: check the box / mark the goal `met`, and write the evidence (`**Shipped:**` paths, what was run, what was observed) into `result.md`.
- Cannot be verified this session (no evidence, or the check fails) → **surface it, do not record it.** It goes to "Not reconciled" naming `implement-task`. A chat claim of "that's done" is not evidence.

**The one sanctioned exception is a goal marked `(external)`.** Its verification lives outside the session by design, so its **best-available proxy** — the confirmation, receipt, or observed live state the user reports — *is* legitimate evidence (per `./references/workflow/acceptance-criteria.md`), not a bare chat claim. On that proxy you may record the goal as `met` and advance `in-review → done`. Absent the proxy, the goal stays `pending external` and the task stays `in-review`.

Starting work this session on a `to-do` plan is evidenced state (checked steps or shipped artifacts exist) and flips `to-do → executing` with a skeleton `result.md`; finalizing `executing → done` requires the full acceptance gate to pass against `goals.md`. When the only goals left unsatisfied are `(external)` ones still awaiting their proxy, the task finalizes to `in-review` instead of `done`, and reaches `done` on a later confirmation.

### 5. Reconcile the Docs

Apply the findings per the shared contract in `./references/workflow/reconciliation.md` — read it before editing. It defines the consent model (obvious fixes auto-applied; judgment items asked as one batched round, only answered items applied), the record format (the append-only `## Reconciliation` section), the `skipped`-plan exemption, and the sequence ending in the printed change list. This skill writes in the **session → docs** direction defined there: it may enrich all four files, strengthen state only on verified evidence, and touch grounding docs only by confirmation.

Two rules anchor the mapping:

- **Every edit maps to a finding from Step 3** (or an engineer answer about one). A change without a finding behind it is invented detail — drop it. No tidying, no drive-by rewrites.
- **Verified, or confirmed, or not written.** State advances only through Step 4's gate; grounding docs change only through the confirmation round. Nothing high-stakes is auto-applied.

Finding-type → edit mapping (**auto** = obvious, applied unprompted; **verify** = only after Step 4; **ask** = one batched confirmation round first):

- **New reference / spec / ticket surfaced in session**, absent from `## References` → **auto**: append it to `CONTEXT.md`'s `## References` (label + URL, plus a short note of what it is).
- **Open question answered in session** (unambiguously) → **auto**: append `— _answered YYYY-MM-DD: <answer> ([source](url) if any)_` to the question line in `CONTEXT.md`'s or the plan's `## Open Questions`. **Ask** if the answer needs interpretation. A goal marked `_(unresolved: …)_` is surfaced — `goals.md` changes only via the confirmation round below.
- **New open question raised in session** → **auto**: append it to `## Open Questions`.
- **Session narrative** — what was explored, tried, or decided that isn't itself a state change or a grounding rewrite → **auto**: append a `## Reconciliation — YYYY-MM-DD` section to `result.md` (creating the file and flipping `to-do → executing` when work is evidenced, per the pairing rule).
- **Step completed this session** → **verify**: re-check its `**Verify:**` criterion (Step 4). Passes → check `- [x]` in `plan.md` and record the evidence in `result.md`. Fails or unverifiable → surface, leave `- [ ]`.
- **Goal met this session** → **verify**: re-check the goal's acceptance behavior. Passes → record it `met` (in the `## Acceptance` section when finalizing, or noted in the Reconciliation entry otherwise). Advance `executing → done` only when the full gate passes against every goal; when unmet goals are all `(external)` ones still awaiting their proxy, finalize to `in-review` instead. Fails → surface, no flip.
- **`(external)` goal confirmed this session** (the user reports the deploy check, the client sign-off, the receipt) → **verify**: re-check it against that best-available proxy per Step 4. Passes → record the new `met` verdict (with the proxy) in the `## Reconciliation` entry, which supersedes the prior `## Acceptance` line (don't edit that line in place — the append-only rule holds); if it was the last one outstanding, advance `in-review → done` and add the closing `**Completed:**` line. Fails or no proxy → leave `pending external`, task stays `in-review`.
- **New goal, or a reworded goal, decided in session** → **ask**: confirm the exact wording, then write `goals.md` — a new goal takes the next free `G<n>`, existing IDs are never renumbered, retired IDs never reused, and the file keeps its no-`**Status:**` / no-`## Description` shape.
- **Changed direction / MVP scope / Not Doing / Key Assumptions** → **ask**: confirm the exact prose, then write the matching `CONTEXT.md` section. Leave the `**Status:**` origin marker untouched.
- **Changed step scope / new step / changed Verify criterion** → **ask**: confirm, then write `plan.md` within the confirmed finding's scope (update `## Scope`'s goal-ID partition to stay total).
- **Work discussed but not done** → flag only: it isn't verified, so it isn't recorded; "Not reconciled" names `implement-task`.

## Output Template

Print the findings report **first** — a faithful snapshot of what the session holds that the docs don't, from **pre-reconcile** state, never regenerated after edits:

```markdown
# Reconcile: <task title>

**Task dir:** `<resolved task folder path>`
**Plan:** `plan.md` (Status: <status>)
**Result:** `result.md` (Status: <status>) — or "not yet started"

## Session findings not yet in the docs

### CONTEXT.md
- [auto] Reference — <label> (<url>) mentioned in session; absent from References
- [ask] Direction — session chose <X> over <Y>; Recommended Direction still says <old>
- [auto] Open question "<q>" answered: <answer>

### goals.md
- [ask] New goal — "<outcome>" committed this session; not in goals.md (would be G<next>)

### plan.md
- [verify] Step 3 — completed this session; pending re-verification of its Verify criterion
- [ask] Step 5 — scope changed to <…> in session

### result.md
- [auto] Session narrative — <what was explored / decided / tried>

## Not reconciled
- <finding> — <needs real work via implement-task / unverifiable this session>

(or, when the session adds nothing beyond the docs: `Nothing to reconcile.`)
```

Then run Step 4 (verify) and Step 5 (auto-apply enrichments, then the batched confirmation round for the `[ask]` items), and close with the change list — reusing the format in `./references/workflow/reconciliation.md`:

```markdown
## Reconciliation applied

- `plan.md` — <edit> (finding: <item>, or: answer to Q<n>)
- `result.md` — <edit> (finding: …)
- `CONTEXT.md` — <edit> (finding: …)
- `goals.md` — <edit> (answer to Q<n>)

**Not reconciled:**

- <finding> — <needs real work via implement-task / awaiting answer / unverifiable this session>
```

(or, when nothing was actionable: `Nothing to reconcile.` — and no file was written)

## Don't Rationalize

- "The user said it's done, so I'll check the box" — A chat claim is not evidence. Re-verify it this session (Step 4) or surface it; only verified work is recorded.
- "This new goal is obviously right, I'll just add it" — Goals are the acceptance contract. Confirm the wording in the batched round before writing `goals.md`; never auto-add.
- "The direction clearly changed, I'll rewrite Recommended Direction" — Grounding prose changes only by confirmation. Ask, then write exactly what was confirmed.
- "I'll renumber the goals so they're tidy" — IDs are durable. A new goal takes the next free `G<n>`; never renumber, never reuse a retired ID.
- "I'll fix this unrelated thing while I'm in the file" — Every edit maps to a session finding. No finding, no edit.
- "I'll run the next step while I'm here" — This skill records work; it doesn't execute the plan. Hand off to `implement-task`.
- "I'll append a Reconciliation entry even though nothing changed" — A no-op entry is noise in an append-only file. Print `Nothing to reconcile.` and write nothing.
- "The session is long; I'll summarize what I remember" — Diff the session against the actual docs, don't summarize from memory. Capture what's genuinely missing, and quote/point to the source.
- "I'll write a SESSION.md so it's all captured" — No fifth artifact. The four task files plus the chat change list are the record.

## Verification

- [ ] Task folder resolved (used the in-session task, or asked when ambiguous — never guessed)
- [ ] `CONTEXT.md`, `goals.md`, `plan.md`, and `result.md` read in full before diffing the session against them
- [ ] A `skipped` plan reported as abandoned, with nothing written
- [ ] Findings report printed from pre-reconcile state before any edit; not regenerated after
- [ ] Every edit maps to a session finding (or a confirmed answer); no drive-by edits
- [ ] State advanced only after in-session verification per `./references/engineering/verification.md`; unverifiable progress surfaced under "Not reconciled", not recorded
- [ ] No checkbox flipped to `- [x]` and no status advanced without recorded evidence in `result.md`
- [ ] `goals.md` written only after confirmation; new goals took the next free `G<n>`; no ID renumbered or reused; no `**Status:**` / `## Description` added
- [ ] `CONTEXT.md` prose written only after confirmation; `**Status:**` origin marker untouched
- [ ] Enrichment (references, answered questions, session narrative) auto-applied to the right sections
- [ ] `## Scope` goal-ID partition kept total when a plan step or goal changed
- [ ] At most one `## Reconciliation — YYYY-MM-DD` section appended per run when `result.md` was touched; prior result sections (including `## Acceptance`) unedited
- [ ] No source code written, no git state mutated, no external system updated; verification ran read-only
- [ ] No fifth artifact created; "Reconciliation applied" change list printed (or `Nothing to reconcile.` — and no file written)
