# Result: <plan title>

**Plan:** [./plan.md](./plan.md)
**Goals:** [./goals.md](./goals.md)
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Started:** YYYY-MM-DD

## Current state
_Updated: YYYY-MM-DD_
- **Status:** executing — <one line: where things stand>
- **Pointers:** <branch `…`, PR #… (url), SHA …, ticket …, plus the `SHA <sha> (recorded YYYY-MM-DD)` watermark entry when one is present — or "none yet">
- **Next:** <one line>

---

## Decision log

- YYYY-MM-DD — <decision> (→ <result anchor / CONTEXT section / plan step / DECISIONS.md #N>)

## Step N — <step title>

**Verified:** <`executor`, or `coordinator` with the re-run case where one fired; then per check the command line, its exit status, and its last 10 output lines (fewer when shorter)>

**Health:** <the boundary this step ended on>

**Shipped:**

- <file:line or path> — <what changed>
- <five bullets at most; a wider change summarized by directory>

**Sources:** <official-doc URLs grounding framework-specific code in this step, plus any pattern shipped without one and why; otherwise omit>

**Executed:** <how this step deviated from the default launch; otherwise omit>

**Deviations from plan:** <if any — what differed and why; otherwise omit>

**Notes:** <surprises, gotchas, follow-ups, anything important; otherwise omit>

---

## Full Run — <date>

**Verified:** <per step, `Step N — executor` or `Step N — coordinator (<re-run case>)`, then that step's evidence bounded as above — never the criteria alone>

**Health:** <the full-plan tail boundary on the final tree, plus any mid-run boundary that ran, named with the point it bounded>

**Shipped:**

- <five bullets at most across all steps; wider changes summarized by directory>

**Sources:** <as above, across all steps; otherwise omit>

**Executed:** <one `Step N …` entry per step that deviated from the default launch; otherwise omit>

**Deviations from plan:** <if any>

**Notes:** <surprises, gotchas, follow-ups>

---

## Checkpoint after Step N

**Asserted:** <which named assertions ran — e.g. the e2e flow exercised>
**Health:** <the one boundary on the tree this checkpoint bounds, including any batch it bounds>
**Outcome:** passed
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
