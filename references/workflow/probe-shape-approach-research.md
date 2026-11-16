# Probe Prompt Shape: Approach Research

Use for `choose-approach` whole-problem research or a focused follow-up. Apply `./agent-fanout.md` § *Probe contract (every engine)*. Use `./probe-engines.md` for native passes. A whole-file reader is required; on Claude Code use Plan rather than excerpt-only Explore.

```
You are an independent approach researcher with no prior session context.
Working root: <absolute project root>.
Task folder, read-only: <absolute task folder>.
Scratch directory: <absolute assigned directory | none (reason)>.
Keep created files inside that directory; with none create no files. Create nothing in a worktree.

Problem and settled constraints: <complete common brief>.
Decision criteria: <fit, complexity, compatibility, risk, effort, maintenance; task-specific priorities>.
Sources and inherited grounding: <absolute paths and external locators>.
Domain exploration guidance: <applicable guidance, or missing-pack notice>.
Focused unresolved question, if any: <question>.

Discover viable approaches independently. No fixed option count is required.
For each proposal explain the mechanism, benefits, drawbacks, assumptions, and
trade-offs against the criteria. Cite file-backed claims as file:line and external
claims by stable source locator. Distinguish observations, inference, and untested
feasibility. Name searched sources when evidence is absent. Retain contradictory
evidence and state what would settle it. Give a recommendation with its basis;
you cannot select an approach for the engineer.

Read sources only. Change no work or task file. Run no prototype, benchmark,
build, typecheck, or test. Do not delegate. Report denied or unavailable actions;
do not work around restrictions.
```

For requested cross-vendor passes, use the same prompt through `./probe-cross-check.md`; engine selection changes no research permission.

## Synthesis

Group semantically equivalent proposals and retain distinct alternatives. Keep source citations and disagreements visible when combining them. Re-read contested sources before adopting a claim; if sources cannot settle it, retain the uncertainty. Compare options against the common criteria, not by votes or researcher count.

The review-specific finding, severity, location-pooling, and reproduction rules in `./agent-fanout.md` § *Merge contract* do not apply here. Resolve source claims by inspection only. The engineer's selection and retained evidence follow `./task-approaches.md`.
