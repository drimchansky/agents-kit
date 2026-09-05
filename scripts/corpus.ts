import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MARKDOWN_SUFFIX = ".md";
export const SKILL_FILE = "SKILL.md";
const REFERENCES_DIR = "references";
const SKILLS_DIR = "skills";
const CORPUS_NAMED_FILES = ["CORE_RULES.md", "AGENTS.md"] as const;

export interface CorpusHandlers {
  readonly onSymlink: (abs: string) => void;
  readonly onUnreadable: (abs: string, code: string) => void;
  readonly onMissing: (abs: string, reason: string) => void;
}

type Presence = "file" | "missing" | "irregular" | "skipped";

const code = (err: NodeJS.ErrnoException): string => err.code ?? err.message;

function presence(abs: string, handlers: CorpusHandlers): Presence {
  let stat;
  try {
    stat = lstatSync(abs);
  } catch (err) {
    if (err.code === "ENOENT") return "missing";
    handlers.onUnreadable(abs, code(err));
    return "skipped";
  }
  if (stat.isSymbolicLink()) {
    handlers.onSymlink(abs);
    return "skipped";
  }
  return stat.isFile() ? "file" : "irregular";
}

function symlinkedRoot(abs: string, handlers: CorpusHandlers): boolean {
  let stat;
  try {
    stat = lstatSync(abs);
  } catch {
    return false;
  }
  if (!stat.isSymbolicLink()) return false;
  handlers.onSymlink(abs);
  return true;
}

function walkReferences(dir: string, found: string[], handlers: CorpusHandlers): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    handlers.onUnreadable(dir, code(err));
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      handlers.onSymlink(abs);
      continue;
    }
    if (entry.isDirectory()) {
      walkReferences(abs, found, handlers);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(MARKDOWN_SUFFIX)) found.push(abs);
  }
}

function skillFiles(root: string, found: string[], handlers: CorpusHandlers): void {
  const skillsDir = join(root, SKILLS_DIR);
  if (symlinkedRoot(skillsDir, handlers)) return;
  let entries;
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== "ENOENT") handlers.onUnreadable(skillsDir, code(err));
    return;
  }
  for (const entry of entries) {
    const abs = join(skillsDir, entry.name);
    if (entry.isSymbolicLink()) {
      handlers.onSymlink(abs);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const skillFile = join(abs, SKILL_FILE);
    if (presence(skillFile, handlers) === "file") found.push(skillFile);
  }
}

export function corpusFiles(root: string, handlers: CorpusHandlers): string[] {
  const found: string[] = [];
  const referencesDir = join(root, REFERENCES_DIR);
  if (!symlinkedRoot(referencesDir, handlers)) walkReferences(referencesDir, found, handlers);
  skillFiles(root, found, handlers);
  for (const name of CORPUS_NAMED_FILES) {
    const abs = join(root, name);
    const state = presence(abs, handlers);
    if (state === "file") found.push(abs);
    else if (state !== "skipped") handlers.onMissing(abs, state === "missing" ? "no such file" : "not a regular file");
  }
  return found.sort((a, b) => a.localeCompare(b, "en"));
}
