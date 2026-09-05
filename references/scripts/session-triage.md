# `scripts/session-triage.ts`

Triages Claude and Codex session transcripts for agent-misbehavior signals.

```
node scripts/session-triage.ts --since YYYY-MM-DD [--top N] <dir> [<dir>...]
```

**Contract.** stdout is one JSON object `{flagged, remainder, remainderPaths, scanned, sessions,
skippedUnknownRecords, skippedUnrecognized, skippedUnrecognizedPaths, unreadable, unreadableDirs,
unreadablePaths}` — `flagged` is the ranked top slice, `remainderPaths` names every flagged session
beyond it, and `unreadable` counts every in-window transcript and directory this run could not read
(`unreadablePaths` and `unreadableDirs` name them), so a caller advancing a since-marker can tell that
work was missed rather than cleared. `skippedUnrecognizedPaths` names the files whose host could not
be sniffed — reported, but outside that gate, since they would not sniff on a later run either.

`sessions` is the same in-window files grouped by where they ran: `{project, count}` sorted by count
descending, then by project with a `null` project last, since `null` carries no `localeCompare` order
among the paths. `project` is the first `cwd` the transcript's records carry — a Claude record's
top-level `cwd`, a Codex `session_meta`'s `payload.cwd` — found by walking the records in order rather
than reading the first one, which is routinely a summary or snapshot carrying none; it is `null` for a
file this run could not read, could not sniff, or that carries no `cwd` at all. **The counts sum to
`scanned`.**

Warnings go to stderr; the exit code is always 0. `--top` takes a whole integer and `--since` a real
calendar date; a window that fails to parse leaves every directory unread and records it as unread,
so the payload never reads as a clean walk.

Sessions are scored by their count of *distinct* signal classes and ordered by that then recency.
Mere failure presence never flags a session — most `is_error` tool results are benign
(file-not-found, no-match greps). Only the classified signals count.
