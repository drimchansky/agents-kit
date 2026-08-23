# Verify Pipeline: Shared Composite Mechanics

A **verify pipeline** chains a base pass into a batched, probe-verified triage: findings are produced, batched by concern, verified one probe per batch, merged, then displayed with one verdict each. **This file is the single source of truth for the mechanics its composites share** — the sections below are the whole of them. Each member's own file keeps only what differs: its phases, its preconditions and drift re-checks, its source or review object, and the rest of its Output. This file sits above the contracts those files cite and restates none of them: the probe contract and the merge contract in `./agent-fanout.md`, engines in `./probe-engines.md`, the verify shape in `./probe-shape-verify.md`. The bare names below resolve to those three.

## Pipeline-wide overrides

Each phase executes its skill file — read the sibling `SKILL.md` and run its full protocol. Three overrides apply pipeline-wide, to every phase:

- **Core Rules blocks** — the composite's own block covers the pipeline; inner skills' AGENTS.md read is already satisfied and doesn't repeat.
- **Chat display** — findings render once, in the final Output; phases print only what their own section allows.
- **Next pointers** — inner skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where the composite's own section says so — never by improvisation.

## Fan-out and probes

One probe per batch on the **native** engine, launched in parallel — a zone's findings share one investigation context; merging two small zones into one probe is fine when their concerns overlap. Default to probing every open finding, because a wrong minor finding still costs the author time; on a large set, scoping probes to Major/Critical is fair economy — scoped-out findings take the verdict `Unverified (out of probe scope)`. Findings triage left outside **open** are never probed: they keep their bucket into the Output and get no verdict.

Each probe prompt follows the verify shape: self-contained, carrying the batch's findings verbatim, the review object the composite resolves, and the absolute path of the installed `verify-issue/SKILL.md` for the probe to apply. Without the review object a probe judges a finding about a change — a dropped guard, a regressed default — against current contents that look correct in isolation.

## Merge and degrade

Merge per the fan-out merge contract. **Not an issue** makes the finding **Withdrawn**, displayed with the probe's evidence; a confirmation leaves it **Confirmed**, with root cause and fix options ordered targeted → thorough. Where the findings came from the session's own review, a **Not an issue** contradicts that pass — re-check the spot before accepting it, and on rejection the finding stands with a note on what the probe missed. Never silently drop either way. A candidate the probe raises on its own — `verify-issue`'s scope step routinely turns up the same pattern elsewhere — is verified against the same review object before adoption, as that contract requires, then enters its batch's zone as an open finding, verdict and all, so **Batches** and the **Verified** count carry it like any other.

**Degrade**: a probe that has failed or died never blocks the pipeline — verify that batch inline by the same `verify-issue` protocol and mark its verdicts `verified inline (probe failed: <reason>)`. Slowness alone is not failure, and calling a stalled probe off is the user's decision, both per the probe contract; a called-off batch verifies inline the same way, marked `verified inline (probe called off)`. Inline verdicts lose the cold-eyes property; the mark keeps that visible.

## Output: Batches and the Verified line

Every member's Output carries both, placed among its own sections:

- **Batches** — the triage frame: one section per concern zone, ordered by its most severe member. Each finding renders once: original text with its severity prefix, then `file:line` (or, with no anchor, the locator its own file names), then its verdict: **Confirmed** (root cause, plus fix options targeted → thorough), **Withdrawn** (the probe's evidence), **Inconclusive** (what's missing), or **Unverified** (reason: probe and fallback failed, or out of probe scope). A finding triage landed outside open shows that bucket in place of a verdict.
- **Verified** — one mandatory line: `Verified: <n> confirmed · <n> withdrawn · <n> inconclusive · <n> unverified — <k> native probes`. Two segments are conditional: ` · <n> triaged out` joins the counts only when triage landed findings outside open — the **verify** and **addressed** buckets both, since neither got a verdict here — and `, <m> inline fallbacks` joins the probe count only when a batch was verified inline (probe failed or called off). Mandatory so a skipped or failed verify phase is visible rather than ambiguous.

## Shared checklist

Every member confirms these, alongside the items its own file adds:

- [ ] Each phase ran from its skill file, probes on `verify-issue` — none improvised from memory
- [ ] Every finding renders exactly once in **Batches** — open ones with exactly one verdict, non-open ones with their triage bucket; none dropped, Withdrawn ones included with evidence
- [ ] Every probed batch covered by a probe (merged small zones count) or a flagged inline fallback; prompts carried the findings verbatim; probes read-only per the fan-out contract
- [ ] The Output carries the mandatory **Verified** line
- [ ] Nothing edited and nothing written to any source — the pipeline-wide read-only guarantee held
