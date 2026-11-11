# `scripts/silence-watch.ts`

Watches files for the silence watch in `../workflow/delegated-waiting.md` § *How to wait*. Stopping the watch and judging a silent command remain with the caller.

```
node <kit-root>/scripts/silence-watch.ts --interval <seconds> <file>...
```

`--interval` takes a whole number of seconds, at least 1, whose millisecond value is a safe integer. List at least one file.

**Silence.** Silence is the current time minus the newest modification time among the listed files. A listed file that does not exist yet or cannot be read counts as unchanged. When no listed file exists, silence runs from the watch's start.

**Checks.** Each check sleeps `interval - (silence mod interval)`, which wakes it at the next multiple of the interval since the files' last change. A check that follows one of the watch's own sleeps prints one line when silence has reached a new multiple of the interval. The first check after start prints nothing.

**Contract.** stdout carries only notices, one line each, written as the check makes it:

```
silent <seconds>s since <time>
```

`<seconds>` is the silence in whole seconds, rounded down. `<time>` is the moment silence began, in UTC ISO 8601 with milliseconds, such as `2026-01-01T11:42:30.000Z`.

**Exit status.** The watch runs until stopped, such as by a `Monitor` timeout or `TaskStop`. Missing or unreadable files never end it. It exits 0 at its first notice after its stdout reader closes. It exits 2 with the usage line on stderr when the interval is missing, not a positive whole number, or too large for safe-integer milliseconds, or no file is listed.
