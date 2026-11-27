# Task progress

Apply this gate whenever a task run changes a step checkbox, goal verdict, or plan Status. Use evidence verified in that run. A finding, discussion, prior result entry, or commit record can nominate a check. Each still needs current verification. Apply [Task writes](./task-writes.md) for authorization and [Task result](./task-result.md) for records.

## Step checkboxes

Check a step after its authored Verify and the domain's per-unit checks pass under [the execution loop](./execution-loop.md#two-verification-tiers). Write its step record and link the checkbox to that section. A passing step can be checked whether its work is committed or uncommitted. Handle the recorded SHA separately from the checkbox under [Checkpoint and final commits](./task-delivery.md#checkpoint-and-final-commits). A verification-only update can retain or remove the step's Commit field. It cannot assign a new SHA. If a required check remains open, keep the box unchecked and name the gap and owner.

## Goal verdicts

Re-read the goal and prove its current outcome under [the acceptance discipline](./execution-acceptance.md). For irreproducible or externally confirmed outcomes, check the best available proxy against [the goal criteria](./acceptance-criteria.md). A semantic goal rewrite waits for a subsequent run to verify it. A verified result replaces the verdict for that goal in Acceptance. Pending external requires an explicit external marker and names the awaited proof and verifier. Keep the accepted verdict when a marker-only edit preserves the goal's meaning and evidence. Record a supported regression as unmet.

## Plan status

Enter executing from to-do only on the execution skill's authorized start or current evidence of work, with a result linked from the plan. When evidence clears a blocker, resume through implement-task's blocked continuation. A cleared source citation alone supplies no permission to resume execution.

When verified advances leave no implementation step open, run the acceptance gate before raising Status. When the run cannot perform the full gate, retain Status and put `/implement-task` in Current state's Next. An explicitly open downstream verification leg stays visible until its owner provides proof.

Before entering done or in-review, freshly pass integrated health in the resolved domain, even when the work product did not change. For in-review → done, use [the verification source after delivery](./task-delivery-edges.md#verification-source-after-delivery). Check the intended delivered revision for affected deployable engineering work. Check the current work product for documentation and supported local-only engineering work. Missing delivered-source proof stays pending and names the owner and next action. A check that runs and fails requires repair.

Apply [the engineering live gate](../engineering/acceptance-gate.md) independently of goal markers and scope. Enter in-review only when local implementation and agent-verifiable goals are satisfied and downstream checks remain. Keep each pending external goal or engineering check in In review. Enter done only after all required goals and checks are met, with explicitly acknowledged caveats or deferrals and supported not-applicable live checks as allowed by the acceptance gate. Write Acceptance, applicable Live verification, and Completed together, removing the active wait on exit. A factual delivery refresh alone leaves a completed plan's accepted scope intact.

## Downward repairs

Apply the [result format check](./task-layout.md#result-format-before-writing) before treating an absent record or unresolved checkbox link as evidence for a downward repair.

Clear a checkbox when evidence shows its work is gone or the checked claim lacks its required record. Remove its result link. Preserve the step number and What and Verify text. Keep any historical evidence without presenting it as a current pass.

- `done → executing` when a verified outcome regresses or required Acceptance is absent. Remove Completed. Keep still-supported step checkboxes.
- `in-review → executing` when a verified implementation outcome or applicable live check fails. Clear the active In review section and record the failure with its owner.
- `executing → to-do` when the result is absent and the run finds no evidence of work. Restore the unstarted Result header. When verified work warrants a missing result, create and link its header and Current state, then record supported outcomes. Apply this rule after weakening a done plan missing its result.
- If a blocked or in-review plan lacks a result, flag the missing companion for implement-task. Derive a valid status from the weakest supported claim when the status is unknown. Record the old wording and evidence. Never invent acceptance, a blocker cause, or a pending goal.

A repair confers no execution permission and never assigns skipped, blocked, or in-review. Apply [the lifecycle](./task-lifecycle.md) for an execution blocker or user-directed abandonment. Revive skipped only with the user's explicit confirmation. After repairs, refresh Current state from the resulting plan and report what changed.
