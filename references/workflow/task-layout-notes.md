# Task Layout: Maintainer Notes

> **Non-normative.** These are maintainer notes, **not loaded at run time**. The runtime contract — `./task-layout.md` — is the sole source of truth for behavior. Where behavior and these notes disagree, the contract wins. Notes cite rules; they never restate them.

Each entry names the contract section it annotates and records the reasoning behind that section's rule, so a future edit can tell a deliberate trade-off from an accident.

## Why creation checks every registered root

`./task-layout.md` § *Discovery rules for skills*, the **resolve-or-create** bullet and the widened check it names. Global slug uniqueness is what makes a bare slug resolvable anywhere, and it is breakable only here, at creation: minting a second `add-csv-export` in a project root while one already exists in another registered root is what the check exists to prevent.

Why the same bullet says the check binds *every* member rather than leaving it to each: `decompose-task` mints a folder per part with no uniqueness test of its own (`./decomposition.md` § *Materialization contract*, whose step 1 cites the check rather than restating why). Without the binding, the destination precedence would let a part mint a duplicate slug into a registered root — the one member where a single run can break uniqueness several times over.

## Why the refusing rule withholds the listing

`./task-layout.md` § *Discovery rules for skills*, the **resolve-current-or-refuse** bullet. The listing the other two rules fall back to is what this one withholds — the steps it appends land in the plan that shipped the reviewed code, and a list of active folders is no evidence of which plan that is.

## Why a registered root is not automatically a destination

`./task-layout.md` § *Destination paths*, the **A matched project area** rule and the precedence step it occupies. Three trade-offs in it were deliberate.

The occupancy test counts task folders under `Archive/` and `Backlog/`. Requiring a *live* task instead would read a project that has finished everything it ever started as a project whose tasks don't live there — backwards, since an archive is the strongest evidence the area has been used rather than the weakest.

The confirmation is gated on the project-local canonical root already holding a task because that is the only state in which both roots are demonstrably in use and the question is real. Asking on an unambiguous match with a canonical root holding none would put a prompt in front of the first task of every project the registry already describes, which is the cost that would make the rule not worth having.

The notice prints the absolute destination rather than the area name because the match is a case-insensitive basename compare. What it can get wrong — an area named for a different project that happens to share a basename — is invisible in the area name alone; the absolute path is what a reader can check against the checkout they are in.
