#!/usr/bin/env node
// Installs the kit into the native agent homes (~/.claude, ~/.codex): skills, references/,
// CORE_RULES.md, and each host's native agent definitions, each written beside an ownership marker so
// a later run reclaims what the kit installed and leaves everything else alone.
// Zero dependencies; Node >= 23.6.
// Run: node setup.ts
//
// Contract: stdout names each home and every item installed or skipped under it; a refused home is
// named on stderr. Exit status: 0 = every home installed, 1 = at least one home was skipped.

import {
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_DIR = dirname(fileURLToPath(import.meta.url));
const HOMES: readonly string[] = [join(homedir(), ".claude"), join(homedir(), ".codex")];

const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const AGENT_MARKER_PREFIX = ".agents-kit-";
const SKILL_STAGING_PREFIX = ".agents-kit-staging.";
const REFERENCES_STAGING_PREFIX = ".agents-kit-references.staging.";
const AGENT_EXTENSIONS = new Map([[".claude", "md"], [".codex", "toml"]]);

let skippedHomes = false;

const isSymlink = (path: string): boolean =>
  lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
const isDirectory = (path: string): boolean =>
  statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;

function touchMarker(path: string): void {
  closeSync(openSync(path, "a"));
}

function childDirectoryNames(parent: string): string[] {
  return readdirSync(parent)
    .filter((name) => !name.startsWith(".") && isDirectory(join(parent, name)))
    .sort();
}

function stagingDirs(parent: string, prefix: string): string[] {
  return readdirSync(parent)
    .filter((name) => name.startsWith(prefix))
    .map((name) => join(parent, name))
    .filter((path) => isDirectory(path));
}

// A symlinked skills dir is kit-owned (safe to reclaim) if it points at an absolute
// .../skills whose parent is a kit checkout (setup.ts + CORE_RULES.md + references/).
function isMovedKitClone(linkTarget: string): boolean {
  if (!isAbsolute(linkTarget) || basename(linkTarget) !== "skills") return false;
  const parent = dirname(linkTarget);
  return (
    isFile(join(parent, "setup.ts")) &&
    isFile(join(parent, "CORE_RULES.md")) &&
    isDirectory(join(parent, "references"))
  );
}

function installAgent(homeDir: string): void {
  const skillsDir = join(homeDir, "skills");

  // Kit skills resolve ./AGENTS.md and ./references via symlinks to install-root
  // siblings; with user-owned copies in place every installed skill would resolve
  // into non-kit content, so refuse the whole home instead of installing broken.
  const conflicts: string[] = [];
  const references = join(homeDir, "references");
  const coreRules = join(homeDir, "CORE_RULES.md");
  if (isSymlink(references) || (existsSync(references) && !isFile(join(references, MARKER)))) {
    conflicts.push("references/");
  }
  if (isSymlink(coreRules) || (existsSync(coreRules) && !isFile(join(homeDir, CORE_RULES_MARKER)))) {
    conflicts.push("CORE_RULES.md");
  }
  if (conflicts.length > 0) {
    console.error(
      `Skipping ${homeDir}: user-owned ${conflicts.join(" and ")} found — kit skills resolve ./references and ./AGENTS.md against install-root copies, so installing would leave every kit skill broken. Move it aside and rerun.`,
    );
    skippedHomes = true;
    return;
  }

  // Kit skills carry ../../ relative links (AGENTS.md, references) that resolve only
  // when skills/ is a real directory in homeDir. A symlinked skillsDir is reclaimed
  // when it's kit-owned — this repo, a dangling leftover, or a since-moved clone — and
  // refused otherwise: installing through a user's symlink would dangle every per-skill link.
  if (isSymlink(skillsDir)) {
    const linkTarget = readlinkSync(skillsDir);
    const isThisRepo = linkTarget === REPO_DIR || linkTarget.startsWith(REPO_DIR + sep);
    if (isThisRepo || !existsSync(skillsDir) || isMovedKitClone(linkTarget)) {
      rmSync(skillsDir);
    } else {
      console.error(
        `Skipping ${homeDir}: ${skillsDir} is a symlink to ${linkTarget} — kit skills keep ../../ relative links that resolve only when skills/ is a real directory in ${homeDir}. Move it aside (or make skills/ a real dir) and rerun.`,
      );
      skippedHomes = true;
      return;
    }
  }
  mkdirSync(skillsDir, { recursive: true });

  console.log(`Installing into ${homeDir}:`);

  // Leftover staging dirs go first, so an interrupt before the atomic rename self-heals.
  // references/ and CORE_RULES.md are deliberately not removed here: every installed skill
  // symlinks into them, so deleting them before the skills loop would leave every skill already
  // copied pointing at nothing for the length of the loop. Each is replaced at its own site below.
  const stale = [
    ...stagingDirs(skillsDir, SKILL_STAGING_PREFIX),
    ...stagingDirs(homeDir, REFERENCES_STAGING_PREFIX),
  ];
  for (const path of stale) rmSync(path, { recursive: true, force: true });
  for (const name of childDirectoryNames(skillsDir)) {
    const target = join(skillsDir, name);
    if (isSymlink(target)) continue; // never follow a symlinked entry (a recursive remove would hit its target)
    if (isFile(join(target, MARKER))) rmSync(target, { recursive: true, force: true });
  }

  // Each item is built under a hidden .agents-kit-staging.* dir with its marker inside, then
  // atomically renamed into place, so the visible path is never present-but-unmarked; an
  // interrupted run leaves only a staging dir, swept by the loop above.
  for (const name of childDirectoryNames(join(REPO_DIR, "skills"))) {
    const target = join(skillsDir, name);
    if (existsSync(target) || isSymlink(target)) {
      console.log(`  skipped (not kit-managed): ${name}`);
      continue;
    }
    const staging = join(skillsDir, `${SKILL_STAGING_PREFIX}${process.pid}-${name}`);
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging);
    touchMarker(join(staging, MARKER));
    // Preserve per-skill symlinks (AGENTS.md -> ../../CORE_RULES.md, references -> ../../references)
    // so they resolve to install-root siblings rather than bloating into copies. verbatimSymlinks is
    // what keeps them relative: without it cpSync rewrites each target as an absolute path into this
    // checkout, which resolves back into the repo instead of the home it was installed to.
    cpSync(join(REPO_DIR, "skills", name), staging, { recursive: true, verbatimSymlinks: true });
    renameSync(staging, target);
    console.log(`  ${name}`);
  }

  // Same staging + atomic-rename pattern as skills; references/ is symlink-free, so dereference
  // (materialize any link it does find) stays correct here.
  const refStaging = join(homeDir, `${REFERENCES_STAGING_PREFIX}${process.pid}`);
  rmSync(refStaging, { recursive: true, force: true });
  mkdirSync(refStaging);
  touchMarker(join(refStaging, MARKER));
  cpSync(join(REPO_DIR, "references"), refStaging, { recursive: true, dereference: true });
  // Removed only once its replacement is staged and ready to rename, so the window in which no
  // references/ exists is one rename wide. The removal is also what lets the rename land: renameSync
  // onto a non-empty directory fails rather than replacing it.
  if (isFile(join(references, MARKER))) rmSync(references, { recursive: true, force: true });
  renameSync(refStaging, references);
  console.log("  references");

  // No pre-delete: copyFileSync overwrites a regular file in place, and the conflict gate above
  // already refused this home if CORE_RULES.md were present without its marker. The marker is written
  // first so the payload is never present-but-unmarked.
  touchMarker(join(homeDir, CORE_RULES_MARKER));
  copyFileSync(join(REPO_DIR, "CORE_RULES.md"), coreRules);
  console.log("  CORE_RULES.md");

  // Native agent definitions. Ownership rides on the marker alone, so the sweep below is
  // marker-driven and removes each definition together with its marker: an install interrupted
  // between the two is reclaimed on the next run, while an unmarked same-named file stays the
  // user's and is skipped by the copy loop after it.
  const agentExtension = AGENT_EXTENSIONS.get(basename(homeDir));
  if (agentExtension === undefined) return;
  const agentsDir = join(homeDir, "agents");
  mkdirSync(agentsDir, { recursive: true });
  const markerNames = readdirSync(agentsDir)
    .filter((name) => name.startsWith(AGENT_MARKER_PREFIX) && isFile(join(agentsDir, name)))
    .sort();
  for (const markerName of markerNames) {
    const installed = `${markerName.slice(AGENT_MARKER_PREFIX.length)}.${agentExtension}`;
    rmSync(join(agentsDir, installed), { force: true });
    rmSync(join(agentsDir, markerName), { force: true });
  }
  const sourceNames = readdirSync(join(REPO_DIR, "agents"))
    .filter((name) => !name.startsWith(".") && name.endsWith(`.${agentExtension}`))
    .sort();
  for (const sourceName of sourceNames) {
    const source = join(REPO_DIR, "agents", sourceName);
    if (!isFile(source)) continue;
    const name = basename(sourceName, `.${agentExtension}`);
    const target = join(agentsDir, sourceName);
    if (existsSync(target) || isSymlink(target)) {
      console.log(`  skipped (not kit-managed): agents/${name}`);
      continue;
    }
    touchMarker(join(agentsDir, `${AGENT_MARKER_PREFIX}${name}`));
    copyFileSync(source, target);
    console.log(`  agents/${name}`);
  }
}

for (const home of HOMES) installAgent(home);
if (skippedHomes) {
  console.error("Done, but skipped homes were left uninstalled (see above).");
  process.exitCode = 1;
} else {
  console.log("Done.");
}
