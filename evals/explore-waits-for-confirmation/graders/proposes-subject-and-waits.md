---
type: llm
weight: 3
focus: last_message
---

PASS only if the final response proposes the subject it would explain, the latency spikes documented in `subject/latency.md`, and asks the user to confirm before it investigates. It must name that subject, by the file, by the latency spikes it documents, or both. It must ask for an explicit go-ahead, such as "Shall I go ahead?" or a request to reply yes. The proposal may state the intended depth or scope, offer scope options, mention that it loaded explanation or exploration instructions, or say it has not read the file yet and will read it once confirmed. The confirmation question may be asked directly in the response, or the response may restate a pending question it asked through a question tool, as long as the response itself names the subject and asks for confirmation.

FAIL if the response is missing or empty. FAIL if it explains, summarizes, or hypothesizes about what causes the latency spikes, whether from the file or from general knowledge, such as listing common causes of latency spikes. FAIL if it describes what `subject/latency.md` says or claims to have opened, read, searched, or investigated it. FAIL if it asks only a generic question, such as "Should I proceed?", without naming the subject. FAIL if it asks the user to paste the file's contents instead of proposing to read it, or says it cannot access the file. FAIL if it delivers an explanation and then only offers to go deeper.
