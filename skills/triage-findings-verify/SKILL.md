---
name: triage-findings-verify
description: Use when asked for a verified triage of findings you already have — one command that gathers findings from a source (a PR's review comments, a saved or pasted list, or this session's review), batches them by concern, verifies each open batch in an isolated read-only probe, and displays one verdict per finding. Reads and displays only; never edits code or posts anywhere.
argument-hint: '[source: PR number/URL, file path, or pasted findings — defaults to session findings; passed to the triage phase]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is an engineering skill: also read `./references/engineering/rules.md` and apply it on top of the core. See `./references/workflow/domain-packs.md`.

One command for the findings-first pipeline: gather and batch findings you already have (`triage-findings`), then verify each **open** batch in an isolated read-only probe running the `verify-issue` protocol — cold eyes per batch, one verdict per finding. Unlike the review composites (`review-pr-triage-verify`, `review-commit-triage-verify`), there is no review phase: the findings come from an external source that triage resolves — a PR's review comments, a saved or pasted list, or a review run earlier this session. So triage's `verify` and `addressed` buckets can be genuinely populated, and this skill shows them rather than assuming everything is open.

Each phase executes its skill file — read the sibling `SKILL.md` and run its full protocol. Three overrides apply pipeline-wide, to every phase:

- **Core Rules blocks** — the composite's own block above covers the pipeline; inner skills' AGENTS.md read is already satisfied and doesn't repeat.
- **Chat display** — findings render once, in the final Output; phases print only what their section below allows.
- **Next pointers** — inner skills' follow-up suggestions are dropped; the composite's Output owns **Next**.

Past these three, a phase departs from its skill only where its own section below says so — never by improvisation.

**CRITICAL**: The whole pipeline reads and displays. No phase edits code, posts to a PR, resolves a thread, or writes to any source — the guarantee `triage-findings` and `verify-issue` each carry individually, held end to end. Addressing the findings is a separate, manual follow-up.

## Source

There are no flags — `-x`/`-d` belong to the review phase the review composites carry, and this one has none; the per-batch verify probes run on the **native** engine regardless. The only argument is the triage source, passed straight to phase 1.

Phase 1 runs `../triage-findings/SKILL.md`'s **full** source resolution — an explicit argument wins (a PR number/URL → PR mode, a file path → that file, pasted text → those findings); with no argument it takes this session's review findings, else falls back to the open PR for the current branch; several named sources merge into one view. This is the departure from the review composites, which pin triage to their own phase-1 review and forbid other sources — here there is no in-session review to pin to, so triage resolves the source itself.

There is **no working-tree precondition and no drift re-check**. The review composites guard a reviewed-diff identity — a head/merge-base or staged digest their probes must not diverge from — because their probes read the live tree and the findings were produced from a snapshot in that same session. This composite has no such snapshot: the findings pre-exist and may already be partly addressed, and `triage-findings`' classify step already routes any finding whose anchored code changed since it was written into the **verify** (outdated) bucket. If the source yields nothing to triage, phase 1 says so and stops.

## Phase 1 — Triage

Execute `../triage-findings/SKILL.md` end to end, with its full source resolution above — no pinning, no source narrowing. It classifies every finding into exactly one bucket (**open** / **verify** / **addressed**) and batches the open ones by concern. Print its **Overview** — the source(s) triaged and the counts — as the one progress line; hold the batch detail for the final Output.

**No open findings** — everything landed in `verify`/`addressed`, or the source had no findings at all — makes phase 2 vacuous: skip it and render the Output without probe verdicts, its **Verified** line reading `Verified: no open findings to verify` and the non-open findings still shown under their buckets.

## Phase 2 — Verify

Fan out per `./references/workflow/agent-fanout.md` — its probe contract, engine registry, and merge contract all bind here; this skill is a registered consumer. One probe per batch on the **native** engine, launched in parallel — a zone's findings share one investigation context; merging two small zones into one probe is fine when their concerns overlap. **Only open findings are probed**: the `verify` and `addressed` buckets keep their triage label into the final display and get no verdict. Default to probing every open finding, because a wrong minor finding still costs the author time; on a large set, scoping probes to Major/Critical is fair economy — scoped-out findings take the verdict `Unverified (out of probe scope)`.

Each probe prompt follows the **verify shape** in the Probe prompt skeleton of `./references/workflow/agent-fanout.md`: self-contained, carrying the batch's findings verbatim and the absolute path of this skill's sibling `../verify-issue/SKILL.md` for the probe to apply. The **review object** the probe reads depends on the source triage resolved:

- **PR mode** — hand the probe the PR's diff (`gh pr diff <number>`); the findings are review comments on that change, and a finding about what the PR added or dropped can't be judged from current file contents alone.
- **This session's review findings** — hand the reviewed diff if it is recoverable from the session (`<base>...HEAD`, or `git diff --cached` for a staged review), exactly as the review composites do.
- **A file, pasted text, or any standalone finding with no associated change** — there is no diff; the probe verifies each finding as a standalone claim against current code, which is `verify-issue`'s native single-issue mode. Say so in the prompt, so the probe investigates the claim rather than hunting for a change that was never its subject.

When triage merged several sources, one concern batch can span these — some findings from a change, some standalone. The review object is then per finding, not per batch: give a probe only the diff its change-based findings came from, verify the standalone ones as claims against current code, and where a single batch spans both, split it along that line so no probe is handed a diff that doesn't correspond to some of its findings — worse than none, per the skeleton.

**Merge** per the fan-out merge contract. A probe's **Not an issue** → the finding is **Withdrawn**, displayed with the probe's evidence. A probe's confirmation → the finding stands as **Confirmed**, with root cause and fix options ordered targeted → thorough. Never silently drop either way. A finding the probe surfaces on its own — `verify-issue`'s scope step routinely turns up the same pattern elsewhere — is a candidate, not a verdict: verify it against the same review object, then adopt it into its batch's zone as an open finding, verdict and all, so **Batches** and the **Verified** count carry it like any other.

**Degrade**: a failed or hung probe never blocks the pipeline — verify that batch inline by the same `verify-issue` protocol and mark its verdicts `verified inline (probe failed: <reason>)`. Inline verdicts lose the cold-eyes property; the mark keeps that visible.

## Output

Lists, never tables.

- **Overview** — the source(s) triaged and the counts: N open, N to verify, N addressed. This names the provenance — which source was and wasn't covered; there is no review `Reviewed at <sha>` line here.
- **Batches** — the triage frame: one section per concern zone, ordered by its most severe member. Each finding renders once — original text with its severity prefix, `file:line` (or a short quote when it has no anchor), then its verdict: **Confirmed** (root cause, plus fix options targeted → thorough), **Withdrawn** (the probe's evidence), **Inconclusive** (what's missing), or **Unverified** (reason: probe and fallback failed, or out of probe scope). A finding triage placed in `verify` or `addressed` shows that bucket in place of a verdict.
- **Verified** — one mandatory line: `Verified: <n> confirmed · <n> withdrawn · <n> inconclusive · <n> unverified — <k> native probes`. Two segments are conditional: ` · <n> triaged out` joins the counts when triage landed findings in `verify`/`addressed` (neither got a verdict here), and `, <m> inline fallbacks` joins the probe count when a probe failed and its batch was verified inline. Mandatory so a skipped or failed verify phase is visible rather than ambiguous.
- **Inaccessible context** (only if any) — sources or links triage couldn't fetch, with the reason, forwarded from phase 1.

**Next:** address the confirmed findings — `/implement-task` for a scoped fix, or `/review-commit` once you've made changes. Withdrawn findings need no action.

## Verification

Confirm the protocol invariants before finishing:

- [ ] Phase 1 ran `triage-findings` with its full source resolution, and the source(s) are named in the Overview
- [ ] Each phase ran from its skill file (`triage-findings`, probes on `verify-issue`) — none improvised from memory
- [ ] Every finding renders exactly once — open ones with exactly one verdict, `verify`/`addressed` ones with their bucket; none dropped, Withdrawn ones included with evidence
- [ ] Every open batch covered by a probe (merged small zones count) or a flagged inline fallback; prompts carried the findings verbatim and the right review object (the diff when the source has one, none for standalone findings); probes read-only per the fan-out contract
- [ ] Output carries the Overview provenance and the mandatory Verified line
- [ ] Nothing edited, nothing posted — the pipeline-wide read-only guarantee held
