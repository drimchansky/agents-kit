# Terminal Session Labeling

What a skill records in the agterm session's context once it resolves the object it acts on. The label shows in the session's title bar and persists across relaunch.

## Guard

Label only when `AGTERM_SESSION_ID` is set. Unset means the run is outside agterm. Skip the call and say nothing about it.

Label once, when the citing skill resolves its object. A later resolution in the same session replaces the earlier label.

## The command

```
agtermctl session context '<label>' --target "$AGTERM_SESSION_ID"
```

`--target` defaults to the user's selected session, which is rarely the agent's own. Pass `$AGTERM_SESSION_ID` so the label reaches the running session.

Paste a label only between the single quotes; double quotes would execute a `$(…)` or backtick in a folder or branch name. Skip the call when the label contains `'`.

Read a branch label with `git branch --show-current` as its own command, then paste it like any other label. Empty output means detached HEAD, which takes no label.

Never run `session rename` or `session context --clear`. The sidebar name and clearing the context stay with the user.

## Labels

A resolved task folder takes its slug. A selected pull request takes `<owner>/<repo>#<number>`. A reviewed branch without pull-request context takes the branch name; detached HEAD takes none. A commit range or a set of paths without pull-request context takes no label.

## Best effort

Ignore every failure. A sandbox may deny agterm's socket, and the command may be absent.

Do not retry, do not ask to escalate, and do not mention the call or its failure in output. The run proceeds exactly as it would without agterm.

## Scope of the write

The call touches no file, task document, or repository state. A skill that promises to write nothing may still run it.
