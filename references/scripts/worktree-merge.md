# `scripts/worktree-merge.ts`

Performs the coordinator-side worktree merge gates defined by
`../workflow/parallel-batch.md` § *Coordinator-side parallel batch* — the raw delta against
the batch baseline, the surface check that bounds it, the verified incorporation, and the removal
that refuses until the incorporation has been proved to land. Its `baseline` and `check` also serve
the intake's surface check for a serially delegated shared-tree unit
(`../workflow/executor-contract.md` § *Write-mode routing*).

```
node scripts/worktree-merge.ts baseline <tree> --out <manifest> [--prune <path>]...
node scripts/worktree-merge.ts check <worktree> --baseline <manifest> --surface <path>...
                               [--prune <path>]...
node scripts/worktree-merge.ts apply <worktree> --baseline <manifest> --into <tree>
                               --surface <path>... --receipt <file> [--prune <path>]...
node scripts/worktree-merge.ts remove <worktree> --receipt <file>
node scripts/worktree-merge.ts discard <worktree>
```

**Contract.** stdout carries the delta and the outcome, one path per line, and the run exits 0 when it
did the job. Exit 1 is an outcome the script decided — a surface escape, a conflict, an incorporation
that did not verify, a removal with no verified receipt or of repository content — reported on stderr
with nothing further attempted. Exit 2 is a run that could not be carried out at all: bad usage, an
unreadable tree, a manifest that will not parse, a tree that cannot be measured the way the manifest
was — all of them before anything is written, since once `apply` has copied, a measurement that will
not run is an incorporation that did not verify and takes exit 1, naming the landed/did-not-land split
as uncomputable rather than reporting one it never measured. "An unreadable tree" there means the
root, or a subdirectory the repository does not ignore; one it ignores is deferred rather than
fatal. Whether it is ignored cannot be asked until the walk has its own path list, so an unreadable
subdirectory is held until the walk finishes and refused only if `check-ignore` does not name it —
refusing sooner would fail the run on exactly the trees the ignore filter exists to remove, and
that tolerance is what makes the caller-facing rule that a git-ignored path outside every declared
surface needs no `--prune` safe to follow (`../workflow/parallel-batch.md`
§ *Coordinator-side parallel batch*).

**Why a script and not shell.** The gates are ordered, and the ordering is the whole protection. Shell
re-authored per run is where a worktree gets removed before the copy that was supposed to precede it
has been proved — the failure this file exists to make structurally impossible. `apply` writes its
receipt only after re-reading every path it wrote and matching it against the worktree's content, and
`remove` refuses any worktree whose receipt does not carry that verification. A failed copy therefore
leaves no receipt, and a worktree with no receipt cannot be removed — except through `discard`, which
is how a worktree that never earned one (surface-escaping, hung, failed) goes.

**Manifests carry hashes, never content**, so this script **detects and verifies but never
reconstructs**. The "restore that exact capture" step the cited file names on a conflicting
incorporation is deliberately not here: it needs the bytes, and the coordinator owns it. What the
script gives a restore instead is exactness about what happened — the applied set, and on a
verification failure either the precise split between the paths that landed and the paths that did
not, or, where the measurement itself could not run, the statement that there is no split to give.

**A `baseline` manifest serves four roles**: the two the cited file needs — the batch baseline every
unit's change set is measured against, and the exact pre-unit capture of the shared tree taken at a
unit's ordered position — the pre-launch capture the intake's surface check compares a serially
delegated unit's return against (`../workflow/executor-contract.md` § *Write-mode routing*),
and the health-boundary reference of `../engineering/boundary-scope.md` § *Reference and
delta*, whose delta a later `check` against that manifest computes. They are the same operation on a
different tree at a different moment, so a change to what `baseline` captures or what `--prune`
hides reaches all three.

**Git-ignored content.** On a Git checkout every walk drops the untracked paths the repository
ignores, and the manifest records `gitignore` so both sides of a comparison measure alike — a tree
that cannot reproduce a `gitignore: true` measure is refused rather than compared against one. Seeding
a worktree with `git worktree add` carries no ignored file across, so measuring them reads each of the
shared tree's own (`.DS_Store`, editor and agent settings) as a deletion escaping the unit's surface,
and each of the worktree's build output as an addition. Tracked content is unaffected: `check-ignore`
lists ignored *untracked* paths only, so a force-added file matching an ignore pattern stays measured.
Each side asks its own index, and a worktree's index is HEAD, so a path the baseline measured stays
measured on the other side whatever that index says: a force-add staged but not yet committed is
tracked in the shared tree and an ignored untracked file in its worktree, and filtering both alike
would read it as a deletion that `apply` then carries out.

What the filter must never do is drop a path quietly enough that work goes missing under a verified
receipt. A path this walk dropped — one the worktree holds and the ignore filter removed — that sits
inside the unit's **declared surface** and whose content differs from the shared tree's is reported as
`ignored <path> NOT MEASURED`, counted in the `ignored-divergent` trailer, and refused by `apply`
before it writes anything: the unit was told to write there, so the difference is its own output, and
incorporating around it would report `verified` over the loss and clear `remove` to take the worktree
holding the only copy. The reverse direction needs no check — an ignored path the shared tree holds
and the worktree does not is a seeded worktree's steady state. Outside the surface nothing is
examined; a same-tree comparison reads every path against itself and never diverges.

**Prunes and tracked content.** A `--prune` filters the baseline as well as the current walk, so a
pruned path can never appear in a change set at all. That is what makes it right for tool state and
wrong for anything the project tracks — a committed bundle, a checked-in generated client, a
zero-installs cache. Callers name only untracked paths, and only those the ignore rules do not already
cover *outside every declared surface*. Inside one, an ignored path the worktree holds and the shared
tree does not is `ignored-divergent` and refuses the `apply`, and a `--prune` is the remedy: it skips
the path before the walk makes it a leaf. What remains to name: output a project neither tracks nor
ignores, and any tree outside a checkout, where there is nothing to ask. The caller-facing rule and
its consequences live with each role (`../engineering/boundary-scope.md` § *Reference and
delta*, `../workflow/parallel-batch.md` § *Coordinator-side parallel batch*).

`.git` and `node_modules` are pruned by name at every depth, whatever their type: `.git` is a
directory in a main checkout and a file in a linked worktree, `node_modules` an installed tree that
seeding links rather than copies. A `--prune` is different: a root-relative path hiding that path
alone, so `--prune cache` for a tool-state directory at the root cannot also hide a unit's edits under
`src/cache`. A prune that resolves outside the root, or to the root itself, is a usage error rather
than a silently empty filter.

**What an entry is.** Symlinks are recorded by their target and never followed. A directory is not
itself an entry — the contract measures paths whose content, presence, or absence differs, and an
empty directory carries none of the three — so a file the unit turned into a directory reads as
deleted, exactly as the manifest has it. Deletions are applied before writes, so a directory's
baseline descendants are gone before anything the unit put at that directory's path is installed
there, and the copy clears whatever holds a path before writing it. A path whose ancestor below the
shared root is a symlink the change set is not itself removing is refused outright. An absolute
link into the transient worktree is re-pointed at the same path under the shared tree, since it
would otherwise dangle once that worktree is removed.

A directory is never an entry, so a deletion that empties one leaves it standing. A copy that
completed without error is therefore followed by a pass that takes those directories off the shared
tree: from each deleted path's parent it climbs toward the root, deepest-first, so a directory goes
only after whatever it held, stopping at the first ancestor that is non-empty, that is not a plain
directory, or that lies outside the unit's declared surface — the surface bounds this cleanup as it
bounds every other write. A copy that failed returns before the pass, leaving the tree's shape to the
restore. The pass swallows its own errors, a directory that will not go being cosmetic rather than a
failed merge, and what it removes appears in no delta line and no receipt entry, since both carry
entries alone.

**Removal.** A linked worktree carries `.git` as a file and goes through Git; a plain scratch
directory carries none and is removed directly. A `.git` directory is a checkout, and the one thing
this never removes — and a Git refusal is reported as one, never turned into a recursive delete. A
plain directory inside a checkout is repository content and is refused: the recursive delete is the
only removal with nothing but a path behind it. `remove` re-checks presence, not hashes: the receipt
already carries the exact verification, and a path a later ordered unit legitimately rewrote must not
read as a failure.
