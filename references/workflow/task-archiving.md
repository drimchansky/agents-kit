# Archiving Finished Tasks (Optional)

Archive a `done` or `skipped` task relative to its own parent, removing it from active listings (`./task-layout.md`):

```
<parent>/<slug>/  →  <parent>/Archive/<slug>/
```

An existing archive may contain unrelated user content; add beside it. Refuse an occupied `<parent>/Archive/<slug>/` rather than overwrite.

**Immediate Backlog parent exception.** A terminal task directly inside Backlog archives out to the grandparent's Archive:

```
<grandparent>/Backlog/<slug>/  →  <grandparent>/Archive/<slug>/
```

Match Backlog case-insensitively (`./task-backlog.md`). Only the immediate parent triggers this exception; higher Backlog names do not. The helper and a user's manual move use this destination.

**Already archived is asked of the whole path up to the store, not of the immediate parent alone.** An Archive container anywhere between task and its containing registered or canonical `.agents/tasks` root means already archived. Refuse both archiving and parking, naming that container. Ignore an archive name above the store root. Without a containing store, inspect the whole path. Backlog differs: only the immediate parent establishes parked state.

**Recognizing the directory is case-insensitive.** Create new containers as `Archive/`; recognize existing spellings case-insensitively in scans, slug fallbacks, destination guards, and refusal checks. `maintain` normalizes stray lowercase spelling.

`ARCHIVE_DIR` in `scripts/lifecycle-constants.ts` is a sanctioned copy per `AGENTS.md` § *Consumer lists*.

`archive-task` invokes `scripts/task-move.ts` to check terminal status and destination guards before moving the whole folder. A user's manual move may reach the same destination but skips those guards, including protection against nested archives.

Internal `./` links survive the move; rewrite no contents. Group inheritance also survives (`./task-store.md` § *Shared group context*): Archive is transparent, and its own group file contributes nothing. Do not copy, snapshot, or rewrite shared grounding.
