---
name: prepare-diagram
description: Use when asked to generate a Mermaid diagram for a provided subject — a code flow or architecture in a repo, a figure for a doc, or any described process or system.
argument-hint: '[subject] [optional: diagram type, destination file]'
---

## Core Rules

1. Read `./AGENTS.md` and apply its rules — the domain-neutral core.
2. This is a **documentation-pack skill**: apply `./references/documentation/rules.md` on top of the core unconditionally — no `**Domain:**` resolution; the documentation pack is this skill's domain.

Generate an accurate, portable Mermaid diagram for the requested subject. Deliver a fenced Mermaid block in chat.

## When to Use

Use for new diagrams of flows, architecture, or described systems. Existing-diagram review/fixes belong to ordinary review, including review-docs. A larger document task retains its own deliverable workflow when invoking this skill for a figure.

## Choosing the type

Honor a requested type; mention a clearly better alternative briefly without substituting it. Otherwise name the chosen type and reason in one line:

- Process/decision/dependencies: flowchart.
- Ordered participant interactions: sequence.
- Code types/relationships: class.
- Persisted records/cardinality: ER.
- One entity's lifecycle: state.

When two readings fit, state the ambiguity and draw the one answering the question; do not combine them. For unsupported types, use `./references/documentation/mermaid-core.md` and the type's official page at <https://mermaid.js.org/>. State the missing kit sheet and rely on render validation.

## Grounding

For code subjects, open the actual modules. Every node/edge must trace to a module, symbol, or call flow read this task; cite files and relevant path:line. Apply only the grounding license in `./references/documentation/rules.md` § *Repo grounding for code-subject docs*, not engineering gates.

For described subjects, use only supplied components, steps, and actors. Name gaps instead of inventing structure.

## Generate

Apply `./references/documentation/mermaid-core.md` and the matching syntax/style sheet:

- Flowchart: `./references/documentation/mermaid-flowchart.md`.
- Sequence: `./references/documentation/mermaid-sequence.md`.
- Class: `./references/documentation/mermaid-class.md`.
- ER: `./references/documentation/mermaid-er.md`.
- State: `./references/documentation/mermaid-state.md`.

## Render-check

Validate by default because syntax errors break the delivered diagram.

1. Write scratch `.mmd` in the host's temp area.
2. Run `npx -y @mermaid-js/mermaid-cli -i <in>.mmd -o <out>.svg`; require exit 0 and non-empty SVG. Parse failure exits 1 without output.
3. Fix and rerender failures; never present a diagram whose latest render failed.
4. Remove scratch MMD/SVG files.

Unavailable tooling takes `./references/documentation/mermaid-core.md` § *Before returning a diagram*: deliver with an explicit validation-skip reason.

## Output

Every response carries a fenced ` ```mermaid ` block. Write a file only to a user-named destination; insert into or edit an existing document only when specifically requested. Keep other surfaces read-only.

Keep prose to chosen type/reason, code-source citations, validation skips, and deliberate omissions as applicable.
