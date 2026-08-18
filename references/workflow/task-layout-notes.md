# Task Layout: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contract — `./task-layout.md` — is the sole source of truth for behavior. Where behavior and these notes disagree, the contract wins. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why creation checks every registered root

`./task-layout.md` § *Discovery rules for skills*, the **resolve-or-create** bullet and the widened check it names. Global slug uniqueness is what makes a bare slug resolvable anywhere, and it is breakable only here, at creation: minting a second `add-csv-export` in a project root while one already exists in another registered root is what the check exists to prevent.

## Why the refusing rule withholds the listing

`./task-layout.md` § *Discovery rules for skills*, the **resolve-current-or-refuse** bullet. The listing the other two rules fall back to is what this one withholds — the steps it appends land in the plan that shipped the reviewed code, and a list of active folders is no evidence of which plan that is.
