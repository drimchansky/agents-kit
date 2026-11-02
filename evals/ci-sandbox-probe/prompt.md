---
description: Temporary Linux sandbox capability probe.
tags: [calibration]
model: claude-opus-5-5
runs: 1
max_turns: 16
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

This is an environment check. Run each numbered command with the Bash tool, one call each, and report each raw output and exit status. Then use the Write tool to create `write-tool.txt` containing `ok`. Change nothing else and do not retry failed commands differently.

1. `pwd; id -u; echo "HOME=$HOME"; echo "TMPDIR=$TMPDIR"; ls -ld . .. "$HOME"`
2. `touch probe-file; echo touch=$?; mkdir probe-dir; echo mkdir=$?; ls -la`
3. `touch "$TMPDIR/probe"; echo tmp=$?; d=$(mktemp -d); echo mktemp=$? "$d"`
4. `grep -E 'claude-eval|tmp' /proc/self/mountinfo | head -25`
5. `git status --short; git commit -q -m staged; echo commit=$?; git log --oneline | wc -l`
6. `if [ -n "$ANTHROPIC_API_KEY" ]; then echo key-set; else echo key-unset; fi`
