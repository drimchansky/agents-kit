# `scripts/secretary-state.ts`

Keeps the secretary's activity records and derived status for the runbook in `../workflow/runbook.md`. Agents read and write these records only through the commands below, never through the raw checkpoint or history directory.

```
node scripts/secretary-state.ts append --type <type> --json <file|->
node scripts/secretary-state.ts apply --attempt <token> --proposal <id> --revision <n>
node scripts/secretary-state.ts hold --attempt <token> --proposal <id> --revision <n>
node scripts/secretary-state.ts recover
node scripts/secretary-state.ts status [--cursor <cursor>]
node scripts/secretary-state.ts rejected [--cursor <target>]
node scripts/secretary-state.ts history [--after <seq>] [--type <type>] [--proposal <id>]
node scripts/secretary-state.ts event --seq <seq>
node scripts/secretary-state.ts body --hash <sha256> [--offset <n>] [--limit <n>]
```

Every command also accepts `--expect-runbook <physical-root>`.

**Expected runbook.** The optional path is an absolute physical root retained from an earlier status. The helper compares it with the configured physical root before accessing records. A mismatch exits 1 without reading or writing either store; a non-absolute argument exits 2. Configuration aliases resolving to the same physical root pass. Omitting the option preserves configuration-selected access for standalone commands. Running coordinators and their secretary jobs supply the retained root on every call.

**Contract.** stdout is one JSON object of at most 32768 bytes, including its newline. Exit 0 completes the command. Exit 1 is a decided refusal: no configured runbook, a mismatched expected runbook, a credential match, an invalid or inadmissible payload, a live lease, records not ready, an unsafe or conflicting apply target, or an absent event or body. Exit 2 means no decision was reached: bad usage, unreadable or malformed configuration, an unavailable runbook directory, unreadable records, a malformed committed event, a history gap, or a busy lock. A refusal writes one reason to stderr and nothing to stdout.

**Runbook and store.** Read `runbookRoot` from `~/.config/agents-kit/config.json` under `../workflow/task-store.md` § *The root registry*. An absent file or key exits 1. Records live under `~/.local/state/agents-kit/secretary/runbook/<runbook-id>/`. The id joins the sanitized ASCII physical basename, capped at 238 characters, a hyphen, and 16 SHA-256 hex characters of its physical path. The store component is at most 255 bytes. Aliases of one directory share a store; a different directory gets separate history, never merged.

**Record permissions.** Record use sets an existing store root to `0700`; failure exits 2. New record directories use `0700` and files use `0600`, including lock staging, checkpoint, recovery, and temporary files.

**Events.** Each event is one immutable file, `history/YYYY-MM-DD/<12-digit seq>.json`. Its shape is `{seq,id,at,type,payload}`: consecutive seq from 1, a UUID, and an ISO UTC instant. Publication links a complete temporary file to its final name and never replaces an existing one. No command modifies or deletes a history file. The directory is the UTC date of `at`, or the newest existing directory when the clock reads earlier. One event holds at most 16384 bytes.

**Append.** `--type` takes one of six types. `apply-intent` and `apply-result` are written only by `apply` and `hold`; append exits 2 for them. The payload is a JSON object with exactly the listed fields. stdout is `{event}`, the committed event.

- `attempt-started` `{attempt,owner,job}`: `attempt` is a token of letters, digits, `.`, `_`, `:`, or `-`, at most 128 characters. `owner` is a nonempty label of at most 128 characters for the coordinator session that started it; the helper only records and reports it. `job` is `review` or `apply`. The attempt becomes the active attempt. A token already active or last completing a review is refused. An active attempt of either job holds a lease for one hour from its `attempt-started`. While that lease holds, another start is refused, naming the job, attempt, its owner, and the lease end as possibly live elsewhere. After the lease ends, a new start supersedes it.
- `attempt-stopped` `{attempt,reason}`: `reason` is `stopped` or `interrupted`. Only the active attempt stops; the event clears it and completes no job.
- `review-completed` `{attempt,outcome,summary,unavailable}`: only an active `review` attempt completes. `outcome` is `complete` or `partial`. `unavailable` lists unverified evidence and is nonempty exactly when the outcome is partial.
- `proposal` `{attempt,proposal?,target,summary,evidence,before,body}`: `attempt` names the active attempt. Omit `proposal` for a new one; the helper assigns `p<seq>` and revision 1. A new proposal is refused while another pending proposal names the same `target`; record that proposal's next revision instead. Name a pending id to record its next revision, which keeps that proposal's `target`. An `apply` attempt records only such a revision. `target` is a normalized runbook-relative path. `evidence` is a nonempty list of `{source,published,observed,detail?}` with ISO or null dates. `before` is the target's current SHA-256, or null for a new file. `body` is the exact replacement text, at most 1 MiB. The event keeps `bodyHash` and `bodyBytes`; the text is stored once in `bodies/<sha256>`.
- `decision` `{proposal,revision,decision,source}`: names a pending proposal's latest revision and no attempt. `decision` is `accepted`, `rejected`, or `deferred`. `source` names where the decision came from. A revision whose apply conflicted cannot be accepted again.
- `correction` `{attempt,corrects,note}`: `attempt` names the active `review` attempt. `corrects` names an existing seq; the correction annotates it without changing any record. Previously committed corrections without an attempt remain readable and recoverable.

A stopped, superseded, or unknown attempt can append no `attempt-stopped`, `review-completed`, `proposal`, or `correction`; each is refused. While a proposal has an unsettled apply intent, its new revisions and decisions are refused.

**Apply.** `apply` writes one accepted revision to its one target. A change to several files is several proposals, each with its own decision and outcome; no multi-file transaction exists. Under the lock, it requires:

- the active attempt to be an `apply` job with that token;
- the proposal to be pending at revision `<n>`, accepted, and not conflicted;
- the target to resolve inside the physical runbook through no symlink, with every existing parent a directory and an existing target a regular file;
- the target to lie outside `~/.local/state/agents-kit/` and `~/.config/agents-kit/`, which hold the kit's records and configuration;
- the target's bytes to hash to the proposal's `before`, or the target to be absent when `before` is null.

It then removes `.secretary-apply-*.tmp` files a crashed apply left in the target's directory. It appends `apply-intent` `{attempt,proposal,revision,target,before,after}`, where `after` is the body hash. It creates absent parent directories and writes the stored body to a temporary file in the target's directory. The temporary file requests mode `0600` before any body bytes are written. After writing, it restores an existing target's mode. A new target receives `0666 & ~umask`, using the umask captured before writing. An existing target is replaced by rename; a new one is linked and never overwrites. It re-reads the target and appends `apply-result` `{attempt,proposal,revision,target,outcome,observed,recovered}` with outcome `applied` and `observed` equal to `after`. The result ends the apply job and removes the proposal from pending. stdout is `{event}`, the result. No other runbook path changes.

A target that does not hash to `before` gets an `apply-result` with outcome `conflict`, the observed hash or null when absent, and no write. A target that changes during the replacement also records `conflict`, with the hash observed afterward. A save landing between the final hash check and the rename is replaced without detection. The command then exits 1 naming the recorded seq. The conflict ends the apply job and keeps the proposal pending; only a new revision and its acceptance can proceed. A write that fails after its intent records its result at once by the target's hash: `applied` when it holds `after`, `held` when it still holds `before`, and `conflict` otherwise. Final verification, recovered-success verification, and failure settlement recheck the target's directory chain around their reads, retaining original and newly created parents' identities. An unsafe or changed chain records `conflict` with `observed` null. An `applied` result prints `{event}` and exits 0. A `held` or `conflict` result exits 1 naming the failure and the recorded seq; `held` keeps the acceptance for a later apply. A `held` or `conflict` result removes the parent directories this apply created, deepest first. Removal stops at the first nonempty directory or changed directory chain. Temporary cleanup checks the parent chain and file identity before unlinking. A changed chain leaves cleanup unresolved. Outside settlement, an unsafe target, a missing acceptance, or a stale revision exits 1 before recording anything, leaving the attempt active.

An `apply-intent` without its result marks the pointer `intent`. The next `apply` of that revision, by the same or a fresh `apply` attempt, settles it by the target's hash:

- equal to `after`: an `applied` result with `recovered` true, writing nothing;
- equal to `before`: the write never happened, so it records a fresh intent and writes once;
- anything else, including a target that is no longer safe: a `conflict` result, writing nothing.

**Hold.** `hold` ends an `apply` attempt without writing. It appends an `apply-result` with outcome `held`, `observed` null, and `recovered` false, then prints `{event}`. `<n>` is a revision at or below the pending one. Holding the pending revision requires its acceptance, marks the pointer `held`, and keeps that acceptance for a later apply. Any active `apply` attempt may hold an older revision, whichever attempt recorded the newer one. Holding an older revision needs no acceptance and leaves the pointer unchanged. A recorded conflict refuses a hold only while its revision is pending. An unsettled intent refuses every hold of its proposal.

**Credential guard.** Append refuses a payload when any field name or decoded string matches a high-confidence credential shape. Apply and hold scan their event payloads, and apply scans the body before writing it. The classes are `private-key`, `aws-access-key-id`, `github-token`, `slack-token`, `jwt`, `url-password`, and `api-key`. The refusal names the class and field, never the value. Access methods and credential-manager key names pass.

**Status.** stdout is `{id,runbook,ready,reason,lastSeq,processedSeq,lastReview,activeAttempt,review,pendingTotal,pending,next}`. `id` is the store's directory name. The rest comes from the derived checkpoint, which records the processed position, last review, active attempt, pending pointers, and latest rejections. `activeAttempt` is `{attempt,owner,job,at,seq}`. Each pointer is `{proposal,revision,target,seq,bodyHash,bodyBytes,decision,decisionSeq,apply}`, in proposal order. A new revision replaces its pointer and clears its decision and apply state. `rejected` removes the pointer; `accepted` and `deferred` keep it pending. `apply` is null or `{state,attempt,seq}`, naming the latest apply event for that revision. Its `state` is `intent` for an unsettled write, `conflict`, or `held`. A non-null `next` is the `--cursor` for the remaining pointers. No pointer is dropped to fit a page.

`review` is `{due,dueAt,blockedBy,wake}`, computed from the checkpoint and the clock:

- `dueAt` is 24 hours after the last `complete` or `partial` review, or null before any. An apply job completes no review. `due` is true when `dueAt` is null or has passed. After a long absence one review is due; missed days are not replayed.
- `blockedBy` is the active attempt of either job with its `leaseUntil` while that lease holds, and null otherwise.
- `wake` is `{at,cron}`, or null when a review is due and unblocked. `at` is the later of `leaseUntil` while blocked and `dueAt` while not due. `cron` is a five-field one-shot cron in the host's local time: minute, hour, day, month, and `*`. Its minute is the first whole minute at or after `at`, and at least one minute after the status call. A minute of :00 or :30 moves two minutes later.

`ready` is false when the checkpoint disagrees with history, with reason `missing-checkpoint`, `checkpoint-behind`, `checkpoint-ahead`, or `checkpoint-malformed`. Status then exits 0 with null `review`, empty `pending`, and null `pendingTotal`. Append, apply, and hold exit 1 until `recover` completes. An empty store is ready. Reads never create the store.

**Rejected.** `rejected [--cursor <target>]` prints `{rejected,next}`. Each entry is `{target,proposal,revision,bodyHash,seq}`: the latest rejected revision for that target and its decision's seq, in target order. A later rejection for the same target replaces it. A non-null `next` is the `--cursor` for the remaining targets. The list holds one entry per target, so its size follows the runbook's file count, not history length. A store that is not ready exits 1.

**Recover.** `recover` rebuilds the checkpoint from history in bounded calls. stdout is `{ready,reason,processedSeq,lastSeq,complete}`. One call reduces at most 1000 events after the furthest saved position, in seq order. A behind checkpoint and the progress file `recovery.json` are saved positions when they do not pass `lastSeq`. A missing, ahead, or malformed checkpoint gives no position, so replay starts at seq 1. An incomplete call saves its reduction to `recovery.json` and reports `complete` false. Only a complete reduction replaces `state.json`, then removes the progress file. A ready store reports `complete` true and changes no record, removing only a leftover progress file. Recovery reads history and bodies but never modifies or deletes them. A malformed or missing committed event exits 2 naming its location and keeps the saved progress. Unsettled `apply-intent` events return as pointers in the `intent` state.

**History.** stdout is `{events,next}`: committed events after `--after`, default 0, in seq order. `--type` filters by any of the eight types. `--proposal` keeps that proposal's proposal, decision, `apply-intent`, and `apply-result` events. One call reads at most 1000 events. A non-null `next` is the `--after` that resumes the scan. `event --seq` returns `{event}` for one seq. A malformed event file, a mismatched seq, or a gap exits 2 naming its location; dependent work holds.

**Body.** stdout is `{hash,bytes,offset,length,text,next}`, at most `--limit` bytes of a stored body from `--offset`. The limit ranges from 4 to 16384 and defaults to 16384. Chunks end on UTF-8 character boundaries and shrink when escaping would exceed the output ceiling. A non-null `next` is the following offset. An offset inside a character or beyond the body exits 2.

**Lock.** Append, apply, hold, recover, status, and rejected hold a short `lock/` directory. It is published by renaming a prepared directory that already records its owner's pid, start time, and token. A lock whose owner pid is gone is reclaimed by the one contender that claims its owner record; an empty leftover `lock/` is replaced. A live holder, or a lock with no readable owner record, makes the command retry for about two seconds, then exit 2. History, event, and body reads take no lock, and idle time holds none.
