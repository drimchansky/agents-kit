# Task result

Use the [result template](../templates/result.md). Copy its format marker when creating a result and preserve it on updates. The link header holds Plan, Goals, Context, and Started. The plan owns lifecycle status.

## Record keys

Write the applicable level-2 sections in template order. Rewrite the matching record in place when its current evidence changes. Keep one section per key. Add no dated log sections.

- **Current state**: one block under the header, at most 1 KB. Include the updated date, a one-line status gloss, Pointers, and Next. Pointers carry branch, PR, SHA, and ticket identifiers as applicable. Next names the current action or `none`. Derive the block from the live records, keep the gloss within the plan's Status, and refresh after confirmed delivery changes even at done.
- **Step <n> — <title>**: one record per recorded plan step, in plan order. The step number is the key. Use the plan title and link the checked step to this record. Record the work and its verification. The Commit field names the commit covering the step when established. Clear it when re-executing work. Keep it on verification-only updates when the verified work is in that commit.
- **Checkpoint after Step <n>**: one record per checkpoint, keyed by step number. Record the latest assertion, health, outcome, and any authorized commit attempt.
- **Final implementation commit**: one record for the latest authorized final commit gate. Refer to the owning health record when the boundary is shared.
- **Acceptance**: one section with each goal's latest verdict and evidence, plus the finalization Health field. Use the [acceptance discipline](./execution-acceptance.md).
- **In review**: one section while the plan is in-review. List each pending external goal with its verifier and each engineering pending check with its target, check, owner, and next action. An engineering check may have no goal ID. Remove the section on exit from in-review.
- **Blocked**: one section while the plan is blocked. Record the cause, what ran, what would clear it, and the last passing health boundary with its coverage or `none`. Remove the section on exit from blocked.
- **Live verification**: one section for each applicable check's latest observed outcome or supported not-applicable reason. Use the [engineering gate](../engineering/acceptance-gate.md) for release evidence. Keep pending checks in In review.
- **Open findings**: one section for open findings, decisions still needed, and work the run could not do. Name each item's owner and remove its entry when resolved.

A checkpoint or final commit gate records its landed SHA on the covered step records. If migration grouped earlier copies under one heading, use the last statement for each key, including each goal verdict, Outcome, and Commit.

Put the closing `**Completed:** YYYY-MM-DD` line only at done.

## Shape diagnostics

For a result that exists, the loader reports headings outside the fixed shape, repeated keys, and missing sections required by plan status. Done requires Acceptance, in-review requires In review, and blocked requires Blocked. Only level-2 headings enter this check. Apply the separate [lifecycle requirements](./task-lifecycle.md#companion-result-file) for Current state and Completed.
