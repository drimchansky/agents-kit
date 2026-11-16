# Write-Mode Routing and the Engine Registry

Resolve the write executor, its authorization, and its launch route before writing or launching work.

## The registry and its authorization

**The registry.** Three consumers launch write-mode executors: **`implement-task`**, **`implement`**, and **`fix-findings`**. Each one's unit, packet, edit surface, fallback, and merge order are its binding in `./executor-contract.md` § *Bindings*. `fix-findings` delegates every fix it applies, Auto or approved (`fix-findings` § *Execution strategy: every fix delegates*). `fix-findings-reconcile` launches executors only in its fix phase, under the `fix-findings` binding, and its own invocation carries the standing authorization below. Each consumer's `SKILL.md` authorization provisions name executor delegation among its sanctioned writes. Name that delegation in the proposal (`./user-facing-messages.md` § *Blocks* → **The proposal line**).

**Standing authorization.** A user invoking one of these consumers by command, or by a confirmed proposal that named executor delegation (`./skill-conventions.md` § *The invocation gate*), is thereby requesting it; an instruction permitting agents when the user asks is satisfied by that invocation. A run the user did not ask for, or a confirmed proposal that left delegation unnamed, carries no such authorization: ask before delegating, or keep the unit inline under exception 2 of `./write-mode-posture.md`. An instruction, sandbox, or permission setting that forbids spawning outright is that same exception 2: announced, recorded, run inline, never bypassed or weakened.

## Selection

Accept `-e native|codex|claude` with a required value, or an equivalent explicit natural-language selection.
The flag is a standalone `-e` token among the invocation's trailing flags, outside quoted or code text. Any other `-e` is request text.
Reject a flag with a missing or unknown value, or two flags with different values, before writes or executor launches.
Reject same-vendor CLI nesting; the registry below admits only cross-vendor external routes. There is no `--executor` alias.

Omission retains the prior selection only within the active run; otherwise use `native`.
Keep the selected engine for subsequent units, batches, and corrective relaunches unless the user explicitly changes it.
Selection changes neither the consumer's authorization nor its delegation eligibility. Review `-x` remains a read-only cross-check (`./probe-cross-check.md`).

## Effort selection

Before every executor launch, assess its assigned work on either coordinator host, Claude Code or Codex.
Respect explicit user effort instructions and live constraints before applying this automatic policy:

- **`medium`:** clear requirements, detailed launch instructions, and straightforward work following familiar patterns with few interacting constraints.
- **`high`:** ordinary work, or insufficient evidence for either adjustment.
- **`xhigh`:** very complex work requiring substantial reasoning across interacting constraints, such as concurrency, migrations, or cross-component compatibility.

A detailed plan alone does not justify `medium`. Resolve missing requirements or consequential choices under `../../CORE_RULES.md` § *Ask Before Assuming*.
For several units in one launch, use the highest effort any included unit needs.
Assess independent parallel launches separately. Reassess each fresh launch, including existing recovery launches, from its current assigned work.
Do not change a running executor's effort or add an effort-triggered retry.
Keep the selected model, named executor role, engine, permissions, delegation eligibility, verification, intake, and recovery requirements unchanged.

### Native capability

Inspect the named executor's configured pins, the live launch tool's schema and restrictions, and the host's documented precedence.
A generic effort parameter does not establish support for the named role or launch form.
Use an actual supported effort parameter when it can select the requested level without changing the role or model.
Prompt text naming an effort is not a runtime control.

- **Claude Code:** [per-invocation effort](https://code.claude.com/docs/en/sub-agents#choose-an-effort-level) requires v2.1.292 or later and a non-fork subagent. Its `effort` parameter overrides agent frontmatter; `CLAUDE_CODE_EFFORT_LEVEL` overrides both. Confirm the live tool exposes that parameter and no governing setting prevents selection.
- **Codex:** [custom-agent pins](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents) override spawn model and effort values. Request effort only when the named executor and live launch form permit it; a fixed role or fork restriction cannot be bypassed with another role.

When selection is unavailable, retain an established `high` setting and report the limiting pin, control, or precedence rule.
If the fixed setting is unknown or differs from `high`, report the unmet host prerequisite and hold the launch.
A held launch is not `./write-mode-posture.md` exception 2; never run its unit inline.
The consumer's **Fallback** in `./executor-contract.md` § *Bindings* does not apply to it.
The held unit and its dependents wait; independent units continue.
Record a hold still open at run end in the consumer's existing record, naming the held unit and the unmet prerequisite.
That record is `implement-task`'s **Blocked** binding, `fix-findings`' **Untouched** bucket as `not attempted`, or `implement`'s chat report.
Do not claim that `high` was applied or retune host configuration or agent definitions; leave that work to the user.
Do not replace an explicit user effort choice with automatic `high`.
When the host cannot apply that choice, report the fixed setting and the pin, control, or precedence rule that prevents it.
Ask the user under `../../CORE_RULES.md` § *Ask Before Assuming*, and launch at that setting only after they agree.
When the live schema is unavailable, label documentation-backed capability conclusions and leave runtime behavior unverified.

### Effort records

In the consumer's existing execution record, identify the launch's item, fix, or covered segment units.
Record each non-default effort request with its level and a short reason, including a user override when applicable.
For unavailable selection, record the retained setting and limitation, or the unmet prerequisite when no fallback is established.
Distinguish requested effort from observed host behavior; an ignored or capped request is not proof of the selected level.
Leave a native launch's effort implicit only when it equals the named executor's `high` adapter pin and nothing else needs reporting.
Record a native launch whose requested or applied effort differs from that pin.

## Write-mode engine registry

- **`native`**: Claude Code's native subagents on Claude, Codex multi-agent on Codex. The coordinator launches the named `executor` adapter and supplies its effective root under `./executor-contract.md` § *Execution boundaries*. The adapter loads its installed copy of that contract.

  **Adapter defaults.** Claude's adapter is `agents/executor.md` under the install root (`./reviewer-contract.md` § *Adapter defaults*), launched as `agents-kit:executor` from the plugin; Codex installs `~/.codex/agents/executor.toml`. Both inherit parent permissions; the Codex definition omits sandbox, approval, and network overrides. Managed security policy remains authoritative. Each carries its own model and effort pins. Where a pin does not resolve, or the coordinator is below it, retune a `setup.ts` install's definition and remove its sibling `.agents-kit-executor` marker, or the next `setup.ts` run restores the kit copy. A plugin install cannot be retuned durably (`./reviewer-contract.md` § *Adapter defaults*); take **Degradation** below.

  **Degradation.** If the adapter, its model, or native subagent support is unavailable, report the failure and take the coordinator-owned fallback in `./executor-contract.md` § *Verification and fallback*, the same on either host. Adapter availability never changes placement or scope.

- **`codex`**: a Claude Code coordinator launches Codex CLI under § *External launches and recovery*.
- **`claude`**: a Codex coordinator launches Claude CLI under that same section.

## External launches and recovery

Prepare, launch, and collect through `./executor-engines-cross-vendor.md` § *Prepare and collect*.

Report an unavailable selected CLI, unsupported launch, or failed process; apply the consumer's existing fallback without silently switching vendors.
An inline fallback for an explicitly selected external engine runs on the host's own vendor, so ask the user before taking it (`../../CORE_RULES.md` § *Ask Before Assuming*).
An announced inline fallback requires the existing authorization and live policy to permit it. It cannot bypass a denial's governing restriction.
Use the selected engine again when delegated recovery relaunches the unit.

In the consumer's execution record, name explicit selections, external launches, and every announced fallback. Apply § *Effort records* even for default-selected native launches.
Record the receipt's model, effort, and policy with their provenance, its `helperExitCode`, and a short diagnostic summary. Process success does not accept the unit.
The receipt's model and effort are the requested values, not proof of what the CLI applied.
