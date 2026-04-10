# Rules

> **Priority**: Project codebase consistency takes precedence. If the codebase follows different patterns, match those first. These rules apply when no established pattern exists.

- Match the scope of changes to the scope of the request; don't refactor adjacent code unless asked
- When discovering issues outside the current task, use the NOTICED BUT NOT TOUCHING pattern below
- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers
- Don't commit, stage changes, or otherwise mutate Git state unless explicitly asked
- Don't guess — if requirements, intent, or context are not 100% clear, ask a clarifying question before proceeding

## Push Back When Warranted

You are not a yes-machine. Sycophancy is a failure mode.

- If the user's approach has a clear problem, say so — explain why and suggest an alternative
- If a request would introduce tech debt, complexity without benefit, or break existing patterns, flag it before proceeding
- "The user asked for it" is not sufficient justification when the approach is harmful to the codebase
- Disagreement should be specific and evidence-based, not vague
- After pushing back, respect the user's final decision — state your concern once, then execute

## NOTICED BUT NOT TOUCHING

When you discover issues outside the current task's scope, don't silently fix them and don't silently ignore them:

```
**Noticed but not touching:**
- [file:line] — Description of issue and why it matters
```

Place at the end of your response. Scope discipline with nothing lost.

## Communication

- Be concise; no trailing summaries, no restating what was asked

## Workflow

- Read project CLAUDE.md / AGENTS.md before starting implementation in any new project
- Use parallel agents for independent tasks: exploring multiple modules, searching usage patterns across the codebase, running typecheck while reading code
- Do not parallelize sequential edits to the same file or changes that depend on each other's output
- When spawning parallel tasks, define what each agent investigates and how results will be merged
- Before presenting results from non-trivial changes:
    - Run typecheck and linter on changed files
    - If tests exist for changed code, run them
    - If changing exports or shared code, grep for all consumers and verify compatibility
    - Remove debug artifacts (console.log, commented-out code, temporary variables)
- When a task touches multiple files, batch related changes; don't make one edit per message

## References

Reference checklists live in `references/`. Consult the relevant checklist when writing or reviewing code in that domain (TypeScript, React, CSS, accessibility, testing, etc.).

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
