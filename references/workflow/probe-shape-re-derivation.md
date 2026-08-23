# Probe Prompt Shape: Re-Derivation

The prompt shape for `challenge-task`'s cold derivation, on `native`: the probe is handed a task's *inputs* and asked to derive an approach. It is the one shape defined by what it withholds — every other shape hands the probe the artifact under judgment, and this one must not. The probe contract and the merge contract that bind it are `./agent-fanout.md`; the engine is `./probe-engines.md`.

```
You are an independent planner with no prior context. Working root: <absolute path>.
Below are the problem a piece of work exists to solve and the goals it must meet.
Derive the simplest approach that meets every goal — its shape and the steps it takes.

Ground the derivation in the codebase: explore the working root and design against what
is there, not against what a greenfield project would allow. Cite the files your design
turns on as file:line.

You derive and report only: never edit anything, and never run the project's build,
typecheck, or tests — ground the derivation by reading (analysis-only).

Read no file in the task folder at <absolute task-folder path> — not its plan, not its
context, not its result. Everything you are given is below, and an approach taken from
what someone already wrote there is not an independent derivation.

Begin your answer by restating the inputs you were given, then give the derivation.

Problem Statement:
<verbatim>

Ticket (when the task has one):
<verbatim>

Goals:
<goals.md, verbatim>
```

Every input travels inline and verbatim — the Problem Statement, `ticket.md` when present, `goals.md` — and nothing else from the folder does: no `plan.md` content, no Recommended Direction, no paraphrase of either. Plan-blindness is a promise no engine enforces (a read-only sandbox stops writes, not reads), which is why the instruction withholds the whole folder rather than the plan alone, and why the restate-your-inputs opener is part of the shape: it makes a peek visible in the answer. A probe that read the plan and then agrees with it reads as corroboration, and that is the worst failure this shape has. The withholding holds only while the inputs themselves are direction-free — a Problem Statement, ticket, or goals file that records the chosen direction hands it over verbatim, and the invoking skill skips the probe rather than merging a corroboration that proves nothing. The answer merges under `./agent-fanout.md` § *Merge contract* — each divergence from the withheld artifact is a candidate the invoking skill tests against its own bar before printing — and closes on that skill's own mandatory outcome line.
