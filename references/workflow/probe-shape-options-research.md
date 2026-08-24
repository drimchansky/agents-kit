# Probe Prompt Shape: Options Research

The prompt shape for `review-task`'s question research — one probe per open question the assessment derived, so no question reaches the output bare. The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine is `./probe-engines.md`, always `native` with no cross-vendor hop, since `-x` remains the separate grounding cross-check and composes independently. One question per probe *is* the one-concern rule, not a swarm — questions trivially related to each other, the same decision or the same file, batch into one prompt. Answers merge under `./agent-fanout.md` § *Merge contract* and close on the consuming skill's `Question research:` line at the end of its Questions output: `Question research: <n> answered, <m> optioned, <k> no-evidence`. The line renders only when the review surfaced candidate questions — with none, no probe launches and no line renders — and those three counts are per question and always render within it. Inline fallbacks then append either or both of two conditional segments, in this order: `, <j> researched inline; skipped (<reasons>)` when no engine was available or a question's probe died — the count records completed research, `skipped` records the missing probe hop, and several questions' reasons comma-join inside the one parenthesis — then `, <r> researched inline (classification rejected)` when the consuming session's re-check rejected a probe answer that did run. The two counts are disjoint, since a rejected classification implies its probe ran.

This shape reads whole files and compares across them, so the most restricted agent type its discipline still fits is a Plan-type one — an excerpt-reading Explore-type starves the comparison (`./probe-engines.md`).

```
You are an independent researcher with no prior context. Working root: <absolute project root>.
Task folder, read-only context: <absolute task-folder path>.

Questions under research — do not trust their framing; read the actual files:
1. <the question, with the plan step, goal, or drift finding it arose from, verbatim>
2. …

Answer per question with its number and exactly one classification. Every ANSWERED
or OPTIONS claim carries evidence: cite file-backed evidence as file:line and an
external fact by its stable source or record locator. Evidence is whatever the plan
leans on — code, but also documents, configuration, schedules, vendor or venue
records — never code alone. NO-EVIDENCE instead names the sources and locations
searched, because an absence cannot cite a line it did not find:
- ANSWERED — that evidence settles the question: state the answer and cite it.
- OPTIONS — it is a judgment call: name 2–3 grounded options, each with its evidence and a
  one-line trade-off, then end with a recommendation.
- NO-EVIDENCE — nothing available bears on it: say so plainly, and never fabricate
  options to fill the gap.

You read and report only: change nothing, and run no build, typecheck, or test suite.
```
