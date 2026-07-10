# Agent Fan-Out: Probes and Engines

How a skill delegates read-only questions to other agents — the probe contract, the engine registry, and the opt-in `-x` cross-check. **This file is the single source of truth for cross-agent fan-out.** The review skills (`review-task`, `review-pr`, `review-commit`, `review-docs`) cite it from their `-x` flag; `CORE_RULES.md`'s parallel-agents rule points here for mechanics. When an engine recipe or the `-x` contract changes, update it here first and propagate to the skills that cite it.

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
