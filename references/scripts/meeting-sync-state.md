# `scripts/meeting-sync-state.ts`

Meeting filesystem authority for the secretary entry to `sync-meeting-notes`.

```
node scripts/meeting-sync-state.ts configure <request.json|->
node scripts/meeting-sync-state.ts status <request.json|->
node scripts/meeting-sync-state.ts start <request.json|->
node scripts/meeting-sync-state.ts finish <request.json|->
node scripts/meeting-sync-state.ts create <request.json|->
node scripts/meeting-sync-state.ts observe <request.json|->
node scripts/meeting-sync-state.ts archive <request.json|->
node scripts/meeting-sync-state.ts reconcile <request.json|->
node scripts/meeting-sync-state.ts remove <request.json|->
```

Requests are JSON objects. `configure` takes `owner` and returns null when disabled, otherwise retained settings.
Settings carry `folder`, physical `identity`, `intervalMinutes`, `store`, and `owner`. Preserve the returned object without reconstruction.
All other commands require `retained`; they bypass current configuration.
`start` optionally takes `explicit: true` and returns a fresh `token`.
`finish` takes `token` and `outcome`: `complete`, `partial`, `failed`, or `stopped`.
`create` takes `token`, relative Markdown `path`, and string `body` up to 1 MiB.
Its parent directories must already exist. A missing parent is a refusal, not permission for direct creation.

## Archive receipts and deletion

`observe` takes `token` and `path`. It returns an observation containing relative `path`, device/inode `identity`, and SHA-256 `hash`.
Read the note for content decisions and verify its bytes against the observation before using it.
All commands below require the active `token` alongside retained settings.

Use `operation: {provider, id}` with the source's stable meeting ID, independent of titles, dates, and filenames.
`provider` is a lowercase identifier; `id` is a nonempty string of at most 2,048 characters.
If identity is uncertain, keep the item and report it instead of inventing an ID.

Call `reconcile` with `operation` before classifying an archive as absent or allocating a filename.
It returns null when no receipt exists; otherwise it returns the receipt after settling an already published file.
The receipt contains `operation`, `path`, `bodyHash`, `parentIdentity`, `incoming`, `template`, `stage`, `stageDirectory`, `archive`, and `removed`.
An `archive` observation proves publication. A null `archive` means the recorded stage still needs publication through `archive`.
Reconciliation adopts a destination only when its identity matches the recorded staged file and either its bytes match or the recorded stage still links that same file.
When the destination is missing but the recorded stage has another link, reconciliation records the publication as moved and removes the stage by identity. Deletion then refuses until the recorded archive returns.
A published receipt stays published after its archive changes, moves, or disappears. It authorizes no further archive, and deletion still requires the unchanged archive.

`archive` takes `operation`, `path`, `body`, `incoming`, and `template`.
Supply observations from `observe`, or explicit null for an absent incoming note or template.
The helper records the destination, body hash, source observations, and private stage identities before publication.
Retry with the same operation. A published receipt retains its destination and body and ignores replacement request content.
An unpublished retry with the original body hash and unchanged original source observations continues the recorded publication at its recorded destination.
When the archive folder is unchanged, a changed body, changed recorded source, or missing recorded stage restarts an unpublished receipt. The helper discards the recorded stage and records a new receipt at the requested path, with or without a collision. A stage linked elsewhere refuses instead.
For an unpublished receipt, `reconcile`, `archive`, and `remove` refuse when its archive folder was replaced, renamed, or deleted. A missing folder reports `missing parent: <relative path>`; a replacement reports `archive parent changed` and names the recorded stage path relative to the meeting folder. The refusal persists for that operation unless the original folder returns; after deletion, it is permanent. Report the item for manual handling. A renamed folder retains the stage; the refusal names its recorded path, not its moved location.
After an unrelated collision, use the sync skill's filename policy and resubmit the operation with that alternate path.
Resubmitting an unpublished receipt with an alternate path after an unrelated collision changes its destination. Report the returned receipt's `path`.
The helper preserves the collision file, including one whose bytes happen to match the proposed body.
Only recorded stages with matching file identity, directory identity, and bytes can be recovered or removed. A stage whose published link was edited in place is removed by file and directory identity.

For archive deletion, `remove` takes `operation` and `covered: true`.
Set `covered` only after the sync skill proves every non-template incoming line appears in the recorded archive, allowing rewritten links.
Deletion requires a published receipt, incoming and template observations, and unchanged identities and hashes for all three files.
Newer incoming text or a changed template preserves the incoming note. A missing observation grants no deletion authority.
A repeated successful removal performs no further deletion, including when a new note occupies the old path.
The receipt records `removing: true` before deletion. When an interrupted removal left the incoming path empty, `reconcile` and `remove` settle it as removed without deleting anything; a file at that path stays untouched.

For template-copy deletion, omit `operation`; supply `incoming`, `template`, and `completeSource: true`.
Set `completeSource` only after the sync skill establishes complete source coverage for that note's date and its deletion eligibility.
The incoming note and template must be different files, with different paths and identities.
Their hashes must match, and both observations must remain unchanged.
The helper checks filesystem preconditions; the caller owns semantic content coverage and source completeness.

## Attempts and filesystem guarantees

`status` returns retained settings, active attempt, last completion, retry deadline, due flag, earliest eligible time, and `eligibleAt`, that time as an ISO UTC instant.
Other times are Unix milliseconds. Attempts hold a one-hour lease against competing starts.
An explicit retry bypasses due time, not a live lease. Completion after lease expiry remains valid until superseded.
Failure preserves successful completion and sets retry to outcome time plus the retained interval.
Stopped or superseded tokens cannot publish, reconcile, delete, or finish. Stop uses `finish` with `stopped` before host cancellation.
`finish` with `stopped` checks only the retained store and owner, allowing revocation after the meeting folder moves or is replaced.

The store resides under `~/.local/state/agents-kit/secretary/meeting-sync/<store>/` with private records. Its parent directories may be symlinks; the store directory itself must be a physical directory.
Stop, start, completion, publication, reconciliation, and deletion use one mutation lock.
Locks record process ownership; only a proven dead owner permits reclamation. Unknown ownership reports busy.
Creation links a privately staged file into an absent destination; existing files remain unchanged.
Private staging uses the destination filesystem. No replacement fallback is permitted.
Root, parent, and staging identities are rechecked before publication.
Node provides no descriptor-relative publication or atomic compare-and-delete; concurrent external writers can race final checks.

Stdout contains one JSON result, bounded to 32 KiB. Successful creation returns `created`; finish returns `outcome`.
Archive and reconciliation return receipts; successful removal returns `removed: true`.
Exit 0 completes; 1 refuses a decided conflict; 2 reports invalid input or unavailable filesystem state.
Read stderr on failure. A failed command grants no direct-write fallback.

The CLI always uses its current home and clock.
A mutation already holding the lock settles before a competing stop; later mutations validate the revoked token.
