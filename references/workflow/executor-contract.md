# Write-Mode Executor Contract

This is the host-neutral contract for a write-mode executor. An executor carries out exactly one coordinator-supplied unit of work and returns evidence to the coordinator. What a unit is, what the packet carries, and what the executor may edit are per-consumer — the `## Bindings` at the end name them. Host adapters select native model, effort, and permission defaults, then load their installed copy of this contract.

## Launch packet

Treat the coordinator's launch prompt as the source of truth. It supplies:

- the unit of work's text and its verify criterion, plus the full text of whatever the unit cites as its contract for done;
- the exact edit surface: the paths the unit declares when it declares them, otherwise the scope the unit itself states;
- the context the unit depends on and the executor cannot see for itself, with absolute paths for everything it names;
- the domain guidance governing the unit, delivered two ways: any section the domain applies to every unit of this kind — such as engineering's `code-style.md` → Comments for a code-writing unit — travels verbatim in the packet, its full section text, so what always applies costs the executor no read hop; the active domain's rules overlay and the pack guidance the unit's work triggers travel as absolute paths to the same copies the coordinator loaded. Each binding names how its consumer resolves the domain; a domain with no pack, or none of whose files apply, is named with an explicit `none` — less guidance, never substituted guidance;
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

Run only the unit's stated verify criterion — its command or procedure — in the effective root after editing. Preserve the relevant output. This is local advance evidence only: after incorporation the coordinator re-proves the full unit-outcome tier (`./execution-loop.md` § *Two verification tiers*) on the integrated tree, then runs full health only at the owning consumer's declared boundary.

If execution cannot proceed because the executor is unavailable, hangs, encounters a host failure, lacks required capability, or is blocked by placement, scope, or security constraints, report the condition without changing placement or scope. The coordinator owns graceful fallback — each binding names its consumer's — and the coordinator-side mechanics of placement, batching, and merge live in `./parallel-batch.md`.

## Evidence report

Return evidence, not a completion verdict. Include every heading, using `None` where empty:

- `Commands run` — each command or tool action that materially read, changed, or verified the unit.
- `Changes` — every changed `file:line` and what changed there.
- `Comments added or edited` — each comment the unit added or edited, with the non-obvious invariant it preserves.
- `Verification` — the command or procedure and its relevant output, including failures.
- `Sources consulted` — documentation or other external sources used, with links when available.
- `Blockers or attempted scope escapes` — security denials, unavailable capabilities, host failures, or edits considered outside the allowed surface.

Do not claim that the unit is done, update a status, or write this report anywhere but the reply to the coordinator.

## Bindings

Each consumer binds the body above to its own unit: what the unit is, what its packet carries, the surface the executor may edit, the fallback the coordinator takes when the executor fails, and the order a batch merges in. A launch prompt from anywhere else is not a coordinator packet. Coordinator-side orchestration — eligibility, batching, worktree placement, incorporated change sets, merge gates, and health-boundary hand-off — stays with the consuming skill and `./parallel-batch.md`.

### implement-task

One plan step from a task folder.

- **Unit** — one plan step, its verify criterion the step's plan-defined `Verify` line. The executor proves that criterion only; the coordinator re-proves the full unit-outcome tier on the integrated tree and owns the health boundary.
- **Packet** — the step's `What` and `Verify` text, the full text of every cited goal, the edit surface below, and the relevant task context with the absolute task-folder path. Domain guidance resolves from the task's `**Domain:**` header, default `engineering`.
- **Edit surface** — the step's declared `**Touches:**` paths when present, otherwise the scope stated by `What`. Never edit the task folder or its records, including `plan.md`, `goals.md`, `CONTEXT.md`, `diagram.md`, and `result.md` — the evidence report goes back to the coordinator, never into the folder.
- **Fallback** — inline execution for a serial step, serial re-execution for a parallel-batch step.
- **Merge order** — plan order.

### implement

One item of an ask framed in the session. There is no task folder, so the work is the whole write surface.

- **Unit** — one framed item, its verify criterion the one named for that item when it was framed (`implement` §1). The executor proves that criterion only; the coordinator re-proves the full unit-outcome tier on the integrated tree and owns the health boundary.
- **Packet** — the framed item's text and its criterion, the edit surface below, and the session-established context the executor cannot see: the ask as the user gave it, plus the grounding facts already established. Domain guidance follows the domain the session inferred from the request.
- **Edit surface** — the item's declared surface when the frame declares one, otherwise the scope the item states. The work itself is the only thing that changes on disk: the executor writes no record of any kind, because this consumer's only record is the coordinator's chat report.
- **Fallback** — inline execution.
- **Merge order** — frame order.

### fix-findings

One **Confirmed** finding's immediate fix application, applied to working-tree code.

- **Unit** — one Confirmed finding's fix application, its verify criterion the problem the finding names no longer reproducing. The executor proves that criterion only; the coordinator re-checks the full unit-outcome tier on the integrated tree and owns the retained-collection health boundary.
- **Packet** — the finding verbatim, with its severity and `file:line` as its source left them; its root cause; the chosen fix option; the expected edit surface derived from that option's stated blast radius; and its processing order plus any known dependencies. Domain guidance is `engineering` unconditionally — the pack this consumer's skill loads.
- **Edit surface** — working-tree code and nothing else, bounded by the packet's expected surface. Never stage, never commit, never otherwise mutate Git state, and never write back to the findings' source — no PR reply, no resolved thread, no push. The executor writes no record; the coordinator's chat report is the run's only one.
- **Outside the delegation surface** — ask-routed fixes stay with the coordinator, which authored the approved diff and applies it inline; Withdrawn and Inconclusive findings are never edited at all.
- **Fallback** — serial re-execution for a batch fix, inline execution for a serial delegate. A failed
  executor is reported. A batch fix's worktree is discarded — the shared tree is untouched there — and
  the fix re-executes serially against the integrated tree, whether the executor was unavailable, hung,
  surface-escaping, or conflicting. Before any serial delegate, the coordinator has the immutable run
  baseline and an exact pre-fix content capture; on immediate failure it restores only that pre-fix
  content — bounded by the skill's attribution rule, which surfaces content the run did not write rather
  than reverting it — then retries inline or buckets the finding `fix failed (reverted): <reason>` and
  continues. After a merged
  or serial fix passes its integrated outcome re-proof, the coordinator appends its ordered incorporated
  content/presence change set — relative to the shared state immediately before that fix, with known
  dependencies — to the immutable recovery ledger. Later final-outcome or health recovery uses the
  skill's dependency-safe baseline rebuild, never a Git reset, checkout, or reverse patch. These units
  are independent, so one failure does not halt independent survivors.
- **Merge order** — severity order within dependency order, this consumer's processing order. Ordered change sets are recovery evidence, never Git staging or commit state.
