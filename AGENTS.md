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
- Verify changes work — run linters, type checks, or tests when available
- Make changes that are easy to review — small, focused, well-described
- Don't introduce new dependencies without justification
- Don't remove or rename public APIs without checking all consumers

## Code Style

### Naming Conventions

- **Variables/Functions**: camelCase (`fetchUser`, `isValid`)
- **Classes/Components/Types**: PascalCase (`UserProfile`, `SearchInput`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_RETRY_COUNT`, `API_BASE_URL`)
- **Files**: Match the primary export
- **Booleans**: Use `is`, `has`, `should`, `can` prefixes (`isLoading`, `hasError`)
- **Event handlers**: `handle` prefix for handlers, `on` prefix for props

### Functions

- Single responsibility — do one thing well
- Limit parameters to 3; use an options object for more
- Prefer pure functions; isolate side effects
- Use early returns to reduce nesting

### Comments

- Explain "why", not "what" — the code shows what, comments explain intent
- Delete commented-out code; version control exists
- Use JSDoc for public APIs and complex functions

## TypeScript

- Define precise types; avoid `any` — use `unknown` and narrow instead
- Prefer type inference where types are obvious
- Use union types and discriminated unions for known value sets
- Use `readonly` for data that shouldn't be mutated
- Avoid type assertions (`as`); prefer type guards

## Error Handling

- Never silently swallow errors — at minimum, log them
- Provide user-friendly messages; keep technical details in logs
- Use typed errors or error codes, not just message strings
- Implement retry logic for transient failures (network, rate limits)
- Design for partial failure — one broken feature shouldn't crash the app

## Testing

- Test behavior, not implementation details
- Cover happy paths, edge cases, and error states
- Each test should be independent — no shared mutable state
- Use descriptive test names: `"displays error when submission fails"`
- Mock external dependencies for determinism
- Keep tests fast; slow tests don't get run

## Security

- Sanitize and validate all user input on both client and server
- Never store secrets in client-side storage or commit them to version control
- Validate permissions on the server — client checks are UX, not security
- Keep dependencies updated; audit for known vulnerabilities
- Never log passwords, tokens, or PII

## Accessibility

- Use semantic HTML — correct elements over generic divs with ARIA
- All interactive elements must be keyboard accessible with visible focus indicators
- Maintain sufficient color contrast (WCAG 2.1 AA)
- Manage focus for dynamic content (modals, route transitions)
- Respect `prefers-reduced-motion` for animations

## Git

- Don't commit anything yourself

## Dependencies

- Evaluate before adding: is it maintained? What's the bundle cost? Could you write it in <50 lines?
- Pin versions; use lockfiles
- Prefer packages with good TypeScript support
- One library per concern — don't install two state management solutions
