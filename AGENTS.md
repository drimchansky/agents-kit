# Rules

Universal rules for AI coding agents. Applied to all projects.

> **Priority**: Project codebase consistency takes precedence. If the codebase follows different patterns, match those first. These rules apply when no established pattern exists.

## Agent Behavior

### Decision Making

- Match the scope of changes to the scope of the request — don't refactor adjacent code unless asked
- If requirements are ambiguous, ask one focused question rather than guessing
- When discovering issues outside the current task, note them separately — don't silently fix or silently ignore
- If a task is complex enough to warrant a plan, create one before coding
- Prefer the simplest solution that meets the requirements

### Communication

- Be concise — lead with the answer, then provide context if needed
- When making trade-off decisions, state what was chosen and why
- Flag risks and assumptions explicitly rather than burying them
- If something can't be done as requested, explain why and propose an alternative

### Working With Code

- Read before writing — understand the existing code before modifying it
- Make changes that are easy to review — small, focused, well-described
- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers

## Workflow

- Verify changes work — run linters, type checks, or tests when available
- Prefer editing existing files over creating new ones
- Only create files when there is no reasonable existing file to extend
- Don't commit, stage changes or anything using Git yourself unless explicitly asked

## Skills

Skills prefixed with `_` are auto-applied — read their description at the start of every task when working with matching files. Check the skill's description to determine if it applies.

## Dependencies

- Evaluate before adding: is it maintained? What's the bundle cost? Could you write it in <50 lines?
- Pin versions; use lockfiles
- One library per concern — don't install two solutions for the same thing
