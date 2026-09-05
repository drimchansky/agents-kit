# Verify Pipeline: Shared Composite Mechanics

A **verify pipeline** chains a base pass into a batched, probe-verified triage: findings are produced, batched by concern, verified one probe per batch, merged, then displayed with one verdict each. **This file is the single source of truth for the mechanics its composites share** — the sections below are the whole of them. Each member's own file keeps only what differs: its phases, its preconditions and drift re-checks, its source or review object, and the rest of its Output. This file sits above the contracts those files cite and restates none of them: the probe contract and the merge contract in `./agent-fanout.md`, engines in `./probe-engines.md`, the verify shape in `./probe-shape-verify.md`. The bare names below resolve to those three.

## Pipeline-wide overrides

Each phase executes its skill file — read the sibling `SKILL.md` and run its full protocol. Three overrides apply pipeline-wide, to every phase:

- **Core Rules blocks** — the composite's own block covers the pipeline; inner skills' AGENTS.md read is already satisfied and doesn't repeat.
- **Chat display** — findings render once, in the final Output; phases print only what their own section allows.
- **Next pointers** — inner skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where the composite's own section says so — never by improvisation.

## The review composite

`review-pr-triage-verify` chains a review skill into the pipeline, and this section is the home of everything that follows from it: its own file restates none of this, keeping only its review object, the drift re-check that guards it, and the flags its review skill takes. `triage-findings-verify` runs no review phase and takes none of it.

### The tree-agreement precondition

`review-pr-triage-verify`'s Setup confirms, before the review phase, that the live working tree carries no change its review object does not — what exactly is compared being the composite's own. This is a **precondition, not a drift check**: it can be false from the first moment. Catching it in Setup costs nothing; catching it at the verify phase would waste the whole review. Fails → stop, name the diverging paths, and say what they need first. Passing there is also what makes the verify phase's re-run a genuine drift check.

The review skill run alone carries no such constraint — its verification scripts run over the tree under the divergence bar in `../engineering/review.md` § *Verification Scripts*, which bounds a diverging path's evidence rather than refusing the run. This precondition belongs to the verify phase, so it binds only the composite.

### Flags through the review phase

Review-phase flags pass through to the review skill, the composite's Flags section naming the suppressions its own phases impose. Two consequences follow. The review phase runs its verification scripts as that skill specifies (always): the reviewer runs them on a delegated pass, the session on the inline fallback. A script finding then reaches the probes like any other — but they never re-run the check that produced it: a lint or type failure re-verifies by reading; a test failure usually can't, and lands **Inconclusive**. The per-batch verify probes take no review-phase flag: they run on the native engine regardless.

### The review phase

Execute the sibling review skill end to end against the object its Setup resolves. Its **Review pass** runs delegated — that skill's **Launch** spawns the `reviewer` subagent — and drops to the session only where its **Inline fallback** says. As the phase completes, print its provenance line and its **Review pass** line; hold the findings and the remaining sections for the final Output. If a later phase fails hard, print the held sections before stopping — the review is never lost to a dead pipeline.

**The standalone settle is suppressed.** The contract's two intake checks still run first (`./reviewer-contract.md` § *The settle*): an `Identity` mismatch stops the phase — settle nothing, launch nothing, report the mismatch as the review skill's **Settle** says; a malformed return (intake check 2: an absent heading, or `None` under a heading it names never-empty) does not stop it, taking that skill's **Inline fallback** with reason `reviewer failed`, the phase continuing on that inline pass so its `Review pass:` line reads `inline (reviewer failed)`. The adopt, spot-check, and final-verdict steps do not run: every finding the reviewer returned, cited or not, is held as a candidate at the severity and `file:line` the reviewer gave it and reaches the triage phase verbatim, so the verify phase gives each exactly one verdict instead of paying twice for the same one. The `-x` probe is collected in this phase and its `Cross-check:` line recorded, but the merge contract's verify-before-adopt step is suppressed the same way: its novel candidates are held beside the reviewer's at the severity and `file:line` the probe gave them and reach the triage phase as candidates, so the verify phase gives each exactly one verdict rather than one here and another there. The `Cross-check:` line reports what the probe added or contested — a contest named with the candidate it bears on; how each settled is the Verified line's.

**No findings** → the triage and verify phases are vacuous: skip them and render the Output without **Batches**, its Verified line reading `Verified: no findings to verify`.

### The triage phase

Execute the `triage-findings` skill with the source pinned to the review phase's findings — no PR-comment merge, no other sources; a merged triage is the manual chain's job. Expect everything **open** (the code hasn't changed since the review); the classify step still applies, and anything landing outside open keeps its bucket into the final display. Print one progress line — the concern zones and their counts — and hold the batch detail for the final Output.

## Fan-out and probes

Every member is a registered consumer of the three contracts named above, and fans out under them. One probe per batch on the **native** engine, launched in parallel — a zone's findings share one investigation context; merging two small zones into one probe is fine when their concerns overlap. Default to probing every open finding, because a wrong minor finding still costs the author time; on a large set, scoping probes to Major/Critical is fair economy — scoped-out findings take the verdict `Unverified (out of probe scope)`. Findings triage left outside **open** are never probed: they keep their bucket into the Output and get no verdict.

Each probe prompt follows the verify shape: self-contained, carrying the batch's findings verbatim, the review object the composite resolves, and the absolute path of the installed `verify-issue/SKILL.md` for the probe to apply. Without the review object a probe judges a finding about a change — a dropped guard, a regressed default — against current contents that look correct in isolation.

## Merge and degrade

Merge per the fan-out merge contract. **Not an issue** makes the finding **Withdrawn**, displayed with the probe's evidence; a confirmation leaves it **Confirmed**, with root cause and fix options ordered targeted → thorough. Where the findings came from the session's own review, a **Not an issue** contradicts that pass — re-check the spot before accepting it, and on rejection the finding stands with a note on what the probe missed. Never silently drop either way. A candidate the probe raises on its own — `verify-issue`'s scope step routinely turns up the same pattern elsewhere — is verified against the same review object before adoption, as that contract requires, then enters its batch's zone as an open finding, verdict and all, so **Batches** and the **Verified** count carry it like any other.

**Degrade**: a probe that has failed or died never blocks the pipeline — verify that batch inline by the same `verify-issue` protocol and mark its verdicts `verified inline (probe failed: <reason>)`. Slowness alone is not failure, and calling a stalled probe off is the user's decision, both per the probe contract; a called-off batch verifies inline the same way, marked `verified inline (probe called off)`. Inline verdicts lose the cold-eyes property; the mark keeps that visible.

## Output: Batches and the Verified line

Every member's Output carries both, placed among its own sections:

- **Batches** — the triage frame: one section per concern zone, ordered by its most severe member. Each finding renders once: original text with its severity prefix, then `file:line` (or, with no anchor, the locator its own file names), then its verdict: **Confirmed** (root cause, plus fix options targeted → thorough), **Withdrawn** (the probe's evidence), **Inconclusive** (what's missing), or **Unverified** (reason: probe and fallback failed, or out of probe scope). A finding triage landed outside open shows that bucket in place of a verdict.
- **Review pass** and **Divergence** (`review-pr-triage-verify` only) — forwarded from the review phase exactly as the review skill specs each. The `Review pass:` line is owed on either path — a pipeline output that dropped it would read like a delegated pass whatever ran. `Divergence` reads `None` when the tree carried the object, and any non-`None` entry is an anomaly Setup's precondition should have prevented — surfaced, never dropped.
- **Verified** — one mandatory line: `Verified: <n> confirmed · <n> withdrawn · <n> inconclusive · <n> unverified — <k> native probes`. Two segments are conditional: ` · <n> triaged out` joins the counts only when triage landed findings outside open — the **verify** and **addressed** buckets both, since neither got a verdict here — and `, <m> inline fallbacks` joins the probe count only when a batch was verified inline (probe failed or called off). Mandatory so a skipped or failed verify phase is visible rather than ambiguous.

## Shared checklist

Every member confirms these, alongside the items its own file adds:

- [ ] Each phase ran from its skill file, probes on `verify-issue` — none improvised from memory
- [ ] Every finding renders exactly once in **Batches** — open ones with exactly one verdict, non-open ones with their triage bucket; none dropped, Withdrawn ones included with evidence
- [ ] Every probed batch covered by a probe (merged small zones count) or a flagged inline fallback; prompts carried the findings verbatim; probes read-only per the fan-out contract
- [ ] The Output carries the mandatory **Verified** line
- [ ] Nothing edited and nothing written to any source — the pipeline-wide read-only guarantee held
- [ ] (`review-pr-triage-verify` only) The review phase suppressed the standalone settle — no finding the reviewer or the `-x` probe returned was settled or verified there — and every one of them got exactly one verdict in the verify phase, or its triage bucket
