# Agents Kit

My personal kit for working with Claude Code, Codex, and other coding agents.

It includes:

1. **Core rules for agents** – how to communicate, when to push back, and when it's better to ask than continue blindly.
2. **References** – important checklists and docs for various cases, for now it's mostly about engineering.
3. **Utility skills** – self-contained helpers that don't rely on the core rules, so they run anywhere: locally via CLI or in any chat.
4. **Engineering skills** – code-focused skills that apply the core rules and references ad hoc, against a diff, a file, or a codebase.
5. **Workflow skills** – the core-rules skills that move a task from idea to done through a task folder under `.agents/tasks/`.

## Getting started

Install the kit into Claude Code and Codex with the setup script:

```bash
git clone git@github.com:drimchansky/agents-kit.git ~/agents-kit
~/agents-kit/setup.sh
```

## Utility skills

- **proofread** – polish a message, email, or piece of writing.
- **translate** – translate text from one language to another.
- **fact-check** – verify factual claims against trustworthy sources online.
- **review-note** – validate and expand a personal knowledge-base note.
- **refine-idea-chat** – sharpen a vague idea in chat, nothing saved.

## Engineering skills

Code-focused and core-rules-aware: each loads the rules and engineering references, then runs on its own against a diff, a file, or a codebase. No task folder involved.

- **audit** – assess a module, directory, or whole project: structure, patterns, and health.
- **explore** – explain code, a library, a concept, or how the pieces fit together.
- **review-commit** – review staged changes before committing.
- **review-pr** – review a PR or branch diff against its base.
- **review-docs** – audit existing documentation against the codebase.
- **verify-issue** – confirm and investigate a reported bug or issue.

## Workflow skills

The set that turns a rough task into finished work. Each works on one task folder under `.agents/tasks/<slug>/`, handing the slug to the next:

1. **refine-idea** – sharpen a vague idea into grounded context before planning.
2. **plan-task** – break the work into a plan with testable goals.
3. **review-task** – sanity-check the plan against its context, goals, and current reality before building.
4. **implement-task** – execute the plan, tracking progress in the task folder.

Two more support the workflow:

- **resume-task** – catch up on a task and get a handoff briefing, without changing anything.
- **migrate-task-format** – upgrade older task folders to the current format.

