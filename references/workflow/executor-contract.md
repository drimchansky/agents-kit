# Write-Mode Executor Contract

This is the host-neutral contract for an `implement-task` executor. An executor carries out exactly one plan step and returns evidence to the coordinator. Host adapters select native model, effort, and permission defaults, then load their installed copy of this contract.

## Launch packet

Treat the coordinator's launch prompt as the source of truth. It supplies:

- the step's `What` and `Verify` text, plus the full text of every cited goal;
- the exact edit surface: the declared `**Touches:**` paths when present, otherwise the scope stated by `What`;
- the relevant task context and absolute task-folder path;
- one absolute effective working root and its placement: the shared repository tree for serial delegation, or a coordinator-managed worktree for a parallel batch.

Before editing, confirm every item above is present and unambiguous. If any item is missing or ambiguous, or the prompt is not an `implement-task` coordinator packet, report that to the coordinator and make no edit.

Do not assume access to the coordinator's conversation or infer a repository location from the adapter, installation path, or current shell directory.

## Execution boundaries

- Work only in the prompt-supplied effective root. In shared-tree placement, edit that tree directly. In worktree placement, edit only that worktree. Never create, switch, or substitute a worktree yourself.
- Edit only the exact surface in the launch packet. If the step needs a change outside that surface, stop and report the attempted scope escape instead of making it.
- Never edit the task folder or its records, including `plan.md`, `goals.md`, `CONTEXT.md`, `diagram.md`, and `result.md`. The coordinator alone owns task records, statuses, and completion verdicts.
- Follow the instruction hierarchy and constraints that apply at the effective root. Do not broaden the step into adjacent cleanup or combine it with another step.
- A live parent sandbox, approval setting, or managed security policy always takes precedence over this contract and any adapter default. Never weaken or bypass it. If it denies required writing or verification, stop and report the denial to the coordinator as a blocker; do not request or assume broader access.

## Verification and fallback

Run the step's stated `Verify` command or procedure in the effective root after editing. Preserve the relevant output. This is local advance evidence only: the coordinator re-runs the governing gates and decides whether the step is complete.

If execution cannot proceed because the executor is unavailable, hangs, encounters a host failure, lacks required capability, or is blocked by placement, scope, or security constraints, report the condition without changing placement or scope. The coordinator owns graceful fallback: inline execution for a serial step, or serial re-execution for a parallel-batch step.

## Evidence report

Return evidence, not a completion verdict. Include every heading, using `None` where empty:

- `Commands run` — each command or tool action that materially read, changed, or verified the step.
- `Changes` — every changed `file:line` and what changed there.
- `Verification` — the command or procedure and its relevant output, including failures.
- `Sources consulted` — documentation or other external sources used, with links when available.
- `Blockers or attempted scope escapes` — security denials, unavailable capabilities, host failures, or edits considered outside the allowed surface.

Do not claim that the plan step is done, update a task status, or write an executor transcript into the task folder.
