---
description: Review a high-risk authorization-library branch and withhold approval until the engineer signs off on the reviewed object.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 80
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Please review my current branch against `main`. It is a local branch with no pull request yet. Run the review pass yourself in this session rather than launching a separate reviewer agent.
