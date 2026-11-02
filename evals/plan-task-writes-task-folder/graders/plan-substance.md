---
type: llm
weight: 3
focus: { source: file, path: .agents/tasks/add-csv-export/plan.md }
---

The file is an implementation plan for adding CSV output to the `timelog` command-line tool's `export` command, as `timelog export --format csv`. It is a plan only; nothing has been implemented yet.

PASS only if all of these hold:

- The plan's steps are specific to this tool: they name its files, such as `src/format.js`, `src/cli.js`, the test files, and `README.md`, or its concrete commands and behaviors.
- Taken together, the steps cover all four concerns: serializing entries as CSV; handling `--format csv` in the export command, including the unsupported-format error; automated tests for that behavior; and documenting the CSV format in the README. One step may cover several concerns. A step may cite the task's CONTEXT.md for detailed rules such as quoting instead of restating them.
- Every step has a concrete verification: a named test command such as `npm test` or `node --test`, a specific CLI invocation with its expected output or exit status, or a specific check of the README content.
- Steps are still open checklist items (`- [ ]`); none is marked done.

FAIL if the file is missing or empty, or if the plan is generic enough to fit any feature in any project. FAIL if it omits any of the four concerns, gives only vague verification such as "make sure it works", or describes the change as already implemented. FAIL if it plans work the task rules out: an `--output` file option, CSV import, a byte-order mark, or locale-specific delimiters.
