# Engineering Planning

Engineering specifics for `plan-task`: how to slice code work into steps, size them, and place
checkpoints. The neutral spine owns the planning *process* (clarify → goals → explore → approach →
scope → steps → checkpoints → risks); this file owns the code-shaped *details*. See
`../workflow/domain-packs.md`.

## When a code change warrants a plan

**Plan when:** the task spans multiple files or modules; multiple viable approaches exist with
meaningful trade-offs; changes affect shared code with wide blast radius; requirements are
ambiguous and need decomposition; high-risk changes to critical paths.

**Skip when:** single-file change with an obvious implementation; bug fix with a clear root cause
and location; the user already specified the exact approach; the task is smaller than the plan
would be.

## Evaluating approaches

For each approach, assess **alignment** (how well it matches existing codebase patterns),
**simplicity** (minimum complexity to meet requirements), **risk** (what could go wrong, how
reversible), and **effort** (relative size S/M/L).

## Step shape

Each step is a **verifiable piece of work** — after completing it, there's a concrete way to
confirm it worked before moving on. Order steps as **vertical slices, not horizontal layers**:
each step delivers a complete capability (schema + API + UI for one thing) rather than all
schemas, then all APIs, then all UI. Vertical slicing surfaces integration risk early and keeps
the system demoable between steps. Use horizontal ordering only when a foundational layer (shared
types, a migration) genuinely has no vertical seam.

A step's **Verify** is a concrete engineering check: run a test, check a behavior, see output,
verify types pass.

Step sizing:

- Too coarse: "Implement the feature" — not actionable, not verifiable as a unit.
- Too fine: "Add import statement" — noise, not independently meaningful.
- Right size: "Add validation hook with error state for the form fields" — one concern, verifiable
  by rendering the form and checking error states appear.

Break a step down further when any of these hold:

- The title contains "and" (it's two steps wearing one hat).
- It touches two or more independent subsystems (e.g. auth and billing).
- Its acceptance can't be stated in 3 or fewer bullets.
- It would touch more than ~5 files.

## Checkpoints

For plans with more than ~5 steps, insert a checkpoint every 2–3 steps that re-verifies the
**integrated** system, not just the latest change. A checkpoint asserts:

- The test suite still passes (not just the test for the latest step).
- Build / typecheck still succeeds.
- A concrete end-to-end flow still works — name it ("user can log in and see dashboard", not "core
  flow").

Checkpoints are gates, not steps: they carry no `- [ ]` marker. Skip them for short plans (≤5
steps) where the final step's verification doubles as an end-to-end check.

## Scaling plan depth

Match plan detail to task complexity (file counts are a rough proxy):

- **Medium** (2–5 files, clear pattern) — skip approach comparison, light on risks.
- **Large** (5–15 files, some ambiguity) — all sections, moderate detail.
- **Complex** (architectural, cross-cutting) — deep exploration, multiple approaches compared.

## Common gaps to check in a code plan

When reviewing a code plan for what it omits (used by `review-task`):

- **Missing UI states** — loading, error, empty, disabled states not mentioned.
- **Missing navigation** — how the user gets to and from the new flow.
- **Missing data handling** — where data comes from, how it's fetched, cached, invalidated.
- **Missing analytics** — if the project tracks events, new user actions likely need tracking.
- **Missing pattern acknowledgement** — if the work needs a new route, context, or hook, the plan should say so.
