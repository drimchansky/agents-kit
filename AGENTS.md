# Rules

> **Priority**: Project codebase consistency takes precedence. If the codebase follows different patterns, match those first. These rules apply when no established pattern exists.

- Match the scope of changes to the scope of the request; don't refactor adjacent code unless asked
- When discovering issues outside the current task, note them separately; don't silently fix or silently ignore
- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Don't commit, stage changes, or otherwise mutate Git state unless explicitly asked
- Don't guess — if requirements, intent, or context are not 100% clear, ask a clarifying question before proceeding

## Communication

- Be concise; no trailing summaries, no restating what was asked
- When reporting issues found outside current scope, list them at the end in a separate "Noticed" section

## Workflow

- Read project CLAUDE.md / AGENTS.md before starting implementation in any new project
- Use parallel agents for independent research and validation tasks
- Run linter/typecheck after non-trivial changes before presenting results
- When a task touches multiple files, batch related changes; don't make one edit per message

## Skills

Skills prefixed with `_` follow a shared naming convention for broadly applicable guidance. Whether they are auto-applied depends on the agent.

## Dependencies

- Evaluate before adding: is it maintained? What's the bundle cost? Could you write it in <50 lines?
- Pin versions; use lockfiles
- One library per concern; don't install two solutions for the same thing

## Stack defaults (when no project convention exists)

- Package manager: pnpm
- Language: TypeScript (strict)
- Bundler: Vite
- Testing: Vitest
- Formatting: Prettier + ESLint
