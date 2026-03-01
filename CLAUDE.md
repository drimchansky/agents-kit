# Rules

> **Priority**: Project codebase consistency takes precedence. If the codebase follows different patterns, match those first. These rules apply when no established pattern exists.

- Match the scope of changes to the scope of the request — don't refactor adjacent code unless asked
- When discovering issues outside the current task, note them separately — don't silently fix or silently ignore
- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Don't commit, stage changes or anything using Git yourself unless explicitly asked

## Skills

Skills prefixed with `_` are auto-applied — read their description at the start of every task when working with matching files. Check the skill's description to determine if it applies.

## Dependencies

- Evaluate before adding: is it maintained? What's the bundle cost? Could you write it in <50 lines?
- Pin versions; use lockfiles
- One library per concern — don't install two solutions for the same thing
