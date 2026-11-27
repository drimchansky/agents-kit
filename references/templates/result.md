# Result: <plan title>

<!-- agents-kit: migrated task result -->

**Plan:** [./plan.md](./plan.md)
**Goals:** [./goals.md](./goals.md)
**Context:** [./CONTEXT.md](./CONTEXT.md)
**Started:** YYYY-MM-DD

## Current state
_Updated: YYYY-MM-DD_
- **Status:** executing — <one line: where things stand; for done, distinguish accepted scope from later confirmed delivery>
- **Pointers:** <branch `…` (base `…`), PR #… (url), SHA …, ticket … — or "none yet">
- **Next:** <one current action, or `none`; refresh after confirmed delivery changes even when plan Status is done>

---

## Step N — <step title>

**Verified:** <per required check: `executor` or `coordinator`, coordinator assignment/re-run reason where applicable, command/observation, status, and evidence path/anchor or short diagnostic. Retain pending/open checks with their definition, owner, and missing capability. Summarize the report; do not copy output tails.>

**Health:** <this step's boundary outcome and evidence location; omit when a checkpoint or batch record owns it>

**Commit:** <SHA covering this step, when established>

**Shipped:**

- <file:line or path> — <what changed>
- <five bullets at most; a wider change summarized by directory>

**Sources:** <official-doc URLs grounding framework-specific code in this step, plus any pattern shipped without one and why; otherwise omit>

**Executed:** <`verification-only continuation` for that path; otherwise any explicit engine selection, and how this step deviated from the default launch; otherwise omit>

**Deviations from plan:** <if any — what differed and why; otherwise omit>

**Grounding corrected:** <surface (a group file or ticket.md by its path from the selected root), prior wording, new wording, and the evidence that disproved it; otherwise omit>

**Notes:** <surprises, gotchas, follow-ups, anything important; otherwise omit>

---

## Checkpoint after Step N

**Asserted:** <which named assertions ran — e.g. the e2e flow exercised>
**Health:** <the one boundary on the tree this checkpoint bounds, including any batch it bounds>
**Outcome:** passed
**Commit:** <SHA `<sha>`; `none — no task changes`; `failed — <reason>`; or `not run — checkpoint failed`; omit when checkpoint commits were not authorized>
**Merged:** <parallel-batch steps merged at this gate in plan order; omit when no batch>
**Notes:** <surprises, near-misses, anything important; otherwise omit>

---

## Final implementation commit

**Health:** <link to the final implementation boundary's owning section; record shared evidence once>
**Commit:** <SHA `<sha>`; `none — no task changes`; `failed — <reason>`; or `not run — final health failed`; omit this section when final commits were not authorized>
**Notes:** <failure, signing hand-over, or resume settlement; otherwise omit>

---

## Acceptance

**Verified against:** [./goals.md](./goals.md)

**Health:** <finalization boundary evidence, or a link to the section that records it>

- G1 — met (verified by <command / behavior observed>)
- G2 — met with caveats (<what's caveated and why>)
- G3 — unmet (<what's missing, what's needed to close the gap>)
- G4 — out of scope (excluded by plan scope, user-acknowledged)
- G5 — pending external (awaiting <what>, verified by <who/how>)

---

## In review

- G<n> — <what is awaited, who or what verifies it>
- <engineering target / environment> — <pending check>; owner <who>; next <action/evidence awaited>; goal <G<n> if one exists>

---

## Blocked

**Cause:** <external wait or unresolved failure>
**Tried:** <steps taken to clear it>
**Awaiting:** <evidence, dependency, or decision needed to resume>
**Health:** <last passing boundary and its coverage, or none>

---

## Live verification

- <target / environment> — <expected release>; <observed release and time>; <workload health>; <functional or browser behavior>; <evidence>
- <target / environment> — not applicable (<repository evidence for absent deployment or environment>)

---

## Open findings

- <finding, pending decision, or unfinished work> — <owner>; <evidence and next action>

---

**Completed:** YYYY-MM-DD
