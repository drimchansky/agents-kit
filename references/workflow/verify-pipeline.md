# Verify Pipeline: Shared Composite Mechanics

A verify pipeline chains a base pass into a batched, probe-verified triage: findings are produced, batched by concern, verified one probe per batch, merged, then displayed with one verdict each. Contracts: `./agent-fanout.md` (probe and merge), `./probe-engines.md` (engines), `./probe-shape-verify.md` (the verify shape).

## Pipeline-wide overrides

Each phase executes its skill file in full, under three overrides:

- **Core Rules blocks:** the composite's own block covers the pipeline; inner skills do not repeat the AGENTS.md read.
- **Chat display:** findings render once, in the final Output; phases print only what their own section allows.
- **Next pointers:** inner skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

A phase departs from its skill only where the composite's own section says so.

## The review composite

`review-code-triage-verify` chains a review skill into the pipeline; `triage-findings-verify` runs no review phase.

### The tree-agreement precondition

Before the review phase, the composite's Setup confirms the live working tree carries no change its review object does not. On failure, stop, name the diverging paths, and say what they need first. The review skill run alone carries no such constraint; its verification scripts run under the divergence bar in `../engineering/review.md` § *Verification Scripts*.

### Flags through the review phase

Review-phase flags pass through to the review skill; the composite's Flags section names its suppressions. A script finding reaches the probes like any other, but they never re-run the check that produced it: a lint or type failure re-verifies by reading, and a test failure usually lands **Inconclusive**. The verify probes take no review-phase flag.

### The review phase

Execute the sibling review skill end to end against the object its Setup resolves. As a usable phase completes, print its provenance line and its **Review pass** line; hold the rest for the final Output. If a later phase fails hard, print the held sections before stopping.

**The standalone settle is suppressed.** The two intake checks still run first (`./reviewer-contract.md` § *The settle*), after § *Safety blocks* has classified any explicit safety signal. An `Identity` mismatch stops the phase: settle nothing, launch nothing, report it. A malformed return takes the review skill's **Inline fallback** with reason `reviewer failed`. An explicit safety block takes the review skill's **Blocked output**, never the inline fallback: print the blocked `Review pass:` line and stop, a completed `-x` cross-check reported only as unattached evidence. With several reviewers, the checks run per return, a failing or blocked return is dropped, and usable survivors continue on reduced coverage; the paths above apply only once no return stands.

The adopt, spot-check, and final-verdict steps do not run. The phase holds every finding the standing returns carried, pooled by location and deduped by distinct claim per `./agent-fanout.md` § *Merge contract*, with its `cited by k/N` marker where more than one reviewer ran. Forward that set with its drop record, never the first return alone; the drops land on the `Review pass:` line. The `-x` probe's verify-before-adopt step is suppressed the same way: its `Cross-check:` line is recorded and its novel candidates reach the triage phase as candidates. Each candidate takes exactly one verdict in the verify phase.

**No findings from a usable review pass** makes the triage and verify phases vacuous: skip them and render **Batches** as `none`, its Verified line reading `Verified: no findings to verify`.

### The triage phase

Execute `triage-findings` with the source pinned to the review phase's findings: no PR-comment merge, no other sources. Expect everything **open**; the classify step still applies, and anything landing outside open keeps its bucket into the final display. Print one progress line (`./user-facing-messages.md` § *Blocks*) with the zones and their counts; hold the batch detail for the final Output.

## Fan-out and probes

One probe per batch on the **native** engine, launched in parallel and announced as one progress line naming the batches in flight (`./user-facing-messages.md` § *Blocks*). Default to probing every open finding. On a large set, scoping probes to Major/Critical is fair economy; scoped-out findings take `Unverified (out of probe scope)`. Findings outside **open** are never probed and get no verdict.

Each probe prompt follows the verify shape, carrying the batch's findings verbatim, the review object, and the absolute path of the installed `verify-issue/SKILL.md`.

## Merge and degrade

Merge per the fan-out merge contract. **Not an issue** makes the finding **Withdrawn**; a confirmation leaves it **Confirmed**. Where the findings came from the session's own review, re-check the spot before accepting a **Not an issue**. On rejection, the finding takes the verdict the re-check supports: **Confirmed**, or **Inconclusive** with what is missing. Either verdict carries a note on what the probe missed. Never silently drop either way. A candidate the probe raises on its own is verified against the same review object before adoption, then enters its batch's zone with its verdict. A **Confirmed** verdict the session assigns carries the root cause and fix options from its own re-check.

**Degrade:** a failed or dead verify probe never blocks the pipeline: verify that batch inline by the same `verify-issue` protocol and mark its verdicts `verified inline (probe failed: <reason>)`. A called-off batch (the user's decision) is marked `verified inline (probe called off)`. An explicit policy refusal follows `../engineering/security.md` § *Review Validation Boundaries* instead: preserve completed evidence, do not route the refused validation through the inline fallback, and mark an affected finding **Inconclusive** when the returned evidence establishes what is missing, otherwise **Unverified** with only the exact error code and message; continue independent batches.

## Output: Batches and the Verified line

Every member's Output carries both:

- **Batches:** one section per concern zone, ordered by its most severe member. Each finding renders once as a finding entry (`./user-facing-messages.md` § *Blocks*): its canonical severity marker, a legacy prefix normalized first, then `file:line` (or the locator its own file names), the original text, then its verdict: **Confirmed** (root cause, fix options targeted → thorough), **Withdrawn** (the probe's evidence), **Inconclusive** (what's missing), or **Unverified** (the reason). A finding outside open shows its bucket in place of a verdict.
- **Review pass** and **Divergence** (`review-code-triage-verify` only): forwarded from the review phase as the review skill specs each. The `Review pass:` line is owed on either path; a `Divergence` entry other than `None` is surfaced, never dropped.
- **Verified:** one mandatory line: `Verified: <n> confirmed · <n> withdrawn · <n> inconclusive · <n> unverified — <k> native probes`. ` · <n> triaged out` joins the counts only when triage landed findings outside open; `, <m> inline fallbacks` joins the probe count only when a batch was verified inline.

## Reading Batches downstream

A skill consuming a member's **Batches** reads each entry with its verdict or bucket, and assigns neither anew. A **Withdrawn** entry is settled: no consumer treats it as open, edits for it, or publishes it. An entry showing a triage bucket in place of a verdict keeps that bucket. Each consumer's own section decides which verdicts it acts on.

## Shared checklist

The invariants above are every member's checklist: each phase from its skill file, one render and one verdict or bucket per finding, the mandatory **Verified** line, read-only probes carrying findings verbatim, nothing written to any source, the standalone settle suppressed.
