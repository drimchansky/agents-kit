# Write-Mode Routing and the Engine Registry

Resolve the write executor, its authorization, and its launch route before writing or launching work.

## The registry and its authorization

**The registry.** Three consumers launch write-mode executors: **`implement-task`**, **`implement`**, and **`fix-findings`**. Each one's unit, packet, edit surface, fallback, merge order, and any restriction on what it may delegate are its binding in `./executor-contract.md` § *Bindings*; `fix-findings`'s restriction sits under that binding's *Outside the delegation surface*. Each consumer's `SKILL.md` authorization provisions name executor delegation among its sanctioned writes. Name that delegation in the proposal (`./user-facing-messages.md` § *Blocks* → **The proposal line**).

**Standing authorization.** A user invoking one of these consumers by command, or by a confirmed proposal that named executor delegation (`./skill-conventions.md` § *The invocation gate*), is thereby requesting it; an instruction permitting agents when the user asks is satisfied by that invocation. A run the user did not ask for, or a confirmed proposal that left delegation unnamed, carries no such authorization: ask before delegating, or keep the unit inline under exception 2 of `./write-mode-posture.md`. An instruction, sandbox, or permission setting that forbids spawning outright is that same exception 2: announced, recorded, run inline, never bypassed or weakened.

## Selection

Accept `-e native|codex|claude` with a required value, or an equivalent explicit natural-language selection.
The flag is a standalone `-e` token in the argument-hint's trailing position, outside quoted or code text. Any other `-e` is request text.
Reject a flag with a missing or unknown value, or two flags with different values, before writes or executor launches.
Reject same-vendor CLI nesting; the registry below admits only cross-vendor external routes. There is no `--executor` alias.

Omission retains the prior selection only within the active run; otherwise use `native`.
Keep the selected engine for subsequent units, batches, and corrective relaunches unless the user explicitly changes it.
Selection changes neither the consumer's authorization nor its delegation eligibility. Review `-x` remains a read-only cross-check (`./probe-cross-check.md`).

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

In the consumer's execution record, name explicit selections, external launches, and every announced fallback; only native selected by default may remain implicit.
Record the receipt's model, effort, and policy with their provenance, its `helperExitCode`, and a short diagnostic summary. Process success does not accept the unit.
The receipt's model and effort are the requested values, not proof of what the CLI applied.
