#!/usr/bin/env node
import {
  chmodSync,
  closeSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_DIR = dirname(fileURLToPath(import.meta.url));
const CLAUDE_HOME = join(homedir(), ".claude");
const CODEX_HOME = join(homedir(), ".codex");
const HOMES: readonly string[] = [CLAUDE_HOME, CODEX_HOME];
const MARKER = ".agents-kit";
const CORE_RULES_MARKER = ".agents-kit-core-rules";
const RULE_NAME = "agents-kit-core-rules";
const RULE_FILE = `${RULE_NAME}.md`;
const HOOK_EVENT = "SubagentStart";
const HOOK_SCRIPT = `const p=require("path").join(require("os").homedir(),".claude","rules","${RULE_FILE}");process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:"${HOOK_EVENT}",additionalContext:require("fs").readFileSync(p,"utf8")}}))`;
const HOOK_ENTRY = {
  matcher: "^(Explore|Plan)$",
  hooks: [{ type: "command", command: `node -e '${HOOK_SCRIPT}'` }],
};
const BLOCK_START = "<!-- agents-kit:core-rules:start -->";
const BLOCK_END = "<!-- agents-kit:core-rules:end -->";
const AGENT_MARKER_PREFIX = ".agents-kit-";
const SKILL_STAGING_PREFIX = ".agents-kit-staging.";
const REFERENCES_STAGING_PREFIX = ".agents-kit-references.staging.";
const AGENT_EXTENSIONS = new Map([[".claude", "md"], [".codex", "toml"]]);
let skippedItems = false;

type JsonObject = { [key: string]: unknown };

const isSymlink = (path: string): boolean =>
  lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
const isFile = (path: string): boolean => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
const isDirectory = (path: string): boolean =>
  statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false;
const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function reportSkipped(message: string): void {
  console.error(message);
  skippedItems = true;
}

function touchMarker(path: string): void {
  closeSync(openSync(path, "a"));
}

function replaceFile(path: string, text: string): void {
  const target = isSymlink(path) ? realpathSync(path) : path;
  const mode = statSync(target, { throwIfNoEntry: false })?.mode;
  const temp = join(dirname(target), `.${basename(target)}.agents-kit-tmp.${process.pid}`);
  try {
    writeFileSync(temp, text, { flag: "wx", mode: mode === undefined ? 0o666 : mode & 0o777 });
    if (mode !== undefined) chmodSync(temp, mode & 0o7777);
    renameSync(temp, target);
  } finally {
    rmSync(temp, { force: true });
  }
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

function refuseConflicts(homeDir: string): boolean {
  const conflicts: string[] = [];
  const references = join(homeDir, "references");
  const coreRules = join(homeDir, "CORE_RULES.md");
  if (isSymlink(references) || (existsSync(references) && !isFile(join(references, MARKER)))) {
    conflicts.push("references/");
  }
  if (isSymlink(coreRules) || (existsSync(coreRules) && !isFile(join(homeDir, CORE_RULES_MARKER)))) {
    conflicts.push("CORE_RULES.md");
  }
  if (conflicts.length === 0) return false;
  reportSkipped(
    `Skipping ${homeDir}: user-owned ${conflicts.join(" and ")} found — kit skills resolve ./references and ../../CORE_RULES.md against install-root copies, so installing would break those skills. Move it aside and rerun.`,
  );
  return true;
}

function reclaimSkillsLink(homeDir: string, skillsDir: string): boolean {
  if (!isSymlink(skillsDir)) return true;
  const linkTarget = readlinkSync(skillsDir);
  const isThisRepo = linkTarget === REPO_DIR || linkTarget.startsWith(REPO_DIR + sep);
  if (isThisRepo || !existsSync(skillsDir) || isMovedKitClone(linkTarget)) {
    unlinkSync(skillsDir);
    return true;
  }
  reportSkipped(
    `Skipping ${homeDir}: ${skillsDir} is a symlink to ${linkTarget} — kit skills keep ../../ relative links that resolve only when skills/ is a real directory in ${homeDir}. Move it aside (or make skills/ a real dir) and rerun.`,
  );
  return false;
}

function sweepStaging(homeDir: string, skillsDir: string): void {
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
}

function installSkills(skillsDir: string): void {
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
}

function installReferences(homeDir: string): void {
  const references = join(homeDir, "references");
  const refStaging = join(homeDir, `${REFERENCES_STAGING_PREFIX}${process.pid}`);
  rmSync(refStaging, { recursive: true, force: true });
  mkdirSync(refStaging);
  touchMarker(join(refStaging, MARKER));
  cpSync(join(REPO_DIR, "references"), refStaging, { recursive: true, dereference: true });

  if (isFile(join(references, MARKER))) rmSync(references, { recursive: true, force: true });
  renameSync(refStaging, references);
  console.log("  references");
}

function installCoreRules(homeDir: string): void {
  touchMarker(join(homeDir, CORE_RULES_MARKER));
  copyFileSync(join(REPO_DIR, "CORE_RULES.md"), join(homeDir, "CORE_RULES.md"));
  console.log("  CORE_RULES.md");
}

function installRuleFile(homeDir: string): void {
  const rulesDir = join(homeDir, "rules");
  const target = join(rulesDir, RULE_FILE);
  const marker = join(rulesDir, CORE_RULES_MARKER);
  try {
    mkdirSync(rulesDir, { recursive: true });
    if (isSymlink(target) || (existsSync(target) && !isFile(marker))) {
      console.log(`  skipped (not kit-managed): rules/${RULE_FILE}`);
      reportSkipped(`Skipping the rule file: ${target} is not kit-managed. Move it aside and rerun.`);
      return;
    }
    touchMarker(marker);
    copyFileSync(join(REPO_DIR, "CORE_RULES.md"), target);
  } catch (error) {
    reportSkipped(`Skipping the rule file: ${target} could not be installed (${String(error)}). Fix the path and rerun.`);
    return;
  }
  console.log(`  rules/${RULE_FILE}`);
}

const isKitHook = (hook: unknown): boolean => isJsonObject(hook) && hook.command === HOOK_ENTRY.hooks[0].command;

function isKitHookEntry(entry: unknown): entry is JsonObject & { hooks: unknown[] } {
  return isJsonObject(entry) && Array.isArray(entry.hooks) && entry.hooks.some(isKitHook);
}

function withoutKitHooks(entry: unknown): unknown[] {
  if (!isKitHookEntry(entry)) return [entry];
  const hooks = entry.hooks.filter((hook) => !isKitHook(hook));
  return hooks.length === 0 ? [] : [{ ...entry, hooks }];
}

function installSubagentHook(homeDir: string): void {
  const settingsPath = join(homeDir, "settings.json");
  let current: string;
  try {
    current = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "{}";
  } catch (error) {
    reportSkipped(`Skipping the ${HOOK_EVENT} hook: ${settingsPath} could not be read (${String(error)}). Fix the file and rerun.`);
    return;
  }
  const refuse = (reason: string): void =>
    reportSkipped(
      `Skipping the ${HOOK_EVENT} hook: ${settingsPath} ${reason} — setup.ts rewrites the whole file from parsed JSON, so merging into it could drop your settings. Fix the file and rerun.`,
    );
  let settings: unknown;
  try {
    settings = JSON.parse(current);
  } catch (error) {
    refuse(`is not valid JSON (${String(error)})`);
    return;
  }
  const hooks = isJsonObject(settings) ? (settings.hooks ?? {}) : undefined;
  const entries = isJsonObject(hooks) ? (hooks[HOOK_EVENT] ?? []) : undefined;
  if (!isJsonObject(settings) || !isJsonObject(hooks) || !Array.isArray(entries)) {
    refuse(`does not hold an object whose hooks.${HOOK_EVENT} is a list`);
    return;
  }
  const kitIndex = entries.findIndex(isKitHookEntry);
  const userEntries = entries.flatMap(withoutKitHooks);
  const merged = userEntries.toSpliced(kitIndex === -1 ? userEntries.length : kitIndex, 0, HOOK_ENTRY);
  const next = `${JSON.stringify({ ...settings, hooks: { ...hooks, [HOOK_EVENT]: merged } }, null, 2)}\n`;
  try {
    if (next !== current) replaceFile(settingsPath, next);
  } catch (error) {
    reportSkipped(`Skipping the ${HOOK_EVENT} hook: ${settingsPath} could not be written (${String(error)}). Fix the file and rerun.`);
    return;
  }
  console.log(`  settings.json ${HOOK_EVENT} hook`);
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function withCodexBlock(current: string, block: string): string | null {
  const starts = occurrences(current, BLOCK_START);
  const ends = occurrences(current, BLOCK_END);
  if (starts === 0 && ends === 0) {
    if (current === "") return `${block}\n`;
    return `${current}${current.endsWith("\n") ? "\n" : "\n\n"}${block}\n`;
  }
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  if (starts !== 1 || ends !== 1 || end < start) return null;
  return `${current.slice(0, start)}${block}${current.slice(end + BLOCK_END.length)}`;
}

function installCodexBlock(homeDir: string): void {
  const agentsPath = join(homeDir, "AGENTS.md");
  let current: string;
  try {
    current = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
  } catch (error) {
    reportSkipped(`Skipping the core-rules block: ${agentsPath} could not be read (${String(error)}). Fix the file and rerun.`);
    return;
  }
  const block = `${BLOCK_START}\n${readFileSync(join(REPO_DIR, "CORE_RULES.md"), "utf8")}${BLOCK_END}`;
  const next = withCodexBlock(current, block);
  if (next === null) {
    reportSkipped(
      `Skipping the core-rules block: ${agentsPath} does not hold exactly one ${BLOCK_START} marker followed by one ${BLOCK_END} marker — replacing between unmatched markers could overwrite your lines. Repair or remove the markers and rerun.`,
    );
    return;
  }
  try {
    if (next !== current) replaceFile(agentsPath, next);
  } catch (error) {
    reportSkipped(`Skipping the core-rules block: ${agentsPath} could not be written (${String(error)}). Fix the file and rerun.`);
    return;
  }
  console.log("  AGENTS.md core-rules block");
}

function installAgents(homeDir: string): void {
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

function installHome(homeDir: string): void {
  if (refuseConflicts(homeDir)) return;
  const skillsDir = join(homeDir, "skills");
  if (!reclaimSkillsLink(homeDir, skillsDir)) return;
  mkdirSync(skillsDir, { recursive: true });

  console.log(`Installing into ${homeDir}:`);

  sweepStaging(homeDir, skillsDir);
  installSkills(skillsDir);
  installReferences(homeDir);
  installCoreRules(homeDir);
  installAgents(homeDir);
  if (homeDir === CLAUDE_HOME) {
    installRuleFile(homeDir);
    installSubagentHook(homeDir);
  }
  if (homeDir === CODEX_HOME) installCodexBlock(homeDir);
}

for (const home of HOMES) installHome(home);
if (skippedItems) {
  console.error("Done, but skipped homes or files were left uninstalled (see above).");
  process.exitCode = 1;
} else {
  console.log("Done.");
}
