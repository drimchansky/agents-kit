---
description: Commit only the staged change, leaving unstaged and untracked work alone and pushing nothing.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 80
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Please commit the change I've staged.

When you are done, and before your final response, run `node tools/commit-report.mjs` from the repository root to record the repository state.
