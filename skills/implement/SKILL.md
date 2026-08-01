---
name: implement
description: Use when asked to implement, build, fix, or change something directly — described in the session or pointing at a file, issue, or diff — with no task folder or plan.
argument-hint: '[what to implement]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. After reading it, echo `✅ Core agents-kit rules applied` on its own line early in your first reply.
3. Load the domain pack: take the task's `**Domain:**` (default `engineering`; infer from the request when there's no `CONTEXT.md`) and apply `./references/<domain>/rules.md` on top of the core, plus the pack file each phase calls for. If the domain has no pack, run the neutral methodology and say so — see `./references/workflow/domain-packs.md`.

This skill carries out a change directly, with no task folder: you frame what's being built, run it through the shared execution loop, and report in chat. It is `implement-task`'s ad-hoc counterpart — the same loop, the same gates, the same Stop-the-Line discipline, read from the same file (`./references/workflow/execution-loop.md`).

**CRITICAL**: This skill writes no task-folder file and no status. The work itself is the only thing it changes on disk. Work that wants a durable record — a plan, a result file, an acceptance gate against written goals — belongs in `plan-task` → `implement-task`.

## References

Before working, read `./references/workflow/execution-loop.md` — the loop, its gates, and its failure discipline, with this skill's parameters in its `implement` binding. Then load the resolved domain's pack: `execution.md` (how to carry out the work) and `verification.md` (what its gates run), plus any per-surface checklists that apply. When the domain is code, that's `./references/engineering/`, and the checklists matter most here since this is a skill that produces the actual work product. See `./references/workflow/domain-packs.md`.

## When to Use

**Use when** the change is small enough that a plan would be overhead — the resolved domain's `planning.md` owns the test (for code, `./references/engineering/planning.md` § *When a code change warrants a plan*, its **Skip when** list).

**Skip when:**

- A task folder or plan already covers the work — use `implement-task`, which records progress against it
- The work spans multiple modules, has several viable approaches worth comparing, or has requirements ambiguous enough to need decomposition — suggest `plan-task` first
- The user wants the work assessed rather than done — that's `review-commit`, `review-pr`, or `audit`

Default to this skill when the change looks like one or two files with an approach that's already clear, because a plan would cost more than the work; escalate the moment framing or the work itself says otherwise.

## Process

### 1. Frame the Ask

Restate what's being built and what "done" means, as a short list — one line per item, each with the criterion that will prove it. This is what the loop's **Source** binding points at: with no `plan.md` and no `goals.md`, this framing *is* both contracts.

- **Name each item's verify criterion here, before implementing it.** A criterion written afterwards describes what you built rather than what was asked, which leaves the step gate nothing to gate on.
- Keep the frame to what the user asked for. Adjacent work you notice goes in the report under `**Noticed but not touching:**` (`./AGENTS.md`), not into the frame.
- If the request is ambiguous in a way that changes the work, ask before framing; if it's ambiguous in a way that doesn't, state the reading you're taking and proceed.
- Show the frame to the user before starting when the work is more than a single obvious change; otherwise state it and go.

**Escalate instead of framing** when the frame comes out spanning several modules, needing an approach comparison, or running past a handful of items — say so and suggest `plan-task`. Those are the conditions the domain's `planning.md` lists as warranting a plan, and discovering them here is exactly when to stop.

### 2. Ground Truth

Establish what you're acting on and where the authoritative information lives, per `./references/workflow/execution-loop.md` § *Ground truth before work* — the resolved domain's `execution.md` carries the recipe. This skill produces the actual work product, so stale or invented facts ship.

### 3. Run the Loop

Run the loop in `./references/workflow/execution-loop.md` — the five beats, both verify gates, Stop-the-Line when either fails, and the scope-change rules — with this skill's parameters as its `implement` binding states them. Both gates hold unchanged: step verify proves the item's §1 criterion, health verify proves nothing else regressed.

Take the items in whatever order their dependencies require. Pause between them when the user asked to inspect as you go; otherwise run through and report once at the end.

When Stop-the-Line can't be cleared this session — the failure won't resolve, or the work waits on someone or something external — report what failed, what was tried, and what's needed (or what's awaited), then stop; don't skip ahead to another item. There is no status to set: the chat report is this skill's only record.

### 4. Confirm the Ask Is Met

Before reporting, run the acceptance discipline in `./references/workflow/execution-loop.md` against the §1 frame: re-read each item as it was framed, verify it against live behavior rather than your memory of doing the work, and exercise the ask's end-to-end outcome whole.

An item that isn't met is Stop-the-Line, not a caveat in the report. Close it, or surface the gap and stop — don't ship a report that quietly reframes what was asked.

### 5. Report

Lists, never tables. Chat only — nothing written to disk beyond the work itself.

- **Shipped** — `file:line` (or the domain's equivalent) per change, with what changed
- **Verified** — how each framed item was proven: command output, test name, behavior observed
- **Sources** — official-doc URLs grounding any framework-specific work, plus any pattern shipped without an authoritative source and why; omit when none
- **Deviations** — anything that differs from the §1 frame, and why; omit when none
- **Follow-ups** — what's left or worth watching; omit when none

Close with `**Noticed but not touching:**` when applicable (`./AGENTS.md`), and point at the natural next step — `/review-commit` before committing, or `/plan-task` if the work outgrew this skill.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The ask was framed with each item's verify criterion stated **before** that item was implemented
- [ ] Every framed item: its criterion actually run and passed, health verify green — nothing reported done over a failing gate
- [ ] Acceptance ran against the §1 frame and live behavior, not against the report; no gap downgraded to a caveat
- [ ] No task-folder file and no status written; the work itself is the only on-disk change
- [ ] Domain pre-presentation checks re-run on the full changed surface (for code: typecheck, linter, tests, consumer grep; framework work grounded in cited sources, with any ungrounded pattern stopped or recorded)
