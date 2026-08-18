# Agent Fan-Out: Probes, Executors, and Engines

How a skill delegates work to other agents, in two modes: **probes** — self-contained read-only questions whose answers come back as text evidence — and **executors** — write-mode subagents that each carry out one coordinator-supplied unit of work for a registered write-mode consumer. **This file is the single source of truth for probe behavior and the routing of native write-mode executors.** Engine commands, the `-x` cross-check, and the probe prompt shapes live in `./probe-engines.md`; the coordinator-side parallel-batch mechanics live in `./parallel-batch.md`. Write-mode executor behavior lives in `./executor-contract.md`; change that behavior there, and change probe contracts, routing, and the write-mode engine registry here.

## What a probe is

A **probe** is one self-contained, read-only question posed to a separate agent, whose answer comes back as text evidence. Its defining property is **independence**: the probe sees only what its prompt carries — no session context, no accumulated assumptions, no stake in the answer.

## Probe contract (every engine)

- **Self-contained prompt.** Paste in everything the probe must judge — the claims under check, the diff scope or doc paths, absolute paths to the artifacts. Never assume the probe can see the session.
- **One concern per probe.** A claim *list* for one check is one probe (one prompt, one merged answer) — don't fan a per-claim probe swarm when a batched prompt does the job.
- **Read-only, promised always, enforced where the engine can.** Probes verify by reading — files, diffs, docs — never by mutating, and never by running the project's build or suite (a probe stays analysis-only even where its invoking review runs verification scripts itself). Never pass an engine's sandbox-bypass flags. Enforcement varies by engine — see the registry; the promise does not.
- **Demand cited verdicts.** The prompt must require verdicts or findings with `file:line` evidence. An uncited probe answer is an opinion, not evidence.
- **Evidence, not authority.** A probe's answer is weighed, spot-checked where surprising, and can force re-verification — but it never assigns a verdict or overrides the session's own pass. The invoking skill owns its verdicts.
- **Degrade gracefully.** A missing engine, a failed login, or a probe that has died is reported (`Cross-check: skipped (<reason>)`) and the skill proceeds on its own pass. A probe never blocks a skill — but slowness alone is not failure: a probe still making progress is waited on with its status reported, and skipping it is the user's call, not a timeout's.
- **Content leaves the machine.** A probe ships its prompt to the engine's vendor. Run a cross-vendor probe only on work the user already uses that vendor's CLI on; when in doubt, ask first.
- **Scratch, not record.** Probe output lands in the host's scratch/temp area — never in the task folder; result files record the *merged outcome*, not probe transcripts.

Engine commands and launch recipes, the `-x` cross-check contract, and the probe prompt skeletons live in `./probe-engines.md` — read it when launching a probe or running a cross-check; the probe contract above and the merge contract below govern every engine.

## Merge contract

The invoking skill compares the probe's answer against its own pass:

- **Agreement** strengthens the evidence — cite it and move on.
- **Contradiction is never silently dropped.** Where the probe contradicts the session's grounding or the artifact's own claims, re-check that spot before assigning the verdict; a confirmed contradiction becomes a finding (in `review-task`, a `CONTRADICTED` claim is evidence toward `conflicts with what exists` / `infeasible as stated`; a `NOT FOUND` on a load-bearing reference is a gap).
- **Novel probe findings are candidates, not findings.** Verify each against the artifact before adopting it into the output — under the session's own severity calibration; never paste a probe finding unverified.
- **The outcome line closes the loop.** For the `-x` shapes, the `Cross-check:` line states `clean`, `merged: …`, or `skipped (<reason>)` — the record makes a skipped or empty probe visible instead of leaving absence ambiguous. The lens-review shape closes the same way on its `Lens probes:` line (per its shape paragraph in `./probe-engines.md`). The verify shape closes on its consuming skill's mandatory **Verified** line instead, which carries the same guarantee for the same reason; `Cross-check:` stays reserved for the `-x` pass, so a composite running both keeps two distinct records. The re-derivation shape closes on its consumer's mandatory `Cold re-derivation:` line the same way (per its shape paragraph in `./probe-engines.md`).

## Write-mode routing

Write-mode fan-out is limited to the consumers registered here. `./executor-contract.md` governs executor behavior; each consumer's own skill owns how it frames a unit of work and what verdicts it reaches. Every other fan-out consumer uses the probe contract above.

**The registry.** Three consumers launch write-mode executors, each with its own posture:

- **`implement-task`** — unit: one plan step. **Delegate by default**: one serial executor per step, with an inline fallback when delegation clearly doesn't pay.
- **`implement`** — unit: one framed item. Default **inline** because this skill's units are small and assembling a self-contained packet costs more than making the edit; delegate when the remaining run is multi-unit *and* the unit's packet is self-contained — no mid-unit user interaction expected.
- **`fix-findings`** — unit: one Confirmed finding's fix application. Same inline default and same delegation trigger, scoped to **Confirmed auto-path fixes**: ask-routed fixes stay with the coordinator, which already authored the approved diff, and Withdrawn or Inconclusive findings are never edited at all.

Delegation by a conditional-posture consumer is **announced in chat and recorded in that skill's report** — that record is what keeps the default from drifting silently into always- or never-delegate. The exact record shape is each skill's own.

**Judgment never delegates**, under any posture. The coordinator keeps unit framing, each unit's
outcome re-proof on its own tree, the consumer-declared integrated-health boundary, the report
buckets, and every status. Executor output is advance evidence, never the gate.

The mechanics of running units concurrently — eligibility, worktree placement, the frozen shared tree, the merge gates, incorporation order, and cleanup — live in `./parallel-batch.md`; read it when a batch qualifies.

## Write-mode engine registry

- **`native`** — the only registered write-mode engine: Claude Code's native subagents on Claude, and Codex multi-agent on Codex. The coordinator launches the named `executor` adapter on both hosts and supplies its effective root: the shared tree for serial delegation or a coordinator-managed worktree for a parallel batch. The adapter then loads its installed copy of `./executor-contract.md`.

  **Adapter defaults.** Claude installs `~/.claude/agents/executor.md`, pinned to `claude-opus-5` at `xhigh` and inheriting the parent permission mode. Codex installs `~/.codex/agents/executor.toml`, pinned to `gpt-5.6-terra` at `xhigh` with `sandbox_mode = "workspace-write"`. These kit-owned defaults select the native model and effort; Codex additionally requests write capability, while the live parent sandbox, approval setting, or managed security policy remains authoritative. The full model pins preserve a stable tier relationship instead of floating with provider aliases; on a host where a pin does not resolve or the current coordinator is already at or below it, retune the installed definition and remove its sibling `.agents-kit-executor` marker, or the next `setup.ts` run restores the kit copy.

  **Degradation.** If the named adapter, its configured model, or native subagent support is unavailable, report the failure. The coordinator-owned fallback in `./executor-contract.md` applies unchanged and symmetrically on either host; adapter availability never changes placement or scope.

The `codex` and `claude` CLI entries in the probe engine registry (`./probe-engines.md`) remain cross-vendor, read-only probe engines only. They are not registered for write mode.
