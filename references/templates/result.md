# Result: <plan title>

**Plan:** [./plan.md](./plan.md)
**Goals:** [./goals.md](./goals.md)
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Started:** YYYY-MM-DD

## Current state
_Updated: YYYY-MM-DD_
- **Status:** executing — <one line: where things stand; for done, distinguish accepted scope from later confirmed delivery>
- **Pointers:** <branch `…`, PR #… (url), SHA …, ticket …, plus the `SHA <sha> (recorded YYYY-MM-DD)` watermark entry when one is present — or "none yet">
- **Next:** <one current action, or `none`; refresh after confirmed delivery changes even when plan Status is done>

---

## Decision log

- YYYY-MM-DD — <decision label> (→ <dated result anchor / dated CONTEXT or plan anchor / DECISIONS.md #N>; preserve an original pre-result anchor)

## Step N — <step title>

**Verified:** <`executor` or `coordinator` with re-run case; criterion outcome, decisive command/observation with exit or pass/fail, and evidence path/anchor or short diagnostic. Summarize the report; do not copy output tails.>

**Health:** <this step's boundary outcome and evidence location; omit when a checkpoint or batch record owns it>

**Shipped:**

- <file:line or path> — <what changed>
- <five bullets at most; a wider change summarized by directory>

**Sources:** <official-doc URLs grounding framework-specific code in this step, plus any pattern shipped without one and why; otherwise omit>

**Executed:** <how this step deviated from the default launch; otherwise omit>

**Deviations from plan:** <if any — what differed and why; otherwise omit>

**Grounding corrected:** <surface (a group file or ticket.md by its path from the selected root), prior wording, new wording, and the evidence that disproved it; otherwise omit>

**Notes:** <surprises, gotchas, follow-ups, anything important; otherwise omit>

---

## Full Run — <date>

**Verified:** <each step's outcome and decisive check with status and evidence location; group shared checks, retaining each step's identity and any failure. Summarize executor reports.>

**Health:** <the full-plan tail boundary and any mid-run boundary once each, with outcome and evidence location>

**Shipped:**

- <five bullets at most across all steps; wider changes summarized by directory>

**Sources:** <as above, across all steps; otherwise omit>

**Executed:** <one `Step N …` entry per step that deviated from the default launch; otherwise omit>

**Deviations from plan:** <if any>

**Grounding corrected:** <one `Step N …` entry per correction, as above; otherwise omit>

**Notes:** <surprises, gotchas, follow-ups>

---

## Checkpoint after Step N

**Asserted:** <which named assertions ran — e.g. the e2e flow exercised>
**Health:** <the one boundary on the tree this checkpoint bounds, including any batch it bounds>
**Outcome:** passed
**Commit:** <SHA `<sha>`; `none — no task changes`; `failed — <reason>`; or `not run — checkpoint failed`; omit when checkpoint commits were not authorized>
**Merged:** <parallel-batch steps merged at this gate in plan order; omit when no batch>
**Notes:** <surprises, near-misses, anything important; otherwise omit>

---

## Acceptance

**Verified against:** [./goals.md](./goals.md)

- G1 — met (verified by <command / behavior observed>)
- G2 — met with caveats (<what's caveated and why>)
- G3 — unmet (<what's missing, what's needed to close the gap>)
- G4 — out of scope (excluded by plan scope, user-acknowledged)
- G5 — pending external (awaiting <what>, verified by <who/how>)

---

## In review — YYYY-MM-DD

**In review:** <omit this section when no outside verification remains>

- G<n> — <what is awaited, who or what verifies it>
- <engineering target / environment> — <pending check>; owner <who>; next <action/evidence awaited>; goal <G<n> if one exists>

---

## Live verification

- <target / environment> — <expected release>; <observed release and time>; <workload health>; <functional or browser behavior>; <evidence>
- <target / environment> — not applicable (<repository evidence for absent deployment or environment>)

---
