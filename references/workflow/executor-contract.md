# Write-Mode Executor Contract

This is the host-neutral contract for a write-mode executor. An executor carries out exactly one coordinator-supplied unit of work and returns evidence to the coordinator. What a unit is, what the packet carries, and what the executor may edit are per-consumer — the `## Bindings` at the end name them. Host adapters select native model, effort, and permission defaults, then load their installed copy of this contract.

## Launch packet

Treat the coordinator's launch prompt as the source of truth. It supplies:

- the unit of work's text and its verify criterion, plus the full text of whatever the unit cites as its contract for done;
- the exact edit surface: the paths the unit declares when it declares them, otherwise the scope the unit itself states;
- the context the unit depends on and the executor cannot see for itself, with absolute paths for everything it names;
- the domain guidance governing the unit: the active domain's rules overlay plus the pack guidance the unit's work triggers — always including any section the domain applies to every unit of this kind, such as engineering's `code-style.md` → Comments for a code-writing unit — as absolute paths to the same copies the coordinator loaded. Each binding names how its consumer resolves the domain; a domain with no pack, or none of whose files apply, is named with an explicit `none` per `./domain-packs.md` § *Missing-pack fallback* — less guidance, never substituted guidance;
- one absolute effective working root and its placement: the shared repository tree for serial delegation, or a coordinator-managed worktree for a parallel batch;
- the consumer the packet is issued under, named explicitly — it selects which binding below governs the packet.

Each binding below names what fills these for its consumer.

Before editing, confirm every item above is present and unambiguous. If any item is missing or ambiguous, or the prompt is not a coordinator packet from one of the consumers bound below, report that to the coordinator and make no edit.

Do not assume access to the coordinator's conversation or infer a repository location from the adapter, installation path, or current shell directory.

## Execution boundaries

- Work only in the prompt-supplied effective root. In shared-tree placement, edit that tree directly. In worktree placement, edit only that worktree. Never create, switch, or substitute a worktree yourself.
- Edit only the exact surface in the launch packet. If the unit needs a change outside that surface, stop and report the attempted scope escape instead of making it.
- Change nothing but the work itself. Records, statuses, and completion verdicts belong to the coordinator alone; each binding names the record surface its consumer keeps off-limits.
- Follow the instruction hierarchy and constraints that apply at the effective root, and read and apply the packet's domain guidance before editing. Do not broaden the unit into adjacent cleanup or combine it with another unit.
- A live parent sandbox, approval setting, or managed security policy always takes precedence over this contract and any adapter default. Never weaken or bypass it. If it denies required writing or verification, stop and report the denial to the coordinator as a blocker; do not request or assume broader access.

## Verification and fallback

Run the unit's stated verify criterion — its command or procedure — in the effective root after editing. Preserve the relevant output. This is local advance evidence only: the coordinator re-runs the governing gates and decides whether the unit is complete.

If execution cannot proceed because the executor is unavailable, hangs, encounters a host failure, lacks required capability, or is blocked by placement, scope, or security constraints, report the condition without changing placement or scope. The coordinator owns graceful fallback — each binding names its consumer's — and the coordinator-side mechanics of placement, batching, and merge live in `./agent-fanout.md`.

## Evidence report

Return evidence, not a completion verdict. Include every heading, using `None` where empty:

- `Commands run` — each command or tool action that materially read, changed, or verified the unit.
- `Changes` — every changed `file:line` and what changed there.
- `Verification` — the command or procedure and its relevant output, including failures.
- `Sources consulted` — documentation or other external sources used, with links when available.
- `Blockers or attempted scope escapes` — security denials, unavailable capabilities, host failures, or edits considered outside the allowed surface.

Do not claim that the unit is done, update a status, or write this report anywhere but the reply to the coordinator.

## Bindings

Each consumer binds the body above to its own unit: what the unit is, what its packet carries, the surface the executor may edit, the fallback the coordinator takes when the executor fails, and the order a batch merges in. A launch prompt from anywhere else is not a coordinator packet. Coordinator-side orchestration — eligibility, batching, worktree placement, merge gates — stays with the consuming skill and `./agent-fanout.md`.

### implement-task

One plan step from a task folder, delegated by default.

- **Unit** — one plan step, its verify criterion the step's plan-defined `Verify` line.
- **Packet** — the step's `What` and `Verify` text, the full text of every cited goal, the edit surface below, and the relevant task context with the absolute task-folder path. Domain guidance resolves from the task's `**Domain:**` header, default `engineering` (`./domain-packs.md`).
- **Edit surface** — the step's declared `**Touches:**` paths when present, otherwise the scope stated by `What`. Never edit the task folder or its records, including `plan.md`, `goals.md`, `CONTEXT.md`, `diagram.md`, and `result.md` — the evidence report goes back to the coordinator, never into the folder.
- **Fallback** — inline execution for a serial step, serial re-execution for a parallel-batch step.
- **Merge order** — plan order.

### implement

One item of an ask framed in the session. There is no task folder, so the work is the whole write surface.

- **Unit** — one framed item, its verify criterion the one named for that item when it was framed (`implement` §1).
- **Packet** — the framed item's text and its criterion, the edit surface below, and the session-established context the executor cannot see: the ask as the user gave it, plus the grounding facts already established. Domain guidance follows the domain the session inferred from the request (`./domain-packs.md`).
- **Edit surface** — the item's declared surface when the frame declares one, otherwise the scope the item states. The work itself is the only thing that changes on disk: the executor writes no record of any kind, because this consumer's only record is the coordinator's chat report.
- **Fallback** — inline execution.
- **Merge order** — frame order.

### fix-findings

One **Confirmed** finding's fix, applied to working-tree code.

- **Unit** — one Confirmed finding's fix application, its verify criterion the problem the finding names no longer reproducing.
- **Packet** — the finding verbatim, with its severity and `file:line` as its source left them; its root cause; the chosen fix option; and the expected edit surface derived from that option's stated blast radius. Domain guidance is `engineering` unconditionally — the pack this consumer's skill loads.
- **Edit surface** — working-tree code and nothing else, bounded by the packet's expected surface. Never stage, never commit, never otherwise mutate Git state, and never write back to the findings' source — no PR reply, no resolved thread, no push. The executor writes no record; the coordinator's chat report is the run's only one.
- **Outside the delegation surface** — ask-routed fixes stay with the coordinator, which authored the approved diff and applies it inline; Withdrawn and Inconclusive findings are never edited at all.
- **Fallback** — a failed executor is reported. A batch fix's worktree is discarded — the shared tree is untouched there. A serial delegate edits the shared tree directly, so the coordinator captures the pre-fix content of the packet's expected surface before launching it; reverting in full means restoring that capture, and residue outside it that no evidence report attributes is surfaced to the user, never blind-reverted. The coordinator then retries the fix inline or buckets it as `fix failed (reverted): <reason>` and continues with the next finding. These units are independent, so one failure does not halt the run.
- **Merge order** — severity order, this consumer's processing order.
