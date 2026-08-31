# Write-Mode Routing and the Engine Registry

The registry half of `./executor-contract.md` — **who** may launch a write-mode executor, on **what authorization**, and on **which engine** — split out of that file, which keeps the contract every launch and every intake runs on. Read this one when the answer is not the default: when a run needs to know whether its consumer is registered or whether an unrequested invocation carries authorization, and when a native adapter, its model pin, or subagent support is what failed.

## The registry and its authorization

**The registry.** Three consumers launch write-mode executors: **`implement-task`**, **`implement`**, and **`fix-findings`**. Each one's unit, packet, edit surface, fallback, merge order, and any restriction on what it may delegate are its binding in `./executor-contract.md` § *Bindings* — `fix-findings`'s delegation surface among them, under that binding's *Outside the delegation surface*.

**Standing authorization.** A user invoking one of these consumers is thereby requesting executor delegation: per-unit delegation *is* the protocol the invoked skill publishes, so an instruction that permits spawning agents when the user asks for them is satisfied by *that* invocation itself and needs no separate per-session request. These consumers are model-invocable, so a run the user did not ask for carries no such authorization: ask before delegating, or keep the unit inline under exception 2 of the posture file, `./write-mode-posture.md`, reading which door the run came through per `./skill-conventions.md` § *The invocation gate*. This authorizes nothing further: an instruction, sandbox, or permission setting that forbids spawning outright is the posture file's exception 2 — announced, recorded, run inline — never bypassed, and never weakened to get a unit delegated.

## Write-mode engine registry

- **`native`** — the write-mode engine: Claude Code's native subagents on Claude, and Codex multi-agent on Codex. The coordinator launches the named `executor` adapter on both hosts and supplies its effective root: the shared tree for serial delegation or a coordinator-managed worktree for a parallel batch. The adapter then loads its installed copy of `./executor-contract.md`.

  **Adapter defaults.** Claude installs `~/.claude/agents/executor.md`, pinned to `claude-opus-5` at `xhigh` and inheriting the parent permission mode. Codex installs `~/.codex/agents/executor.toml`, pinned to `gpt-5.6-sol` at `xhigh` with `sandbox_mode = "workspace-write"`. These kit-owned defaults select the native model and effort; Codex additionally requests write capability, while the live parent sandbox, approval setting, or managed security policy remains authoritative. The full model pins preserve a stable tier relationship instead of floating with provider aliases; on a host where a pin does not resolve or the current coordinator is already at or below it, retune the installed definition and remove its sibling `.agents-kit-executor` marker, or the next `setup.ts` run restores the kit copy.

  **Degradation.** If the named adapter, its configured model, or native subagent support is unavailable, report the failure. The coordinator-owned fallback in `./executor-contract.md` § *Verification and fallback* applies unchanged and symmetrically on either host; adapter availability never changes placement or scope.
