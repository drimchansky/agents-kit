#!/usr/bin/env node
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
  unlinkSync,
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

  if (isSymlink(skillsDir)) {
    const linkTarget = readlinkSync(skillsDir);
    const isThisRepo = linkTarget === REPO_DIR || linkTarget.startsWith(REPO_DIR + sep);
    if (isThisRepo || !existsSync(skillsDir) || isMovedKitClone(linkTarget)) {
      unlinkSync(skillsDir);
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

  const stale = [
    ...stagingDirs(skillsDir, SKILL_STAGING_PREFIX),
    ...stagingDirs(homeDir, REFERENCES_STAGING_PREFIX),
  ];
  for (const path of stale) rmSync(path, { recursive: true, force: true });
  for (const name of childDirectoryNames(skillsDir)) {
    const target = join(skillsDir, name);
    if (isSymlink(target)) continue;
    if (isFile(join(target, MARKER))) rmSync(target, { recursive: true, force: true });
  }

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

    cpSync(join(REPO_DIR, "skills", name), staging, { recursive: true, verbatimSymlinks: true });
    renameSync(staging, target);
    console.log(`  ${name}`);
  }

  const refStaging = join(homeDir, `${REFERENCES_STAGING_PREFIX}${process.pid}`);
  rmSync(refStaging, { recursive: true, force: true });
  mkdirSync(refStaging);
  touchMarker(join(refStaging, MARKER));
  cpSync(join(REPO_DIR, "references"), refStaging, { recursive: true, dereference: true });

  if (isFile(join(references, MARKER))) rmSync(references, { recursive: true, force: true });
  renameSync(refStaging, references);
  console.log("  references");

  touchMarker(join(homeDir, CORE_RULES_MARKER));
  copyFileSync(join(REPO_DIR, "CORE_RULES.md"), coreRules);
  console.log("  CORE_RULES.md");

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
