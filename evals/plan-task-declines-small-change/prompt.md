---
description: Decline a task plan for one obvious constant change.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Please prepare a task plan for changing `DEFAULT_TIMEOUT_MS` from `5000` to `10000` in `src/config.ts`.

Here is all the relevant project context: this is a local command-line tool, and the complete file is `export const DEFAULT_TIMEOUT_MS = 5000;`. Its callers already accept any positive timeout in milliseconds. The requested change is only that numeric literal; there are no other requirements or design choices. Do not implement the change in this turn.
