# `scripts/session-triage.ts`

Selects Claude and Codex conversations for review from mechanical signals, user interventions, and a bounded unflagged sample.

```
node scripts/session-triage.ts --since YYYY-MM-DD [--top N] <dir> [<dir>...]
```

**Contract.** stdout is one JSON object: `{flagged,remainder,remainderPaths,scanned,sessions,conversations,sampled,sampleOmitted,telemetryRecords,diagnostics,skippedUnknownRecords,skippedUnrecognized,skippedUnrecognizedPaths,unreadable,unreadableDirs,unreadablePaths}`.

`flagged` contains at most `--top` conversation groups, default 10. Each entry has `{path,paths,host,mtime,classes,candidates,score,evidence}`.
`path` names the parent transcript when available; `paths` preserves every discovered member file.
`classes` counts mechanical signals; `candidates` counts `user-intervention` and `repeated-request` hypotheses.
Neither field establishes misconduct or a kit defect.
`score` counts distinct classes and candidate kinds. Rank by score, latest retained evidence time, then path.
Undated matches use file modification time for ranking.

`evidence` contains `{kind,path,line,timestamp,timeBasis,callId?,messageId?}` without transcript text.
Lines are physical, starting at 1. `timeBasis` is `record` or `file-mtime`; unavailable timestamps are null.
Multiple locators may describe one operation; stable call or record IDs deduplicate its count within a group.
Read surrounding records for authorization, call context, recovery, and outcome, including records before the window.

`conversations` counts recognized groups. Codex uses the first session_meta's `payload.id` and explicit parent_thread_id, including source.subagent.thread_spawn.
Later copied session_meta records and inherited session_id values cannot replace that identity.
Claude uses sessionId with isSidechain and agentId, or its explicit `<sessionId>/subagents/agent-<agentId>.jsonl` layout.
Uncertain identities remain separate. Working directory and temporal proximity establish no relationship.
Child prompts do not count as user interventions. Dated child records predating their creation metadata are inherited history.

`sampled` selects at most three otherwise unflagged groups with parent user activity, ordered by parent path.
`sampleOmitted` counts other eligible groups. Sampling is deterministic and offers no statistical or complete conversational coverage.
`remainder` counts candidate groups beyond `--top`; `remainderPaths` includes every member path in those groups.

File modification time discovers files; record timestamps filter incidents and user activity against `--since`.
Undated or invalidly dated records use file modification time and receive diagnostics.
Tool definitions remain available across the window boundary. Old incidents do not count toward current retry thresholds.
Direct rejection or validation envelopes can signal a failure; successful outputs quoting those strings do not.
Text blocks retain their boundaries while transport-only headers are removed and structured success metadata is checked.
Tool-error presence alone does not select a conversation.
User candidates come from actual user messages; known instruction injections and duplicate Codex message representations are excluded.
Repeated requests compare consecutive unique parent messages across the group.
Record time orders them; undated records use file modification time, with path and line breaking ties.
Stable message IDs suppress copied user records; matching text does not establish a copied identity.
Distinct explicit message IDs prevent Codex event/response pairing, even within one turn.
Identical text otherwise pairs through shared message or turn identity.
Adjacency within one second also pairs identical text when turn IDs do not conflict.
Unique response-only turns remain eligible in mixed logs. Plain or wrapped `/clear` and `/model` commands are housekeeping.
Host command-output wrappers do not establish user activity; actual skill invocations and task requests remain eligible.
Phrase matching is conservative; the unflagged sample can reveal friction outside those patterns.

`scanned` counts discovered files, including unreadable and unrecognized files.
`sessions` groups those files as `{project,count}`, descending by count, then project, with null project last. Counts sum to `scanned`.
Project is Claude's first top-level cwd or Codex's first session_meta payload.cwd; missing values remain null.
`telemetryRecords` counts recognized metadata records separately from `skippedUnknownRecords`, which counts unknown and malformed records.
`diagnostics` contains `{kind,path,line}` for unknown, malformed, undated, invalid-timestamp, and identity-uncertain records.
Diagnostics cover discovered files, including unrecognized files; they qualify coverage without establishing a failure.

`unreadable` counts failed transcript reads and directory walks, named by `unreadablePaths` and `unreadableDirs`.
Treat these as missed work when advancing a since-marker. Unsniffable files appear in `skippedUnrecognizedPaths`, outside that gate.
Warnings use stderr; exit status is always 0. Require an integer `--top` and real calendar date `--since`.
An invalid window leaves directories unread and reports them, not a clean walk.
