# Engineering Exploration

How to "explore the domain's reality" when the domain is **code** — the engineering recipe the
neutral spine loads before planning (`plan-task`), grounding a review (`review-task`), grounding
idea variations (`refine-idea`, via `../workflow/ideation.md`), re-verifying shipped claims on
resume (`resume-task`), or grounding a standalone exploration (`explore`). The spine owns *that* you must ground in reality before
designing; this file owns *how* you do it in a codebase. See `../workflow/domain-packs.md`.

## Ground before designing

Always ground the work in what already exists. Read before designing — assumptions about the code
are the most common source of infeasible plans.

- Search for related implementations to use as models; map the affected files and the shared code
  in the blast radius.
- Note existing constraints: tech debt, public API contracts, performance budgets, module
  boundaries the project enforces.
- Read the target code fully, then trace its callers, callees, types, and tests.
- Check history — comments, docs, and commit history carry the "why" that the code alone doesn't.
- Identify load-bearing elements: public API consumers, shared types, test contracts.

## Verify each claim against the source

When the plan or review references existing code, every claim about existing behavior must be
verified against the actual source — never inferred from a name.

- **Verify it exists** — file, function, component, hook, API, type. Grep for it.
- **Verify it does what's assumed** — read the implementation, not just the name. A component
  called `ValidatorList` might be tightly coupled to a specific context.
- **Check reusability** — if the plan says "reuse X," confirm X can actually be reused. Look for
  hard-coded dependencies, context coupling, or internal-only exports.
- **Map the blast radius** — grep every modified export and confirm callers still work; trace data
  shape changes through the pipeline to the UI.

## External APIs and libraries

- **Verify the API surface** — check installed package versions (`package.json`, lockfiles) and
  actual exports. Don't assume an API exists from naming conventions.
- **Check the message / transaction format** — for protocol-level work, verify the exact message
  types and fields.
- **Cross-reference** — if official docs and actual project usage disagree, flag it.

## Pattern consistency

When grounding a plan or review, compare the proposed work against the project's established
patterns:

- Does the proposed structure match how similar features are built?
- Does data flow follow the same hooks / context / query patterns?
- Are naming conventions consistent (routes, components, events)?
- Would the work require new dependencies, and are they justified?
- Does it respect module boundaries the project enforces?

## Blast-radius / drift verification (used by review and resume)

To confirm recorded work still matches the code on disk:

- Partition referenced paths into **shipped** (claimed to exist) vs **pending** (a future step
  will create them). A missing shipped path is drift; a missing pending path is expected.
- **Existence check** — confirm each shipped path still exists; tag a missing one `block` (or
  `warn` if renamed/moved and you can find the new location).
- **Symbol-survival check** — grep the named file for each cited symbol; flag symbols that are
  gone, renamed, or moved.
- **Implementation-vs-record check** — open one or two shipped files and confirm the described
  change is visibly present (not reverted or refactored away).
