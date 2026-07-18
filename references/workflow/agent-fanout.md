# Agent Fan-Out: Probes, Executors, and Engines

How a skill delegates work to other agents, in two modes: **probes** — self-contained read-only questions whose answers come back as text evidence — and **executors** — write-mode subagents that each carry out one plan step in an isolated working copy, for `implement-task`'s parallel lane only. **This file is the single source of truth for cross-agent fan-out.** The review skills (`review-task`, `review-pr`, `review-commit`, `review-docs`) cite it from their `-x` flag; `implement-task` cites it from its `-p` flag; `CORE_RULES.md`'s parallel-agents rule points here for mechanics. When an engine recipe, the `-x` contract, or the write-mode contract changes, update it here first and propagate to the skills that cite it.

## What a probe is

A **probe** is one self-contained, read-only question posed to a separate agent, whose answer comes back as text evidence. Its defining property is **independence**: the probe sees only what its prompt carries — no session context, no accumulated assumptions, no stake in the answer. That isolation is a feature, not a limitation; it's what makes a probe worth consulting where the session's own read might be biased (grounding a plan it helped write, reviewing a diff whose intent it has already internalized).

## Probe contract (every engine)

- **Self-contained prompt.** Paste in everything the probe must judge — the claims under check, the diff scope or doc paths, absolute paths to the artifacts. Never assume the probe can see the session.
- **One concern per probe.** A claim *list* for one check is one probe (one prompt, one merged answer) — don't fan a per-claim probe swarm when a batched prompt does the job.
- **Read-only, enforced and promised.** Probes verify by reading — files, diffs, docs — never by mutating, and never by running the project's build or suite (reviews are analysis-only; the probe inherits that). Never pass an engine's sandbox-bypass flags.
- **Demand cited verdicts.** The prompt must require verdicts or findings with `file:line` evidence. An uncited probe answer is an opinion, not evidence.
- **Evidence, not authority.** A probe's answer is weighed, spot-checked where surprising, and can force re-verification — but it never assigns a verdict or overrides the session's own pass. The invoking skill owns its verdicts.
- **Degrade gracefully.** A missing engine, a failed login, or a hung probe is reported (`Cross-check: skipped (<reason>)`) and the skill proceeds on its own pass. A probe never blocks a skill.
- **Content leaves the machine.** A probe ships its prompt to the engine's vendor. Run a cross-vendor probe only on work the user already uses that vendor's CLI on; when in doubt, ask first.
- **Scratch, not record.** Probe output lands in the host's scratch/temp area — never in the task folder; result files record the *merged outcome*, not probe transcripts.

## Engine registry

- **`native`** — the host harness's own subagents (Claude Code's agent tool; Codex's multi-agent). **Default for all fan-out** except the opt-in `-x` cross-check below: bulk exploration, parallel searches, reference refresh. Richer integration, no process overhead.
- **`codex`** — OpenAI Codex CLI, headless. The cross-vendor engine when the host is Claude Code. Requires `codex` on PATH and an active login — `command -v codex` checks presence; a failed login surfaces at run time and degrades to `skipped`.

  ```bash
  codex exec --ephemeral --sandbox read-only --skip-git-repo-check \
    -C <working-root> -o <scratch>/probe.md "<probe prompt>"
  ```

  `--sandbox read-only` is the engine-side enforcement of the read-only promise; `-o` captures just the final message for merging; `--ephemeral` leaves no session files. Parallel probes are plain shell jobs (`&` + `wait`), one `-o` file each. Budget 1–5 minutes per probe at high reasoning — launch early, run in the background where the host supports it, and collect at the merge point.

- **`claude`** — Claude Code, headless. The cross-vendor engine when the host is Codex — the mirror of the above:

  ```bash
  cd <working-root> && claude -p --permission-mode plan \
    --no-session-persistence "<probe prompt>" > <scratch>/probe.md
  ```

  The leading `cd` pins the working root (`claude` has no `-C` equivalent); `--no-session-persistence` is the mirror of `--ephemeral` — no session files left behind.

## The `-x` cross-check (review skills, opt-in)

The review skills accept a `-x` flag: run one probe on the **cross-vendor engine** — the engine from the other vendor than the host harness (host Claude Code → `codex`; host Codex → `claude`) — as an independent second pass over the skill's own object. **Off by default**: without the flag, no probe runs and no cross-check line appears. The second pass is worth the cross-vendor hop because a different model family is maximally uncorrelated with the session's blind spots; everything else — exploration fan-out, multi-area searches, drift scans, URL refresh — stays `native` and needs no flag.

What the probe checks, per skill:

- **`review-task`** — independent grounding: the plan's reality claims (integration points, "reuse X" assumptions, referenced files/symbols/APIs), verdict per claim.
- **`review-pr`** — a cold second review of the branch diff against its base, findings with severity.
- **`review-commit`** — a cold second review of the staged diff, findings with severity.
- **`review-docs`** — independent grounding of the doc's verifiable claims against the artifacts they describe, verdict per claim.

Shared mechanics, every `-x` run:

- **Launch early, merge late.** Start the probe in the background as soon as its input is ready (the claims list, the diff scope); do the inline pass while it runs; collect and merge per the contract below before verdicts or findings are finalized. The probe supplements the session's pass, never replaces it.
- **Record the outcome.** The skill's output carries exactly one `Cross-check:` line — `clean` (nothing new, nothing contested) · `merged: <what the probe added or contested, and how it settled>` · `skipped (<reason>)`. With `-x` passed the line is mandatory, so a forgotten or failed probe is visible rather than ambiguous; without the flag the line doesn't appear. Each skill's output format says where the line lives.

## Probe prompt skeleton

For the grounding shape (`review-task`, `review-docs`):

```
You are an independent verifier with no prior context. Working root: <absolute path>.
For each numbered item below, answer with a verdict and file:line evidence.
Do not trust the item's own text — read the actual files.

Verdicts: CONFIRMED / CONTRADICTED / NOT FOUND

Items:
1. <claim>
2. …
```

For the cold-review shape (`review-pr`, `review-commit`), replace the numbered items with the review object — "review the diff `<base>..HEAD`" / "review the staged diff (`git diff --cached`)" — and demand findings, each with a severity, `file:line`, and the concrete failure it causes.

## Merge contract

The invoking skill compares the probe's answer against its own pass:

- **Agreement** strengthens the evidence — cite it and move on.
- **Contradiction is never silently dropped.** Where the probe contradicts the session's grounding or the artifact's own claims, re-check that spot before assigning the verdict; a confirmed contradiction becomes a finding (in `review-task`, a `CONTRADICTED` claim is evidence toward `conflicts with what exists` / `infeasible as stated`; a `NOT FOUND` on a load-bearing reference is a gap).
- **Novel probe findings are candidates, not findings.** Verify each against the artifact before adopting it into the output — under the session's own severity calibration; never paste a probe finding unverified.
- **The outcome line closes the loop.** The `Cross-check:` line states `clean`, `merged: …`, or `skipped (<reason>)` — the record makes a skipped or empty probe visible instead of leaving absence ambiguous.

## Write-mode fan-out: executors (`implement-task -p` only)

An **executor** is one subagent carrying out exactly one plan step in an isolated working copy — the write-mode counterpart of a probe. Executors exist for a single consumer: `implement-task`'s opt-in parallel lane (its `-p` flag), which runs independent plan steps concurrently and merges them at a checkpoint. The merge procedure lives in that skill; this file owns the delegation contract. No other skill launches executors — everything else that fans out stays a read-only probe.

### Executor contract

- **The coordinator owns the record.** The session agent is the **coordinator**: it owns the shared working tree, every task-folder write (`plan.md` checkboxes and statuses, `result.md` sections), and every verdict about step completion. An executor never writes a status, never touches the task folder, and never touches the shared tree.
- **One step per executor.** Batching steps into one executor recreates serial execution with less visibility; splitting one step across executors leaves its `Verify` with no owner.
- **Self-contained prompt.** Like a probe: paste in everything the step needs — the step's What/Verify text, the text of the goals it cites, the declared edit surface (`**Touches:**`), the relevant `CONTEXT.md` excerpts, absolute paths. An executor sees no session context.
- **Isolated working copy, never the shared tree.** Each executor works in its own git worktree (or the harness's worktree-isolated subagent). The shared tree stays frozen while a lane is in flight.
- **Stay inside the declared surface.** An executor edits only within its step's declared `**Touches:**` surface. Needing an edit outside it is a stop-and-report, not an edit — the coordinator sends that step to the serial path. The promise is enforced twice: in the prompt, and mechanically at merge time, when the coordinator checks the worktree diff against the declared surface before merging.
- **Evidence back; verdicts stay home.** The executor runs the step's `Verify` in its copy and reports what it ran, the `file:line` changes it made, the verify output, and any doc sources consulted. Executor success is provisional — the coordinator's merge gates on the integrated tree decide, and the coordinator records the sources in the result file.
- **Degrade gracefully.** A failed, hung, or surface-escaping executor sends its step to the serial path — the lane never blocks the skill. Report the fallback; don't hide it.
- **Scratch, not record.** Worktrees and executor transcripts are scratch — removed after merge. `result.md` records the merged outcome, never executor transcripts.

### Write-mode engines

- **`native`** — the host harness's worktree-isolated subagents, or its plain subagents confined to a coordinator-created `git worktree`. **The only registered write-mode engine.** Richer integration, harness-tracked completion. A host offering neither form of isolation has no write-mode engine: the lane doesn't launch, every step runs serially, and the fallback is reported — the write-mode mirror of a probe engine's `skipped (<reason>)`.

  **Executor model.** Where the host supports per-subagent model control, executors default to a pinned model below the top coordinator tiers, because executor success is provisional by contract — the merge gates re-verify every result on the integrated tree, so a weaker implementer costs at worst a serial re-execution at the gates. The gates are exactly as strong as the step's `Verify`, no stronger — an error no check covers passes at any tier. Coordinator work — the merge gates, statuses, and the acceptance gate — never moves down-tier. On Claude Code the kit installs the `executor` agent definition (`~/.claude/agents/executor.md`, pinned to Opus at `xhigh` effort; to retune, edit its frontmatter and remove the sibling `.agents-kit-executor` marker, or the next `setup.sh` run silently restores the kit copy): launch lane executors as that agent type. The pin is absolute, so its economy assumes a coordinator above it — a session already at or below the pinned tier gains nothing and may up-tier; retune downward there. Deviate when a step is genuinely hard for the cheaper tier — deep debugging, a subtle cross-cutting edit — by launching it on the session model, or running it serially. A host with no per-subagent model control, or no kit definition installed for its surface (Codex's TOML agents today), runs executors on the session model: the lane still works, minus the economy.

Cross-vendor engines are deliberately not registered for write mode: their sandbox flags enforce the *probe* promise (`--sandbox read-only`), and shipping write access cross-vendor needs its own consent and cleanup story. A future `codex` executor engine (workspace-write confined to a coordinator-managed worktree via `-C`) can be added here without touching the contract above — the merge-time surface check and the integrated re-verify are engine-independent. Until then, cross-vendor stays what it is today: the read-only `-x` cross-check.
