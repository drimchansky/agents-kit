# Source check

Only `resume-task -s` and `review-task -s` read or write [observations.md](./task-observations.md). During the brief or assessment, check the cited sources and compare them with the previous observations. Without the flag, skip enumeration, fetching and ledger access. A specific claim may still require evidence from its cited source.

## Scope

Run `node <kit-root>/scripts/sweep-scope.ts <task-dir>` using the [kit root](./task-store.md) and the [scope report](../scripts/sweep-scope.md). Read the previous ledger as the comparison baseline. Fetch only the returned citations, once per distinct URL. Compare every occurrence. If enumeration cannot run, report the error and leave the ledger alone.

## Fetching

Read sources through available structured integrations or HTTP. Never write to a cited system. Compare title, status, revision or last update with the dated ledger entry, or the citing line when no prior observation exists. Record what changed and its consequence at each occurrence.

## Tags

- `info` for unchanged state. An auth wall or unreachable source establishes no change. Report the failed attempt and manual recheck, preserving the prior observation, date and tag when available.
- `warn` for a material change such as an answered question, changed status, edited claim, or merged PR.
- `block` for a broken, moved or deleted target, including a repeated 404.

## Output and routing

Print `## References` with the tagged findings and what changed since the previous check, before the first correction or ledger write. For a successfully enumerated empty scope, print `No external references in sweep scope.` Leave a skipped check visibly skipped.

On an explicit read-only request report only. Unchanged observations affect only the ledger. For material changes, apply the host's correction consent and [Task writes](./task-writes.md#reference-changes) at each citing home. Keep Published lines, active pause text and group URLs free of source annotations. Route changes in verified progress through [Task progress](./task-progress.md). Re-report outstanding findings with their owners.

## Ledger

After the report and authorized corrections, rewrite the prior ledger in the [observations format](./task-observations.md) even if every citation is unchanged. Keep one dated line per checked URL with its strongest occurrence tag, including info, and any dated failed attempt. An empty scope removes only an existing stale ledger. A read-only check preserves it byte for byte.
