# Agent Fan-Out: Probes, Executors, and Engines

How a skill delegates work to other agents, in two modes: **probes** — self-contained read-only questions whose answers come back as text evidence — and **executors** — write-mode subagents that each carry out one coordinator-supplied unit of work for a registered write-mode consumer. **This file is the single source of truth for probe behavior and engine commands, plus the registry and routing of native write-mode executors.** The review skills (`review-task`, `review-pr`, `review-commit`, `review-docs`) cite it from their `-x` flag; the three write-mode consumers registered below — `implement-task`, `implement`, and `fix-findings` — cite its write-mode section for their routing and batch mechanics; the `review-pr-triage-verify`, `review-commit-triage-verify`, and `triage-findings-verify` composites cite it for their per-batch verify probes; `maintain` cites the probe contract for its Phase 5 session deep-reads (native engine only, per its own privacy binding); `CORE_RULES.md`'s parallel-agents rule points here for mechanics. Write-mode executor behavior lives in `./executor-contract.md`; change that behavior there, and change only engine recipes, adapter defaults, routing, or the coordinator-side batch mechanics here.

## What a probe is

A **probe** is one self-contained, read-only question posed to a separate agent, whose answer comes back as text evidence. Its defining property is **independence**: the probe sees only what its prompt carries — no session context, no accumulated assumptions, no stake in the answer. That isolation is a feature, not a limitation; it's what makes a probe worth consulting where the session's own read might be biased (grounding a plan it helped write, reviewing a diff whose intent it has already internalized).

## Probe contract (every engine)

- **Self-contained prompt.** Paste in everything the probe must judge — the claims under check, the diff scope or doc paths, absolute paths to the artifacts. Never assume the probe can see the session.
- **One concern per probe.** A claim *list* for one check is one probe (one prompt, one merged answer) — don't fan a per-claim probe swarm when a batched prompt does the job.
- **Read-only, promised always, enforced where the engine can.** Probes verify by reading — files, diffs, docs — never by mutating, and never by running the project's build or suite (a probe stays analysis-only even where its invoking review runs verification scripts itself). Never pass an engine's sandbox-bypass flags. Enforcement varies by engine — see the registry; the promise does not.
- **Demand cited verdicts.** The prompt must require verdicts or findings with `file:line` evidence. An uncited probe answer is an opinion, not evidence.
- **Evidence, not authority.** A probe's answer is weighed, spot-checked where surprising, and can force re-verification — but it never assigns a verdict or overrides the session's own pass. The invoking skill owns its verdicts.
- **Degrade gracefully.** A missing engine, a failed login, or a hung probe is reported (`Cross-check: skipped (<reason>)`) and the skill proceeds on its own pass. A probe never blocks a skill.
- **Content leaves the machine.** A probe ships its prompt to the engine's vendor. Run a cross-vendor probe only on work the user already uses that vendor's CLI on; when in doubt, ask first.
- **Scratch, not record.** Probe output lands in the host's scratch/temp area — never in the task folder; result files record the *merged outcome*, not probe transcripts.

## Engine registry

- **`native`** — the host harness's own subagents (Claude Code's agent tool; Codex's multi-agent). **Default for all fan-out** except the opt-in `-x` cross-check below: bulk exploration, parallel searches, reference refresh. Richer integration, no process overhead. **No engine-side read-only enforcement**: the cross-vendor engines seal the promise with a sandbox flag, but a native subagent inherits the session's tools, so here it is prompt-borne — always state it, and launch on the most restricted agent type whose reading discipline still fits the probe's shape (on Claude Code, `Explore` and `Plan` drop `Edit`/`Write`/`NotebookEdit`, though both keep Bash; `Explore` reads excerpts rather than whole files, which suits a search probe and starves a verify-shape one). A native probe is trusted, not confined.
- **`codex`** — OpenAI Codex CLI, headless. The cross-vendor engine when the host is Claude Code. Requires `codex` on PATH and an active login — `command -v codex` checks presence; a failed login surfaces at run time and degrades to `skipped`.

  ```bash
  codex exec --ephemeral --sandbox read-only --skip-git-repo-check \
    -C <working-root> -o <scratch>/probe.md - < <scratch>/probe-prompt.md
  ```

  The prompt goes in on stdin, never as a command-line argument: the invoking agent writes the filled skeleton (findings verbatim) to `<scratch>/probe-prompt.md` with its file tool, and the trailing `-` makes `codex exec` read it from stdin — so a `$`, backtick, or apostrophe in a finding is data, not shell syntax to expand or execute (`<scratch>` is an absolute path). `--sandbox read-only` is the engine-side enforcement of the read-only promise; `-o` captures just the final message for merging; `--ephemeral` leaves no session files. Parallel probes are plain shell jobs (`&` + `wait`), one prompt file and one `-o` file each. Budget 1–5 minutes per probe at high reasoning — launch early, run in the background where the host supports it, and collect at the merge point.

- **`claude`** — Claude Code, headless. The cross-vendor engine when the host is Codex — the mirror of the above:

  ```bash
  cd <working-root> && claude -p --permission-mode plan \
    --no-session-persistence < <scratch>/probe-prompt.md > <scratch>/probe.md
  ```

  The leading `cd` pins the working root (`claude` has no `-C` equivalent); `--no-session-persistence` is the mirror of `--ephemeral` — no session files left behind. Prompt passing mirrors codex — the same `<scratch>/probe-prompt.md` fed on stdin (both `<scratch>` paths are absolute, since the `cd` changes directory), so untrusted finding text never reaches the shell as syntax.

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

For the cold-review shape (`review-pr`, `review-commit`), replace the numbered items with the review object — "review the diff `<base>...HEAD`" / "review the staged diff (`git diff --cached`)" — and demand findings, each with a severity, `file:line`, and the concrete failure it causes.

For the verify shape (the `review-pr-triage-verify` / `review-commit-triage-verify` / `triage-findings-verify` composites' per-batch probes):

```
You are an independent verifier with no prior context. Working root: <absolute repo path>.
Read <absolute path to the installed verify-issue/SKILL.md> and apply its protocol
from "## Multiple Findings" onward — skip the Core Rules and intro above it. You verify
and report only: never edit anything, and never run the project's build, typecheck,
or tests — verify by reading (analysis-only); where the protocol suggests running a
command, reason statically instead.

The findings came from a review of <the staged diff (git diff --cached) | the diff
<base>...HEAD | the PR's diff (gh pr diff <number>)>. Read that diff first — it is what changed. A finding about the change
itself (something added, dropped, or missing from it) cannot be judged from current
file contents alone, and a staged change is absent from git log entirely, so the
protocol's recent-changes step will not surface it.

Treat each finding below as a separate verification target (its Multiple Findings
rule). For each: a verdict — Confirmed / Not an issue / Inconclusive — with
file:line evidence, root cause when confirmed, and fix options ordered
targeted → thorough.

Findings (verbatim, with severity and location when present):
1. <finding text — severity, file:line, recommendation, exactly as reviewed>
2. …
```

The findings go in verbatim — a summarized finding verifies a different claim. So does
the diff line, this shape's review object and the counterpart of the cold-review shape's:
hand it whenever the findings came from a change — a staged diff, a branch diff, or a PR's
diff (`gh pr diff`) — since a probe that isn't handed it then verifies a snapshot rather
than a change. When the findings are standalone instead — a saved or pasted list with no
associated change, as `triage-findings-verify` can resolve — drop that paragraph: there is
no diff, and the probe verifies each finding as a claim against current code, exactly what
`verify-issue`'s single-issue mode does. A diff that doesn't correspond to the findings is
worse than none.

## Merge contract

The invoking skill compares the probe's answer against its own pass:

- **Agreement** strengthens the evidence — cite it and move on.
- **Contradiction is never silently dropped.** Where the probe contradicts the session's grounding or the artifact's own claims, re-check that spot before assigning the verdict; a confirmed contradiction becomes a finding (in `review-task`, a `CONTRADICTED` claim is evidence toward `conflicts with what exists` / `infeasible as stated`; a `NOT FOUND` on a load-bearing reference is a gap).
- **Novel probe findings are candidates, not findings.** Verify each against the artifact before adopting it into the output — under the session's own severity calibration; never paste a probe finding unverified.
- **The outcome line closes the loop.** For the `-x` shapes, the `Cross-check:` line states `clean`, `merged: …`, or `skipped (<reason>)` — the record makes a skipped or empty probe visible instead of leaving absence ambiguous. The verify shape closes on its consuming skill's mandatory **Verified** line instead, which carries the same guarantee for the same reason; `Cross-check:` stays reserved for the `-x` pass, so a composite running both keeps two distinct records.

## Write-mode routing

Write-mode fan-out is limited to the consumers registered here. `./executor-contract.md` governs executor behavior; each consumer's own skill owns how it frames a unit of work and what verdicts it reaches. Every other fan-out consumer uses the probe contract above.

**The registry.** Three consumers launch write-mode executors, each with its own posture:

- **`implement-task`** — unit: one plan step. **Delegate by default**: one serial executor per step, with an inline fallback when delegation clearly doesn't pay. This is the proven posture the other two are calibrated against.
- **`implement`** — unit: one framed item. Default **inline** because this skill's units are small and assembling a self-contained packet costs more than making the edit; delegate when the remaining run is multi-unit *and* the unit's packet is self-contained — no mid-unit user interaction expected.
- **`fix-findings`** — unit: one Confirmed finding's fix application. Same inline default and same delegation trigger, scoped to **Confirmed auto-path fixes**: ask-routed fixes stay with the coordinator, which already authored the approved diff, and Withdrawn or Inconclusive findings are never edited at all.

Delegation by a conditional-posture consumer is **announced in chat and recorded in that skill's report** — that record is what keeps the default from drifting silently into always- or never-delegate. The exact record shape is each skill's own.

**Judgment never delegates**, under any posture. The coordinator keeps unit framing, both verify gates — re-run on its own tree, since executor output is advance evidence and never the gate — the report buckets, and every status.

### Coordinator-side parallel batch

This is the single home for the mechanics of running units concurrently. It is written in terms of *units* and *the consumer's declared unit order*, so every registered consumer cites it and none restates it.

**Eligibility — all conditions required.** Two units may share a batch only when:

- no dependency path connects them, directly or transitively;
- each declares an edit surface and the declared sets are pairwise disjoint — the core rule "do not parallelize sequential edits to the same artifact" (`CORE_RULES.md`), made checkable;
- each unit's verify can run in an isolated copy.

A unit with no declared surface (or a surface of `none`) runs serially — an absent declaration is a serial default, not an invitation to infer one. When in doubt about disjointness, run the doubtful unit serially: a wrongly-serial unit costs minutes, a wrongly-parallel one costs the merge. Each consumer adds its own eligibility bounds on top — `implement-task`'s checkpoint-bounded batches and `**Touches:**` lines, for instance — and those stay in that skill.

**Run.** Launch one executor per eligible unit, each with a self-contained launch packet per `./executor-contract.md`, through the native adapter and defaults in the engine registry below. Each executor's effective root is its own **coordinator-managed worktree**, seeded to the **batch baseline** — the shared tree's state at launch, uncommitted work included (staged, unstaged, and untracked), since a worktree created bare from a commit hands the executor stale code; executors never create, switch, or seed worktrees themselves. A unit's **change set** is everything in its worktree that differs from that baseline — every path whose content, presence, or absence differs from the seed, tracked or not — and is what the merge gates below operate on. While a batch is in flight the **shared tree is frozen**: the coordinator monitors and runs no unit of its own.

**Merge — in the consumer's declared unit order.** Each binding in `./executor-contract.md` names its consumer's order (plan order, frame order, severity order). Per unit, in that order:

1. **Surface check** — confirm the unit's change set — new files included — stays inside that unit's declared surface. A violation is the contract's surface-escape case: discard that worktree and re-execute the unit serially.
2. **Merge** the unit's change set into the shared tree — apply its modifications, copy its new files, and mirror its deletions; never commit in a worktree or merge branches to do it, since Git state is not mutated unless explicitly asked. A conflict means the disjointness claim was wrong: discard that worktree and re-execute the unit serially on the integrated tree. Never resolve a batch conflict by hand-editing inside a worktree.
3. **Re-verify on the integrated tree** — the unit's verify criterion plus health verify, the same two gates as serial execution. Executor-reported success is provisional; these gates are the ones that count.
4. **Record** — per the consumer's own record binding (`./execution-loop.md`), exactly as in serial execution.

Remove every batch worktree before continuing — merged ones, those discarded on a surface escape or merge conflict, and those abandoned by a failed or hung executor. Coordinator-managed worktrees sit inside the Git-discipline rule, not against it: they are transient scratch — created for the batch with nothing committed and no branch made, merged by diff-apply, removed — not the Git-state mutation the consumers' invariants forbid.

*Where* in a run a batch merges is the consumer's business, not this file's — `implement-task` merges at the batch's bounding checkpoint, and that rule stays in that skill.

### Write-mode engine registry

- **`native`** — the only registered write-mode engine: Claude Code's native subagents on Claude, and Codex multi-agent on Codex. The coordinator launches the named `executor` adapter on both hosts and supplies its effective root: the shared tree for serial delegation or a coordinator-managed worktree for a parallel batch. The adapter then loads its installed copy of `./executor-contract.md`.

  **Adapter defaults.** Claude installs `~/.claude/agents/executor.md`, pinned to `claude-opus-5` at `xhigh` and inheriting the parent permission mode. Codex installs `~/.codex/agents/executor.toml`, pinned to `gpt-5.6-terra` at `xhigh` with `sandbox_mode = "workspace-write"`. These kit-owned defaults select the native model and effort; Codex additionally requests write capability, while the live parent sandbox, approval setting, or managed security policy remains authoritative. The full model pins preserve a stable tier relationship instead of floating with provider aliases; on a host where a pin does not resolve or the current coordinator is already at or below it, retune the installed definition and remove its sibling `.agents-kit-executor` marker, or the next `setup.sh` run restores the kit copy.

  **Degradation.** If the named adapter, its configured model, or native subagent support is unavailable, report the failure. The coordinator-owned fallback in `./executor-contract.md` applies unchanged and symmetrically on either host; adapter availability never changes placement or scope.

The `codex` and `claude` CLI entries in the probe registry above remain cross-vendor, read-only probe engines only. They are not registered for write mode.
