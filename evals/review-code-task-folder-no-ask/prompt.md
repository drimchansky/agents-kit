---
description: Review the checked-out branch a task folder records without asking which work to review.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 80
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Please code-review the work tracked in the task folder `.agents/tasks/add-clamp`. Run the review pass yourself in this session rather than launching a separate reviewer agent.
