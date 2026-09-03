# Engineering Planning

Engineering specifics for `plan-task`: how to slice code work into steps, size them, and place
checkpoints. The neutral spine owns the planning *process* (clarify → goals → explore → approach →
scope → steps → checkpoints → risks); this file owns the code-shaped *details*.

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

## Declaring edit surfaces (`Touches:`)

A step's optional `**Touches:**` line declares the files or directories it edits, so
`implement-task`'s automatic parallel batch can test disjointness mechanically. In code, "different files"
often still means a shared artifact — check for these before declaring two steps disjoint:

- A shared barrel/index or re-export file both steps must edit to register their work.
- Generated artifacts a change rewrites as a side effect: lockfiles, snapshots, generated types,
  migration sequence numbers.
- Global registries new modules hook into: routing tables, DI containers, feature-flag or
  translation catalogs.

When unsure, leave `Touches:` off — an undeclared step runs serially, which is the safe default.

## Checkpoints

Cadence and shape — when a checkpoint is due, that it's a gate and not a step, when short plans
skip them — are owned by the planning spine (`plan-task` § *Add Checkpoints*); this file owns only
what a code checkpoint asserts:

- A concrete end-to-end flow still works — name it ("user can log in and see dashboard", not "core
  flow").

The integrated suite, typecheck, lint, and build run at the checkpoint's adjacent health boundary
(`./verification.md` § *Two verification tiers*), not as authored assertions — an assertion names an
end-to-end outcome the health recipe cannot prove.

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
