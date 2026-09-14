# Batched Finding Fixes

## Batched finding fixes

For `fix-findings` health cadence and red-boundary handling, use `skills/fix-findings/SKILL.md` § *Integrated health boundary*.

Both failure isolations require a green control (`../workflow/execution-recovery.md` § *Evidence lifecycle*). For health, establish it with the failed command at baseline. For a final outcome, include the finding's change set and dependency closure in the control. Replay the full outcome tier, including per-unit checks (`../workflow/fix-findings-recovery.md` § *Dependency-safe recovery*).
