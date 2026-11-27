# Task writes

## Evidence and consent

Apply the [result format check](./task-layout.md#result-format-before-writing) before any task write, including a same-turn update outside a skill. Use the post-loader task state and [the file authorship rules](./task-authorship.md). Report loader repairs once and retain the same baseline for the run. An explicit read-only request suppresses all task writes. Leave a skipped plan and its files alone unless the user authorizes a revive under [Task lifecycle](./task-lifecycle.md).

Apply obvious fixes, evidence-settled corrections, prior decisions, and routine judgments within the run's authorized scope. Apply [the invocation gate](./skill-conventions.md#the-invocation-gate) for model-invoked and inherited runs. Before an unresolved impactful choice, follow [Ask Before Assuming](../../CORE_RULES.md#ask-before-assuming). Hold its dependent edit and continue independent work. Record the unresolved question at its home, with researched options, consequences, any preference already given, and a recommendation. Use context for grounding and the plan for execution.

For a same-turn update outside a skill, use the established task and the user's settled answer or decision as its basis. Record it at its live home and append the decision to task history in this turn. Apply [Task progress](./task-progress.md) to each step checkbox, goal verdict or Status change. A conversational claim supplies no verification. Refresh Current state and Open findings from the evidence as below.

Base edits on what the run learned. Follow claim citations as needed to prove those claims. Follow an explicit source check's scope for a review of cited external sources.

## Write at the owning surface

Place each fact under [One home per fact](./one-home.md). Put a new relevant reference in context with its label, URL, and purpose. Replace the settled question at its home with the current rule and a one-line reason. Append the full decision under [Task history](./task-history.md). Keep approach evidence under [the approach owner](./task-approaches.md) and route a changed selection to that owner.

For plan content, change a Verify line, scope, goal citation, or restated grounding within the finding that establishes the change. Keep the delivered and deferred goal partition total. Preserve existing step numbers. Use suffixed numbers for an authorized insertion. Route redesign to plan-task.

Keep deliverables and their Published lines byte-for-byte. Refer missing or divergent deliverable content to its implementation owner and a stale Published line to the user. Route evidence about an active pause through the progress gate below. Leave group URLs unannotated.

## Grounding corrections

Correct the statement the evidence disproves. Preserve other text. Apply this rule to context direction, scope, assumptions and exclusions, plan scope and criteria, and goals. When inherited grounding and a local statement disagree, identify both with their sources. Cite the group file by its path from the selected root. Apply settled precedence or leave the unresolved choice at its home.

Use [the durable goal ID rules](./task-goals.md) when adding or retiring a goal. A semantic edit leaves that goal awaiting a later run's verification. An identifier-only repair that completed without unresolved structure preserves the wording and can be graded in the same run. A marker-only settlement that preserves the acceptance outcome keeps the prior verdict.

Record each judged decision with its basis and alternatives. Include the prior and new wording for a changed goal or ask as required by the history entry. For other grounding corrections, preserve the two statements and the evidence in that entry when the judgment turns on their wording.

## Ticket and group corrections

Require evidence that the request or shared constraint changed. Preserve the ask when the work falls short. Route newly uncovered criteria and changes that require redesign to plan-task.

Name the ticket section or selected-root-relative group path in the decision's Source. For content edits, record the prior and new wording. A broken ticket link takes the annotation rule below. When correcting a group Decisions line, end it with the date the rule was set. Keep the evidence in the task history and leave history and task-record citations off the line under the [group file contract](./task-store.md#shared-group-context-optional).

## Reference changes

On context References or Open Questions, plan steps or Open Questions, and ticket citing lines, replace a known redirect with its target. For a newly observed broken link, append `— _broken as of YYYY-MM-DD (404)_`, substituting the actual date and failure. Refresh the date when the failure changes. Keep a correct existing annotation.

If a result pointer changes or goes away, retain its identifier and add the dated change. A head move updates the pointer, and a new build can invalidate a pending verification source. A PR merge, closure, missing reference, or cleared blocker can change the next action. Prove any progress independently. For a link cited on more than one surface, apply each surface's own write permission.

If observed requester wording changes an ask, apply the ticket terms. If a source disproves grounding, apply the grounding terms. A page that answers a question takes the answer rule. Carried observations create no new annotation.

## Result and open findings

Use [Task result](./task-result.md) for each live record. Create a result when the lifecycle requires one or execution evidence warrants one. Keep a decision about unstarted work in its live file and task history. A loader repair alone creates no result.

Refresh Current state at the end of task writes from verified facts and the resulting plan status. Include confirmed delivery changes after completion and keep them distinct from accepted scope. Record the next action that remains or `none`. Follow [Task progress](./task-progress.md) for each checkbox, goal verdict, status, or verification change.

Record open findings in the result when it exists. Name each finding or goal, its evidence, its owner, and the next action. Keep unresolved choices with their options at their live home. Re-report flag-only findings and unanswered choices while they remain open. Name the missing check or capability if verification cannot run. Remove an entry when the owner resolves it or evidence disproves it.

## Change list

Keep the brief or assessment that prompted edits as the pre-edit report. After applying the authorized fixes and refreshing Current state, list the files and sections changed. Name the finding or evidence that justified each edit. Report loader repairs by the affected files and mappings, and mention each still-open item with its owner. When a change belongs to the user, supply the text to apply. If nothing changes, say so.
