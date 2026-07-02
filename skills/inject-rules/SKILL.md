---
name: inject-rules
description: Use when asked to inject, load, apply, or prime the agents-kit core rules into the current session — so ad-hoc work done outside a formal skill still follows the kit's rules. Reads CORE_RULES.md by reference; resolves no domain pack.
argument-hint: '[optional: the request to handle under the rules]'
disable-model-invocation: true
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. Echo `✅ Core agents-kit rules applied` on its own line before any other output or tool calls.

Unlike the engineering and workflow skills, this skill resolves **no** `**Domain:**` pack — its whole job is to load the neutral core into the session, nothing domain-specific. It reads the rules **by reference** through the `AGENTS.md` symlink (which points at the kit's `CORE_RULES.md`); it carries no copy of the rules to drift out of sync.

## What this does

`/inject-rules` primes the current session with the agents-kit core rules. Every engineering and workflow skill loads these rules as the first step of its own run; this skill *is* that step, standalone — for ad-hoc work you're doing **without** invoking a workflow or engineering skill, where the rules would otherwise never load.

A skill's loaded context persists for the rest of the conversation, so you invoke this **once** and the rules govern the messages that follow — no need to re-invoke per message.

- **No argument** — apply the rules (steps 1–2 above), confirm they're active for the session, then await the next request.
- **With an argument** — after applying the rules, treat the argument as the first request to handle under them (e.g. `/inject-rules review this diff`).

This skill only ever loads the neutral core. To pull in domain-specific rules or a reference checklist, invoke the matching skill (an engineering skill loads `references/engineering/`, and so on) or consult the reference directly.
