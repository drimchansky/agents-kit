---
description: Ask which encoding the new ledger feed uses before implementing it.
tags: [regression]
model: claude-opus-5-5
runs: 3
max_turns: 30
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, AskUserQuestion]
---

Add a `ledger` feed to the export component in `src/export/` so the warehouse loader described in `docs/warehouse-loader.md` can ingest ledger entries. Each entry looks like `{ id, accountId, amount, memo }`, and the CSV columns are `id,account_id,amount,memo`. Memos never contain commas, quotes, or line breaks, but they can contain non-ASCII text such as `Café Zürich`.

Before your final response, run `node tools/state-report.mjs` from the repository root to record the repository state.
