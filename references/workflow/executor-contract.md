# Write-Mode Executor Contract

Execute the supplied unit/segment and return evidence (§ *Launch packet*, § *Consumers*). Host defaults/engine: `./executor-routing.md`; probes: `./agent-fanout.md`. This file addresses the executor. The coordinator's segment, routing, intake, and binding rules are in `./executor-coordinator.md`, which an executor does not read.

## Launch packet

The coordinator supplies:

- Unit text, verify criterion, and the full text of cited completion contracts.
- Exact edit paths, or the unit's stated scope.
- Context unavailable to the executor, with absolute paths. For reachable files, give paths and non-obvious facts; otherwise provide verbatim content.
- Prior user decisions and agreed boundaries.
- The `../../CORE_RULES.md` excerpts below, verbatim, only when the coordinator's session did not start with the always-on core rules. Those rules come from the `setup.ts` Claude Code rule file `~/.claude/rules/agents-kit-core-rules.md` or the marked core-rules block in `~/.codex/AGENTS.md`. Reading `CORE_RULES.md` during the session does not count.
    - Relevant § *Ask Before Assuming* text.
    - The entry template and dependency-problem paragraphs of § *NOTICED BUT NOT TOUCHING*.
- Domain guidance: universal per-unit sections verbatim, including code-style Comments for code and documentation's link sweep for documents; overlays/triggered pack files as absolute paths, or explicit `none`.
- Required checks: the criterion and every domain per-unit check (`./execution-loop.md` § *Two verification tiers*). Each names its owner (`executor` by default, or `coordinator`), exact command/procedure, assertion, passing condition, absolute execution root, and needed capability. Preserve assertions and passing conditions when assigning ownership or retargeting paths. Every check leaves the runner's cache on (`../engineering/boundary-scope.md` § *Never disable the runner's cache*).
- Silence-watch command `node <kit-root>/scripts/silence-watch.ts` or `none (<reason>)`, which the coordinator supplies under `./delegated-waiting.md` § *Shell commands*. Before awaiting any background shell command, including a required check, arm its watch under `./delegated-waiting.md` § *Shell commands*.
- One absolute effective root and its placement (§ *Execution boundaries*).
- One absolute scratch directory assigned under `./agent-scratch.md` § *Assignment*. Keep scratch files there under its § *Agent rules*.
- Consumer label naming a § *Consumers* entry and its coordinator binding. Supply all context; interpreting the packet requires no skill/consumer-definition fetch.

A segment packet gives domain guidance, the effective root, the scratch directory, and the consumer label once for all its units, and every other item per unit.

Report missing/ambiguous items or unregistered packets (§ *Consumers*) without editing. Infer no root from adapter, installation, or shell.

## Execution boundaries

Placement is independent of engine. Serial units use the shared tree; eligible parallel units use coordinator-managed worktrees (`./parallel-batch.md`).

- Work within the effective root; creating, switching, or substituting worktrees is coordinator-only. Outside that root, keep any file you create yourself in the assigned scratch directory.
- Edit only the packet's surface. Report a needed outside edit as an attempted scope escape. Writes in the assigned scratch directory are not scope escapes. Neither is output that required checks and their tools write outside the root, such as temp directories and runner or package caches.
- Change work products only; records, statuses, and completion verdicts remain with the coordinator.
- Apply the effective root's instruction hierarchy and packet guidance before editing. Exclude adjacent cleanup and unlisted units; execute segment units in packet order.
- Take `../../CORE_RULES.md` § *Ask Before Assuming* and § *NOTICED BUT NOT TOUCHING* from your context or the packet. When neither holds them, read `../../CORE_RULES.md` before editing. Their absence from the packet is then not a missing item.
- Return unresolved impactful choices to the coordinator before dependent edits. Continue independent authorized work under `../../CORE_RULES.md` § *Ask Before Assuming*.
- Live sandbox, approval, and managed security policies override adapter defaults and this contract. Preserve those boundaries. On denied writing or verification, stop and report a blocker without requesting or assuming broader access.

## Verification and fallback

Run only required checks assigned to the executor at the effective root; fix and rerun failures within scope. Report coordinator-owned checks as pending, retaining their packet definitions. Prove each unit's executor-owned checks before its successor; failure ends the segment with completed evidence returned. A serial segment ends at its first unit with a coordinator-owned required check. Health remains coordinator-only.

Report execution blockers without changing root/scope. The coordinator applies the binding's fallback. A check the packet declared open is not an execution blocker; it takes the open-check pause under `./executor-coordinator.md` § *Write-mode routing* → **Coordinator-owned checks**.

Pending impactful choices require user input under `../../CORE_RULES.md` § *Ask Before Assuming*.
Fallback cannot select an option, authorize dependent work, or establish completion while that choice remains pending.

## Evidence report

Use the same report for native and external execution. Report each unit in packet order. Include every heading, using `None` for empty fields except `Outcome`:

- `Outcome`: `ready` means ready for coordinator intake, never accepted completion. Use `blocked` when execution or required verification cannot proceed, apart from checks the packet declared open. Use `needs-decision` for work held on an impactful choice. Use `not-started` for unreached work, naming what prevented its start.
- `Commands run`: every command/tool action materially reading, changing, or verifying the unit.
- `Changes`: each changed `file:line` within the effective root, and its change.
- `Comments added or edited`: each comment and its non-obvious invariant.
- `Verification`: retain each required check's packet definition and identify its proof owner. Executed checks give the exact command/procedure, its output or evidence, exit status or pass/fail result, and absolute execution root. All four are required evidence. A command gives its raw output verbatim. Past 50 lines, a whole-line verbatim excerpt may stand in when it keeps the command's result and summary lines and every failure diagnostic. The excerpt marks each elision with its line count. A procedure gives the observable evidence its domain's `verification.md` names. Anything else in place of a command's raw output counts as a missing field, including a summary, paraphrase, or unmarked elision. Label assigned coordinator checks `pending`; checks unavailable to both parties remain `open`, naming the missing capability.
- `Sources consulted`: external sources, linked where available.
- `Dependency problems`: material out-of-scope dependency problems met during the unit, including those a rerun cleared or a recovered incident overcame. Use the entry shape in `../../CORE_RULES.md` § *NOTICED BUT NOT TOUCHING*.
- `Blockers or attempted scope escapes`: active denials, missing capabilities, host failures, outstanding required-check failures, and outside edits considered or made.
- `Pending choices`: researched viable options, material trade-offs, any user preference already supplied, a recommendation with its reasons, and the held dependent work.
- `Recovered incidents`: failures of a tool or step that no required check names, overcome within the authorized packet, with successful replacement evidence under `Verification`. A required check stays under `Blockers or attempted scope escapes` while the latest run of its unchanged packet definition fails. A failure that rerun cleared needs no entry beyond `Commands run` and the passing run under `Verification`. A dependency problem behind it still takes a `Dependency problems` entry.

Keep security denials, scope concerns, pending choices, and outstanding required-check failures in their active fields, and dependency problems under `Dependency problems`. A recovered incident cannot conceal them.
`ready` may include pending checks only when explicitly assigned to the coordinator, and open checks only when the packet declared them open. Every other executor-owned check must pass; failed or unassigned checks cannot be deferred as coordinator work.

Send the report only as the coordinator reply. Make no completion claims, status updates, or report-file writes.

## Consumers

Only these consumers issue coordinator packets.

### implement-task

- **Edit surface:** Touches paths, else What's scope. Exclude task folders/records, GROUP_CONTEXT files, and `GROUP_LOG.md`, which only `start-group` writes; grounding corrections and records belong to the coordinator.

### implement

- **Edit surface:** declared paths, else stated scope. Write work only; the coordinator's chat is the sole record.

### fix-findings

- **Edit surface:** selected working-tree code and documentation within the packet's surface. No staging, commits, other Git mutation, findings-report edits, source replies/resolution/push, or live-page writes. The coordinator's chat report and each concern batch's commit, or the run's one commit under `-1`, are the record.
- **Outside the delegation surface:** findings the run does not fix receive no edits, including Withdrawn and Inconclusive findings.
