# Probe Engines and Prompt Shapes

The engine registry, the `-x` cross-check contract, and the probe prompt skeletons — split out of `./agent-fanout.md`, which keeps the probe contract, the merge contract, and write-mode routing. Read this file when launching a probe, assembling its prompt, or running a `-x` cross-check.

## Engine registry

- **`native`** — the host harness's own subagents (Claude Code's agent tool; Codex's multi-agent). **Default for all fan-out** except the opt-in `-x` cross-check below: bulk exploration, parallel searches, reference refresh. Richer integration, no process overhead. **No engine-side read-only enforcement**: the cross-vendor engines seal the promise with a sandbox flag, but a native subagent inherits the session's tools, so here it is prompt-borne — always state it, and launch on the most restricted agent type whose reading discipline still fits the probe's shape (on Claude Code, `Explore` and `Plan` drop `Edit`/`Write`/`NotebookEdit`, though both keep Bash; `Explore` reads excerpts rather than whole files, which suits a search probe and starves a verify-shape one). A native probe is trusted, not confined.
- **`codex`** — OpenAI Codex CLI, headless. The cross-vendor engine when the host is Claude Code. Requires `codex` on PATH and an active login — `command -v codex` checks presence; a failed login surfaces at run time and degrades to `skipped`.

  ```bash
  codex exec --ephemeral --sandbox read-only --skip-git-repo-check \
    -C <working-root> -o <scratch>/probe.md - < <scratch>/probe-prompt.md
  ```

  The prompt goes in on stdin, never as a command-line argument: the invoking agent writes the filled skeleton (findings verbatim) to `<scratch>/probe-prompt.md` with its file tool, and the trailing `-` makes `codex exec` read it from stdin — so a `$`, backtick, or apostrophe in a finding is data, not shell syntax to expand or execute (`<scratch>` is an absolute path). `--sandbox read-only` is the engine-side enforcement of the read-only promise; `-o` captures just the final message for merging; `--ephemeral` leaves no session files. Parallel probes are plain shell jobs (`&` + `wait`), one prompt file and one `-o` file each. A probe has no fixed time budget — a high-reasoning run takes as long as it takes. Launch early, run in the background where the host supports it, and report the probe's status in chat at a regular cadence while it runs — a brief launched / still running / collected line at each check-in — so a long probe reads as visible progress rather than silence; collect at the merge point, and reserve `skipped` for real failure (missing engine, failed login, dead process) or the user calling a stalled probe off — never the skill's own timeout.

- **`claude`** — Claude Code, headless. The cross-vendor engine when the host is Codex — the mirror of the above:

  ```bash
  cd <working-root> && claude -p --permission-mode plan \
    --no-session-persistence < <scratch>/probe-prompt.md > <scratch>/probe.md
  ```

  The leading `cd` pins the working root (`claude` has no `-C` equivalent); `--no-session-persistence` is the mirror of `--ephemeral` — no session files left behind. Prompt passing mirrors codex — the same `<scratch>/probe-prompt.md` fed on stdin (both `<scratch>` paths are absolute, since the `cd` changes directory), so untrusted finding text never reaches the shell as syntax.

## The `-x` cross-check (review skills, opt-in)

The review skills accept a `-x` flag: run one probe on the **cross-vendor engine** — the engine from the other vendor than the host harness (host Claude Code → `codex`; host Codex → `claude`) — as an independent second pass over the skill's own object. **Off by default**: without the flag, no probe runs and no cross-check line appears. The second pass is worth the cross-vendor hop because a different model family is maximally uncorrelated with the session's blind spots; everything else stays `native`: exploration fan-out, multi-area searches, drift scans, and URL refresh need no flag at all, and `-p`'s lens fleet is opt-in for its cost, not for an engine.

What the probe checks, per skill:

- **`review-task`** — independent grounding: the plan's reality claims (integration points, "reuse X" assumptions, referenced files/symbols/APIs), verdict per claim.
- **`review-pr`** — a cold second review of the branch diff against its base, findings with severity.
- **`review-commit`** — a cold second review of the staged diff, findings with severity.
- **`review-docs`** — independent grounding of the doc's verifiable claims against the artifacts they describe, verdict per claim.

Shared mechanics, every `-x` run:

- **Launch early, merge late.** Start the probe in the background as soon as its input is ready (the claims list, the diff scope); do the inline pass while it runs; collect and merge per `./agent-fanout.md` § *Merge contract* before verdicts or findings are finalized. The probe supplements the session's pass, never replaces it. No time cap bounds the wait: a probe still running when the inline pass finishes is waited on, its status reported at a regular cadence per the engine registry — the visible wait is what lets the user call a stalled probe off instead of a timeout deciding for them.
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

For the lens-review shape (`review-pr`'s opt-in `-p`), run a fleet of cold reviews of the same diff on `native` — one probe per lens, launched in parallel, no cross-vendor hop, since `-x` remains the uncorrelated-model pass and composes independently. One lens per probe *is* the one-concern rule, not a swarm: the lenses are different concerns, not slices of one. Each prompt is the cold-review shape's plus one lens — the absolute path of one per-surface checklist under `../engineering/` (`security.md`, `testing.md`, …), which the probe reads itself and applies to the diff to the exclusion of every other concern, or, for a derived correctness angle, that angle named in the prompt with no checklist path. Hand the path, never the checklist's text: inlining bloats every prompt and forks the checklist. The set derives from the change map and is additive: the per-surface checklists the diff's domains trigger, the same trigger `../engineering/review.md:5` states, plus one probe per correctness angle the diff presents. An angle is a distinct way this change could be wrong — what it claims against what it does, the error and edge paths it opens, the state or ordering it now depends on, the callers its blast radius reaches — a handful at most, derived live from what the change map shows rather than from a fixed catalogue, never a slice of the diff per file or per hunk, and two candidates that would read the same code for the same kind of failure are one angle. The first two named hold of any change, so they are the floor rather than examples, and a diff triggering no per-surface checklist still fans out more than one correctness probe. Past the large-diff bar `review-pr` states (~1000 non-generated lines), a probe's prompt scopes its review object to the file groups its own concern touches instead of the whole diff.

A lens probe's findings come back with severity and `file:line` like any cold review, and merge under `./agent-fanout.md` § *Merge contract* — each one a candidate the session verifies against the diff before adopting it. After the whole fleet has landed and its findings have merged into that candidate list, one further probe runs — the gap sweep: always exactly one, on `native`, and not a lens, since its only concern is what the fleet missed. Seed it with the merged candidate list and scope it to findings that list does not already contain, so it decorrelates a single correlated pass rather than re-reviewing the diff; what it returns merges as candidates like any probe's. The record is one `Lens probes:` line naming each lens and its outcome — merged findings, clean, or failed/skipped with the reason — and the sweep's outcome alongside them, `clean` when it turned up nothing rather than dropped from the line for an empty result; then any candidate a group's settling left Inconclusive, named by its location group with what the settling could not establish. Mandatory whenever the flag is passed and absent without it. `Cross-check:` belongs to the `-x` pass, so a `-x -p` run carries both lines.

For the verify shape (the `review-pr-triage-verify` / `review-commit-triage-verify` / `triage-findings-verify` composites' per-batch probes, and the lens-review shape's per-pooled-group candidate settling per `./agent-fanout.md` § *Merge contract*):

```
You are an independent verifier with no prior context. Working root: <absolute repo path>.
Read <absolute path to the installed verify-issue/SKILL.md> and apply its protocol
from "## Multiple Findings" onward — skip the Core Rules and intro above it. You verify
and report only: never edit anything, and never run the project's build, typecheck,
or tests — verify by reading (analysis-only); where the protocol suggests running a
command, reason statically instead.
Where that protocol and the answer shape below differ on what to report, the shape
below governs — it is the whole output, so the protocol's own report headings
(Severity, Scope, Misunderstanding, Suggestion, What was checked, Best guess) do
not appear in your answer, and its per-option Tradeoffs field appears only where a
tradeoff decides between two of the options. Its scope step still runs: investigate
the same pattern elsewhere exactly as it says, and report what that turns up in
the form below.

The findings came from a review of <the staged diff (git diff --cached) | the diff
<base>...HEAD | the PR's diff (gh pr diff <number>)>. Read that diff first — it is what changed. A finding about the change
itself (something added, dropped, or missing from it) cannot be judged from current
file contents alone, and a staged change is absent from git log entirely, so the
protocol's recent-changes step will not surface it.

Treat each finding below as a separate verification target (its Multiple Findings
rule). Answer per finding with its number and a verdict — Confirmed / Not an issue
/ Inconclusive — and nothing beyond what that verdict needs: Confirmed carries
file:line evidence, the root cause, the path that reaches it, and fix options
ordered targeted → thorough each naming its blast radius; Not an issue carries the
file:line evidence that settles it; Inconclusive carries what is missing to settle
it.

Send back no prose this prompt already carries. Do not restate or summarize a
finding below, and do not repeat or re-rank its severity — a file:line is
evidence rather than prose, and is cited freely even where the finding names the
same anchor, as is a fix option that matches the finding's own recommendation. Do
not quote the source under review — code, prose, or diff hunk alike — beyond a
single line, and quote even that only where the line is itself the evidence for a
Not an issue verdict. Report scope as bare file:line references rather than prose;
a pattern you turn up elsewhere is not a finding below, so state it in one
sentence with its own file:line.

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
The *answer* is bounded for the mirror reason: the coordinator already holds the
findings and their severities, so restating them spends merge context on what it
sent in, and the severity calibration a re-rank would displace is the session's
own (`./agent-fanout.md` § *Merge contract*).

For the re-derivation shape (`challenge-task`'s cold derivation, on `native`), the probe is handed a task's *inputs* and asked to derive an approach. It is the one shape defined by what it withholds: every other shape hands the probe the artifact under judgment, and this one must not.

```
You are an independent planner with no prior context. Working root: <absolute path>.
Below are the problem a piece of work exists to solve and the goals it must meet.
Derive the simplest approach that meets every goal — its shape and the steps it takes.

Ground the derivation in the codebase: explore the working root and design against what
is there, not against what a greenfield project would allow. Cite the files your design
turns on as file:line.

You derive and report only: never edit anything, and never run the project's build,
typecheck, or tests — ground the derivation by reading (analysis-only).

Read no file in the task folder at <absolute task-folder path> — not its plan, not its
context, not its result. Everything you are given is below, and an approach taken from
what someone already wrote there is not an independent derivation.

Begin your answer by restating the inputs you were given, then give the derivation.

Problem Statement:
<verbatim>

Ticket (when the task has one):
<verbatim>

Goals:
<goals.md, verbatim>
```

Every input travels inline and verbatim — the Problem Statement, `ticket.md` when present, `goals.md` — and nothing else from the folder does: no `plan.md` content, no Recommended Direction, no paraphrase of either. Plan-blindness is a promise no engine enforces (a read-only sandbox stops writes, not reads), which is why the instruction withholds the whole folder rather than the plan alone, and why the restate-your-inputs opener is part of the shape: it makes a peek visible in the answer. A probe that read the plan and then agrees with it reads as corroboration, and that is the worst failure this shape has. The withholding holds only while the inputs themselves are direction-free — a Problem Statement, ticket, or goals file that records the chosen direction hands it over verbatim, and the invoking skill skips the probe rather than merging a corroboration that proves nothing. The answer merges under `./agent-fanout.md` § *Merge contract* — each divergence from the withheld artifact is a candidate the invoking skill tests against its own bar before printing — and closes on that skill's own mandatory outcome line.
