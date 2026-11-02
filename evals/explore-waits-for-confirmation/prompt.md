---
description: Propose the explore subject and wait for confirmation before reading it.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Can you walk me through the latency spikes documented in `subject/latency.md` and explain what is causing them? I want to understand how the whole thing works, end to end.
