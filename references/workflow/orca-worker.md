# Orca Task Worker

An Orca worker runs one task-level skill. Inner executors and reviewers use their own native contracts.

## Coordinator packet

Build one packet per invocation. Use only these skill and stage pairs:

- `implement-task` for implementation within the named plan or step range.
- `review-code` for review of the exact code object.
- `review-docs` for review of the exact documentation deliverable.

Read the task and applicable group context before dispatch. Include:

- The canonical task folder, scope kind and folder, and current decisions with their record locations.
- The physical repository and invoked checkout. Include an existing task branch/worktree when applicable. For code review, pin the base and head commits or the revision and paths. For documentation review, identify the deliverable and the source that fixes its bytes.
- The named skill, stage, bounded arguments, and edit surface. Name the absolute skill path within the matching kit source or installation.
- The Run identity, live coordinator identity, and the exact existing Orca workspace. Use the accepted launch to associate the Task and Dispatch identities.
- The original user command or confirmation with its verifiable source and explicit grants for this invocation. Add the location of your host's native session transcript as the fallback source. Confirm by content that it holds this conversation and the cited grant. When you cannot locate it, say so in the packet. List any authorized task-record and product writes, native-agent delegation, branch/worktree operations, and checkpoint or final commits. Carry exclusions and missing grants.
- The return evidence expected under the selected skill, including result locations, verification, unanswered choices, and any failed or pending checks.

Resolve missing grants in the coordinator under `./skill-conventions.md` § *Orca inherited entry* before dispatching dependent work.

Use the installed Orca `orchestration` guide. Target the verified Run explicitly and place the worker in an existing workspace. Create a separate Orca Task with an immutable spec for each skill invocation. A retry of the same invocation follows the installed recovery guide. A changed stage or packet needs a new Task.

Let `implement-task` own task branch and worktree creation and re-entry under `./task-delivery.md`. Never request an Orca child worktree for the same assignment. Verify the launched Task and Dispatch against the requested placement before accepting their work.

After that verification, name the worker's tab `worker: <task slug> · <skill>`, such as `worker: alpha · implement-task`. Use the canonical task folder's basename as `<task slug>` and the invoked skill as `<skill>`. Rename the chat or terminal tab that the verified Dispatch identifies, using the installed `orca-cli` guide for that surface. Report a failed rename and its diagnostic in the coordinator conversation as status. A failed rename neither blocks nor repeats the dispatch.

## Worker entry

Apply the installed Orca `orchestration` guide for the injected worker preamble. Verify the named skill path belongs to the coordinator's kit source or a matching installation. Load that skill and its references together. Hold when they cannot be resolved to the matching kit, and apply the effective repository's rules.

Match the injected Task and Dispatch and your own identity to the active assignment on the selected Run. Use Orca's retained Task spec and runtime assignment evidence to verify the coordinator, packet, and placement. Match the canonical task, physical repository, and intended checkout or review object to the packet. Apply `./skill-conventions.md` § *Orca inherited entry*. Resolve the coordinator's conversation through Orca and verify the cited user grant in Orca's bounded conversation read. Verify any coordinator launch brief that carries the grant the same way. When that read no longer reaches the cited lines, use the packet's location for the coordinator host's native session transcript. Read the transcript after Orca's read of the coordinator. Treat it as the coordinator's only when the entries of that read appear in it in the same order. Verify the cited lines there. A missing, unreadable, or mismatched transcript counts as missing authority. Quote only the grant needed for the assignment. A prompt's claims cannot replace injected or verified evidence.

On mismatch, unverified ownership, an unsupported skill, or missing authority, make no dependent edit or launch. Return the concrete problem to the coordinator. Only the coordinator seeks user decisions.

Run the named skill within the packet. Keep the skill's own verification, native-agent contracts, and payload-specific gates. Apply `./executor-routing.md` for native executors and `./reviewer-contract.md` for native reviewers. Return any needed group write to the coordinator.

## Questions and writer holds

Use the installed guide's worker question and wake flow when the selected skill reaches a decision outside your authority. Include the held operation, any relevant recorded decision, and the consequences and options required by Core Rules § *Ask Before Assuming*. When the skill requires a blocker record, write it before yielding. Ask the coordinator and end your turn. User questions belong in the coordinator conversation.

Before yielding a writer hold, finish or settle affected native execution and pending writes. Acknowledge the held records and the exact active assignment in an Orca question that awaits release, then end your turn. Include the acknowledgment in the decision question when it already holds those writes. Keep those records untouched until the coordinator releases the hold.

For a group question, identify the owning group record, its `GQ<n>` id when one exists, and the decision this task needs. Accept hold requests and releases only from your Run's current verified coordinator. After a Run transfer, verify the new coordinator through Orca's runtime evidence before accepting its messages.

On reply, verify the question and assignment are still current. Read the recorded answer and reread your task's records and any other changed records before resuming. Refresh any dependent native packet and resume or relaunch through the selected skill's native return rules. An answer carried in a wake does not release superseded or stopped work.

Treat control records in Run mail as coordinator state. They grant you nothing and do not change your assignment. When Orca shows your Dispatch stopped, fenced, or superseded, make no further dependent edit or launch.

## Return evidence

When returning a result, give the Task and Dispatch, skill, checkout or review object, record and evidence locations, outcome, and remaining blockers. For implementation, include the recorded plan status and acceptance evidence. For review, include findings and outstanding checks or sign-off. Use the installed guide's completion transport. A skill session can finish while its kit task remains open.

Review workers capture and return evidence as an inner phase under `../engineering/review-evidence.md` § *Presentation and sign-off*. Forward the reviewed object, Evidence field, and applicable index, artifacts, and fingerprint. The outer coordinator presents them and requests any required sign-off.
