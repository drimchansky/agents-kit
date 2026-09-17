# Write-Mode Routing and the Engine Registry

Who may launch a write-mode executor, on what authorization, and on which engine. Read it when a run is unregistered or unrequested, or when a native adapter, its model pin, or subagent support has failed.

## The registry and its authorization

**The registry.** Three consumers launch write-mode executors: **`implement-task`**, **`implement`**, and **`fix-findings`**. Each one's unit, packet, edit surface, fallback, merge order, and any restriction on what it may delegate are its binding in `./executor-contract.md` § *Bindings*; `fix-findings`'s restriction sits under that binding's *Outside the delegation surface*.

**Standing authorization.** A user invoking one of these consumers is thereby requesting executor delegation; an instruction permitting agents when the user asks is satisfied by that invocation. A run the user did not ask for carries no such authorization: ask before delegating, or keep the unit inline under exception 2 of `./write-mode-posture.md`, reading which door the run came through per `./skill-conventions.md` § *The invocation gate*. An instruction, sandbox, or permission setting that forbids spawning outright is that same exception 2: announced, recorded, run inline, never bypassed or weakened.

## Write-mode engine registry

- **`native`**: Claude Code's native subagents on Claude, Codex multi-agent on Codex. The coordinator launches the named `executor` adapter and supplies its effective root: the shared tree for serial delegation, a coordinator-managed worktree for a parallel batch. The adapter loads its installed copy of `./executor-contract.md`.

  **Adapter defaults.** Claude's adapter is `agents/executor.md` under the install root (`./reviewer-contract.md` § *Adapter defaults*), launched as `agents-kit:executor` from the plugin; Codex installs `~/.codex/agents/executor.toml`. Both inherit parent permissions; the Codex definition omits sandbox, approval, and network overrides. Managed security policy remains authoritative. Each carries its own model and effort pins. Where a pin does not resolve, or the coordinator is below it, retune a `setup.ts` install's definition and remove its sibling `.agents-kit-executor` marker, or the next `setup.ts` run restores the kit copy. A plugin install cannot be retuned durably (`./reviewer-contract.md` § *Adapter defaults*); take **Degradation** below.

  **Degradation.** If the adapter, its model, or native subagent support is unavailable, report the failure and take the coordinator-owned fallback in `./executor-contract.md` § *Verification and fallback*, the same on either host. Adapter availability never changes placement or scope.
