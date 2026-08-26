---
name: prepare-diagram
description: Use when asked to generate a Mermaid diagram for a provided subject — a code flow or architecture in a repo, a figure for a doc, or any described process or system.
argument-hint: '[subject] [optional: diagram type, destination file]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is a **documentation-pack skill**: apply `./references/documentation/rules.md` on top of the core unconditionally — no `**Domain:**` resolution; the documentation pack is this skill's domain.

Produce a Mermaid diagram of the subject the user names — a code flow or architecture in a repository, a figure a document needs, or a process or system described in prose. The bar is a diagram that is correct about its subject, portable across whatever renderer it lands in, and styled consistently with the kit's other diagrams; the deliverable is a fenced ` ```mermaid ` block in the chat reply.

## When to Use

**Use when:** the ask is to generate a diagram of a subject — visualize this flow, draw this architecture, produce the figure for this section.

**Skip when:**

- The ask is to review or fix a diagram that already exists — that's ordinary review work (`review-docs` for a document's diagrams), not generation
- The diagram is one part of a whole document deliverable being written or staged — that doc task's own flow owns the deliverable; this skill can still be invoked to produce the figure it needs

## Choosing the type

An explicitly requested type wins: draw what was asked. If another type would clearly read better, say so in one line and still draw the requested one.

With no type named, choose from the subject's shape and **name the chosen type and the reason in one line of the response** — that line is what lets the user redirect cheaply:

- Process, decision, or dependency structure → flowchart
- Ordered interaction between participants over time → sequence
- Code types and how they relate → class
- Persisted data and how many of each record relates to another → ER
- One thing's lifecycle → state

When two readings genuinely fit, say so and draw the one that answers the user's question, rather than merging both into one diagram.

For a type no sheet covers (gantt, C4, pie, journey, …): work from `./references/documentation/mermaid-core.md` plus that type's page on <https://mermaid.js.org/>, lean harder on the render-check, and say in the response that the kit ships no sheet for that type.

## Grounding

**Code subject** — a flow, module graph, or architecture in a repository: read the actual modules before drawing. Every node and edge MUST map to a real module, symbol, or call flow you opened this task, and the response cites the files read (with `path:line` where one symbol carries the point). `./references/documentation/rules.md` § *Repo grounding for code-subject docs* is the license for engineering-style grounding here — it pulls in that grounding practice only, not the engineering pack or its gates.

**Described subject** — a process or system given in prose: structure only what you were given. Never invent components, steps, or actors to round out the picture; a thin description yields a diagram plus a named gap, not a filled-in guess.

## Generate

Load `./references/documentation/mermaid-core.md` — portability, label quoting, ID discipline, direction, size, comments, styling — plus the one sheet for the type at hand:

- flowchart → `./references/documentation/mermaid-flowchart.md`
- sequence → `./references/documentation/mermaid-sequence.md`
- class → `./references/documentation/mermaid-class.md`
- ER → `./references/documentation/mermaid-er.md`
- state → `./references/documentation/mermaid-state.md`

Follow the sheets rather than reasoning from memory — they own the syntax, the traps, and the style calls, and this file deliberately does not restate them.

## Render-check

Verification is on by default, because a parse error is invisible in chat and surfaces as a broken block in the user's document.

1. Write the diagram to a scratch `.mmd` file in the host's scratch/temp area.
2. Run `npx -y @mermaid-js/mermaid-cli -i <in>.mmd -o <out>.svg`. Pass = exit 0 plus a non-empty SVG on disk; a parse error exits 1 and writes no file.
3. Fix and re-render until it passes. **Never present a diagram whose last render-check run failed.**
4. Remove the scratch files when done.

When the tooling is unavailable, take the carve-out in `./references/documentation/mermaid-core.md` § *Before returning a diagram*: deliver anyway and state the skip and its reason — stated, never silent.

## Output

- The fenced ` ```mermaid ` block in the chat reply is the deliverable, and every response this skill produces MUST carry one.
- Write a file **only** when the user named a destination in the request. With no destination named, never write one — chat is the whole delivery.
- Never insert the diagram into an existing document, and never edit one, unless the user asked for exactly that. Everything else stays read-only.
- Keep the surrounding prose short: the chosen-type line when you chose it, the files read for a code subject, the skipped-validation note if there is one, and anything the diagram deliberately leaves out.

## Verification

Confirm the protocol invariants before finishing:

- [ ] The response carries the diagram as a fenced ` ```mermaid ` block
- [ ] The presented diagram passed a render-check, or the response states the skip and its reason
- [ ] Chosen type and reason named in one line whenever the user requested no type
- [ ] Code subject: every node and edge traces to a file you read, and those files are cited
- [ ] No file written and no existing document touched beyond a destination the user named
- [ ] Scratch `.mmd` / `.svg` files removed
