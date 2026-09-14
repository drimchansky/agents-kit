# `scripts/session-triage.ts`

Triages Claude and Codex transcripts for agent-misbehavior signals.

```
node scripts/session-triage.ts --since YYYY-MM-DD [--top N] <dir> [<dir>...]
```

**Contract.** stdout is one JSON object: `{flagged,remainder,remainderPaths,scanned,sessions,skippedUnknownRecords,skippedUnrecognized,skippedUnrecognizedPaths,unreadable,unreadableDirs,unreadablePaths}`.

`flagged` is the ranked top slice; `remainderPaths` names every flagged session outside it. `unreadable` counts unreadable in-window transcripts and directories, named by `unreadablePaths` and `unreadableDirs`. Treat these as missed work when advancing a since-marker. Unsniffable files appear in `skippedUnrecognizedPaths`, outside that gate.

`sessions` groups in-window files as `{project,count}`, descending by count, then project, with null project last. Counts sum to `scanned`. Project is the first cwd found in record order: Claude's top-level cwd or Codex session_meta's payload.cwd. It is null for unreadable, unsniffable, or cwd-free files.

Warnings use stderr; exit status is always 0. Require an integer `--top` and real calendar date `--since`. An invalid window leaves directories unread and reports them, not a clean walk.

Rank sessions by distinct signal-class count, then recency. Tool-error presence alone does not flag a session; only classified signals count.
