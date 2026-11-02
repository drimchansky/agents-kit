---
description: Draft a substantive PR description for a branch in a repository with no issue tracker, without a ticket-link placeholder.
tags: [capability]
model: claude-opus-5-5
runs: 3
max_turns: 80
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Please review this branch in this session and draft the PR description for it too (-d). Run the review pass yourself here rather than launching a separate reviewer agent.
