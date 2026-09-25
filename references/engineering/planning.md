# Engineering Planning

Engineering specifics for `plan-task`: how to slice code work into steps, size them, and place checkpoints.

## When a code change warrants a plan

**Plan when:** the task spans multiple files or modules; multiple viable approaches exist with meaningful trade-offs; changes affect shared code with wide blast radius; requirements are ambiguous and need decomposition; high-risk changes to critical paths.

**Skip when:** single-file change with an obvious implementation; bug fix with a clear root cause and location; the user already specified the exact approach; the task is smaller than the plan would be.

## Evaluating approaches

For each approach, assess **alignment** (fit with existing codebase patterns), **simplicity** (minimum complexity to meet requirements), **risk** (what could go wrong, how reversible), and **effort** (relative size S/M/L).

## Step shape

Each step is a verifiable piece of work with a concrete way to confirm it worked before moving on. Order steps as vertical slices, not horizontal layers: each step delivers a complete capability (schema + API + UI for one thing), which surfaces integration risk early and keeps the system demoable. Use horizontal ordering only when a foundational layer (shared types, a migration) has no vertical seam.

A step's **Verify** is a concrete engineering check: run a test, check a behavior, see output, verify types pass.

Step sizing:

- Too coarse: "Implement the feature"; not actionable, not verifiable as a unit.
- Too fine: "Add import statement"; noise, not independently meaningful.
- Right size: "Add validation hook with error state for the form fields"; one concern, verifiable by rendering the form and checking error states appear.

Break a step down further when its title contains "and", it touches two or more independent subsystems, its acceptance needs more than 3 bullets, or it would touch more than ~5 files.

## Declaring edit surfaces (`Touches:`)

A step's optional `**Touches:**` line declares the files or directories it edits, so `implement-task`'s parallel batch can test disjointness mechanically. "Different files" often still means a shared artifact; check for these before declaring two steps disjoint:

- A shared barrel/index or re-export file both steps must edit to register their work.
- Generated artifacts a change rewrites as a side effect: lockfiles, snapshots, generated types, migration sequence numbers.
- Global registries new modules hook into: routing tables, DI containers, feature-flag or translation catalogs.

When unsure, leave `Touches:` off; an undeclared step runs serially.

## Checkpoints

Cadence and shape are the planning spine's (`plan-task` § *Add Checkpoints*). A code checkpoint asserts one thing: a named end-to-end flow still works ("user can log in and see dashboard", not "core flow"). Integrated health checks run at the checkpoint's adjacent health boundary (`./verification.md` § *Two verification tiers*), not as authored assertions.

## Scaling plan depth

Match plan detail to task complexity, with file counts as a rough proxy:

- **Medium** (2–5 files, clear pattern): skip approach comparison, light on risks.
- **Large** (5–15 files, some ambiguity): all sections, moderate detail.
- **Complex** (architectural, cross-cutting): deep exploration, multiple approaches compared.

## Common gaps to check in a code plan

What a code plan commonly omits (used by `review-task`):

- **Missing UI states**: loading, error, empty, disabled.
- **Missing navigation**: how the user gets to and from the new flow.
- **Missing data handling**: where data comes from, how it is fetched, cached, invalidated.
- **Missing analytics**: if the project tracks events, new user actions likely need tracking.
- **Missing pattern acknowledgement**: a new route, context, or hook the plan should name.
