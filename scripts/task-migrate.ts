#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { carriesStatusHeader, markdownLines, withoutCodeSpans } from "./goal-structure.ts";
import { holdsRoleFile, ROLE_FILES, WALK_SKIP_DIRS } from "./lifecycle-constants.ts";
import { lastResultLink, parsePlan, readPlanStatus, slugAllocator, taskState } from "./task-state.ts";
import { deliverableFileName } from "./sweep-scope.ts";

type Files = Map<string, string>;
const AMBIGUOUS_ANCHOR = Symbol("old and current records share this anchor");
type Targets = Map<string, string | null | typeof AMBIGUOUS_ANCHOR>;
interface Heading {
  title: string;
  level: number;
  anchor: string;
  line: string;
  start: number;
  end: number;
}
interface Section extends Heading {
  raw: string;
  body: string;
  children: Heading[];
}

function headings(text: string): Heading[] {
  const allocate = slugAllocator();
  const result: Heading[] = [];
  for (const line of markdownLines(text)) {
    const match = line.live && /^(#{1,6})[ \t]+(.+?)[ \t]*#*$/.exec(line.visible);
    if (!match) continue;
    const end = text.indexOf("\n", line.offset);
    result.push({
      title: match[2],
      level: match[1].length,
      anchor: allocate(match[2]) ?? "",
      line: line.text,
      start: line.offset,
      end: end === -1 ? text.length : end + 1,
    });
  }
  return result;
}

function document(text: string) {
  const all = headings(text);
  const groups = all.filter((h) => h.level === 2);
  return {
    prefix: text.slice(0, groups[0]?.start ?? text.length),
    sections: groups.map((h, i): Section => {
      const end = groups[i + 1]?.start ?? text.length;
      return {
        ...h,
        raw: text.slice(h.start, end),
        body: text.slice(h.end, end),
        children: all.filter((child) => child.start > h.start && child.start < end),
      };
    }),
  };
}

function joinBlock(first: string, next: string): string {
  if (!first || !next || /\r?\n\r?\n$/.test(first)) return first + next;
  return first + (first.endsWith("\n") ? "\n" : "\n\n") + next;
}

function digest(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex");
}

function readRegular(path: string): string {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    if (!fstatSync(fd).isFile()) throw new Error(`not a regular file: ${path}`);
    const bytes = readFileSync(fd);
    const text = bytes.toString("utf8");
    if (!Buffer.from(text).equals(bytes)) throw new Error(`not UTF-8: ${path}`);
    return text;
  } finally {
    closeSync(fd);
  }
}

function localFiles(dir: string): Files {
  const files: Files = new Map();
  function walk(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || WALK_SKIP_DIRS.has(entry.name)) continue;
      const path = join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`unsupported symbolic link: ${path}`);
      if (entry.isDirectory()) {
        if (!holdsRoleFile(readdirSync(path))) walk(path);
      } else if (entry.name.endsWith(".md")) files.set(relative(dir, path), readRegular(path));
    }
  }
  walk(dir);
  return files;
}

function snapshotName(note: string): string | undefined {
  const path = /(`?)~\/\.local\/state\/agents-kit\/compaction\/(.*)/.exec(note);
  if (!path) return;
  const name = path[1] ? /^([^`]+\.md)`/.exec(path[2]) : /^(\S+?\.md)(?=[.,;:!)\]*_]*(?:\s|$))/.exec(path[2]);
  if (name && !/[/\\\0]/.test(name[1])) return name[1];
}

class Migration {
  readonly after: Files;
  readonly external: Files = new Map();
  readonly missing = new Set<string>();
  readonly unresolvedCommits = new Set<string>();
  readonly manualLinks: { file: string; line: number; text: string }[] = [];
  readonly moved: { file: string; heading: string }[] = [];
  private readonly archived = new Map<string, Pick<Section, "start" | "title" | "raw">[]>();
  readonly links = new Map<string, Targets>();
  private readonly snapshots = new Map<string, Section[]>();
  readonly dir: string;
  readonly before: Files;
  readonly day: string;
  readonly storeRoot?: string;
  constructor(dir: string, before: Files, day: string, storeRoot?: string) {
    this.dir = dir;
    this.before = before;
    this.day = day;
    this.storeRoot = storeRoot;
    this.after = new Map(before);
  }
  archive(file: string, section: Pick<Section, "start" | "title" | "raw">) {
    const entries = this.archived.get(file) ?? [];
    if (!entries.some((entry) => entry.start === section.start && entry.raw === section.raw)) entries.push(section);
    this.archived.set(file, entries);
  }
  appendHistory() {
    let history = this.before.get("history.md") ?? "";
    for (const [file, entries] of this.archived) {
      for (const entry of entries.sort((a, b) => a.start - b.start)) {
        if (entry.start === 0 && carriesStatusHeader(entry.raw)) history = joinBlock(history, "## Archived file prefix\n");
        history = joinBlock(history, `<!-- Migrated from ${file} on ${this.day} -->\n` + entry.raw);
        this.moved.push({ file, heading: entry.title });
      }
    }
    if (this.archived.size) this.after.set("history.md", history);
  }
  snapshot(name: string): Section[] {
    if (this.snapshots.has(name)) return this.snapshots.get(name)!;
    const path = join(homedir(), ".local/state/agents-kit/compaction", name);
    if (!lstatSync(path, { throwIfNoEntry: false })) {
      this.external.set(path, "absent");
      return [];
    }
    if (realpathSync(path) !== join(realpathSync(homedir()), ".local/state/agents-kit/compaction", name))
      throw new Error(`unsupported snapshot path: ${path}`);
    const bytes = readRegular(path);
    const hash = digest(bytes);
    const prefix = /-([0-9a-f]{12})\.md$/.exec(name)?.[1];
    if (!prefix || !hash.startsWith(prefix)) throw new Error(`snapshot hash mismatch: ${path}`);
    this.external.set(path, hash);
    const sections = document(bytes).sections;
    this.snapshots.set(name, sections);
    return sections;
  }
  restore(section: Section, chain = new Set<string>()): Section {
    const notes = [...markdownLines(section.body)].filter(
      (line) => line.live && /^\s*(?:[-*]\s+)?(?:_|\*)?Compacted \d{4}-\d{2}-\d{2}\b/i.test(line.visible),
    );
    if (!notes.length) {
      if (/^Compacted\b/i.test(section.title) && /full text in git history/i.test(section.body))
        this.missing.add(section.anchor + ": no named snapshot");
      return section;
    }
    const pieces: Section[] = [];
    const remove = new Set<number>();
    for (const note of notes) {
      const name = snapshotName(note.text);
      const found =
        name && !chain.has(name)
          ? this.snapshot(name).find((s) => s.anchor === section.anchor && s.title === section.title)
          : undefined;
      if (!found || !name) {
        this.missing.add(`${section.anchor}: ${name ?? note.text}`);
        continue;
      }
      pieces.push(this.restore(found, new Set([...chain, name])));
      remove.add(note.number);
    }
    if (!pieces.length) return section;
    const kept = section.body
      .split(/(?<=\n)/)
      .filter((_, i) => !remove.has(i + 1))
      .join("");
    let body = [...new Set(pieces.map((s) => s.body))].reduce(joinBlock, "");
    const material = [...markdownLines(kept)].filter((l) => l.text.trim() && !/^\s*---\s*$/.test(l.text));
    if (
      material.some((l) => !/^#{1,6}\s/.test(l.visible) || !pieces.some((p) => p.children.some((h) => h.line === l.text))) &&
      !body.includes(kept.trim())
    )
      body = joinBlock(body, kept);
    return { ...section, body, raw: section.raw.slice(0, section.end - section.start) + body };
  }
}

function moveDecisions(m: Migration, file: string) {
  const text = m.before.get(file);
  if (text === undefined) return;
  const doc = document(text);
  const keep: Section[] = [];
  const targets: Targets = new Map();
  for (const section of doc.sections) {
    if (/^Decision[ \t]+—[ \t]+\d{4}-\d{2}-\d{2}:[ \t]+\S/.test(section.title)) {
      m.archive(file, section);
      for (const h of [section, ...section.children]) targets.set(h.anchor, null);
    } else keep.push(section);
  }
  if (!targets.size) return;
  const live = doc.prefix + keep.map((s) => s.raw).join("");
  const newHeadings = headings(live);
  const oldHeadings = headings(text).filter((h) => !targets.has(h.anchor));
  oldHeadings.forEach((h, i) => targets.set(h.anchor, newHeadings[i].anchor));
  m.links.set(file, targets);
  m.after.set(file, live);
}

const singletons = [
  "Current state",
  "Final implementation commit",
  "Acceptance",
  "In review",
  "Blocked",
  "Live verification",
  "Open findings",
];
function nativeKey(title: string): string | undefined {
  const checkpoint = /^Checkpoint after Step\s+(\d+[a-z]*)\b/i.exec(title);
  if (checkpoint) return "Checkpoint after Step " + checkpoint[1].toLowerCase();
  const step = /^Step\s+(\d+[a-z]*)\b/i.exec(title);
  if (step) return "Step " + step[1].toLowerCase();
  return singletons.find((key) => new RegExp("^" + key + "\\b", "i").test(title));
}

interface Part {
  original: Section;
  restored: Section;
}
interface RecordBlock {
  title: string;
  parts: Part[];
  notes: string[];
}
const MIGRATED_RESULT = "<!-- agents-kit: migrated task result -->";
const FINAL = "Final implementation commit";
const COMMIT_FIELD = /^[ \t]*(?:[-*+] +)?\*\*Commit:\*\*[ \t]*(.*)$/i;

function lastFieldMatch(section: Section, pattern: RegExp) {
  let field;
  for (const line of markdownLines(section.body)) {
    const match = line.live && pattern.exec(line.visible);
    if (match) field = { value: match[1].trim(), offset: line.offset };
  }
  return field;
}

function lastField(section: Section, pattern: RegExp) {
  return lastFieldMatch(section, pattern)?.value ?? "";
}

interface Gate {
  key: string;
  index: number;
  bound: number;
  sha?: string;
  ambiguous: boolean;
  recorded: boolean;
  noChange: boolean;
  outcomeQualifies: boolean;
  failed: boolean;
  handOverOffset?: number;
}

function gateCommit(value: string, pointers: string) {
  const settlement = /(?:^|\s)`?([a-f0-9]{7,40})`?\s+[—–-]\s+settled hand-over\b/i.exec(value);
  if (settlement) return { sha: settlement[1].toLowerCase(), ambiguous: false };
  const shas = [...value.matchAll(/(?:([\w./-]+)\s+)?\bSHA\s+`([a-f0-9]{7,40})`/gi)];
  const branches = [...pointers.matchAll(/\bbranch\s+`([^`]+)`/gi)];
  if (!shas.length) return { sha: undefined, ambiguous: false };
  if (shas.length === 1 && (!shas[0][1] || !branches.length)) return { sha: shas[0][2].toLowerCase(), ambiguous: false };
  if (branches.some((branch) => branch[1] !== branches[0][1])) return { sha: undefined, ambiguous: true };
  const contexts = branches.map((branch, i) => {
    const previous = branches[i - 1];
    const prefix = pointers.slice(previous ? previous.index + previous[0].length : 0, branch.index);
    return prefix.split(/[.!?]\s+/).at(-1)!;
  });
  if (!branches.length) contexts.push(pointers);
  const owners = contexts.map((context) => {
    const names = context.toLowerCase().match(/[\w./-]+/g) ?? [];
    const named = shas.filter((match) => match[1] && names.includes(match[1].toLowerCase()));
    return named.length === 1 ? named[0] : undefined;
  });
  const owner = owners[0];
  if (owner && owners.every((match) => match === owner)) return { sha: owner[2].toLowerCase(), ambiguous: false };
  return { sha: undefined, ambiguous: true };
}

type PlanStep = ReturnType<typeof parsePlan>["steps"][number];

function citesSection(step: PlanStep, section: Section): boolean {
  const link = step.link;
  return step.checked && link?.file === "result.md" && link.anchor !== null &&
    (section.anchor === link.anchor || section.children.some((child) => child.anchor === link.anchor));
}

function legacyCoverage(sections: Section[], steps: readonly PlanStep[], m: Migration) {
  const current = sections.filter((s) => nativeKey(s.title) === "Current state").at(-1);
  const pointers = current ? lastField(current, /^[ \t]*(?:[-*+] +)?\*\*Pointers:\*\*\s*(.*)$/i) : "";
  const gates: Gate[] = [];
  const byStep = new Map<string, string>();
  const noChanges = new Map<string, string>();
  const latest = new Map<string, Gate>();
  for (const [index, section] of sections.entries()) {
    const key = nativeKey(section.title);
    if (!key || (key !== FINAL && !key.startsWith("Checkpoint after Step "))) continue;
    const commit = lastFieldMatch(section, COMMIT_FIELD);
    const value = commit?.value ?? "";
    const outcome = lastField(section, /^[ \t]*(?:[-*+] +)?\*\*Outcome:\*\*\s*(.*)$/i);
    const failedOutcome = /^(?:failed|not run|open|pending|blocked)\b/i.test(outcome);
    const bound = key === FINAL ? steps.length : steps.findIndex((s) => "Checkpoint after Step " + s.number === key);
    const { sha, ambiguous } = gateCommit(value, pointers);
    const gate = {
      key,
      index,
      bound,
      sha,
      ambiguous,
      recorded: commit !== undefined,
      noChange: /^none\s+[—–-]\s+no task changes\b/i.test(value),
      outcomeQualifies: key === FINAL ? !failedOutcome : /^passed\b/i.test(outcome),
      failed: failedOutcome || /^(?:failed|not run)\b/i.test(value),
      handOverOffset: /^failed\s+[—–-]\s+handed over\b/i.test(value) ? commit?.offset : undefined,
    };
    gates.push(gate);
    latest.set(key, gate);
  }
  const settlements = new Map<string, string>();
  for (const [index, section] of sections.entries()) {
    for (const line of markdownLines(section.body)) {
      if (!line.live) continue;
      const settled =
        /^\s*(?:-\s*)?(?:\d{4}-\d{2}-\d{2}\s*[—–:-]?\s*)?\*\*Commit:\*\*\s+`?([a-f0-9]{7,40})`?\s+[—–-]\s+settled hand-over,\s*`?(Checkpoint after Step \d+[a-z]*|Final implementation commit)\b/i.exec(
          line.visible,
        );
      if (!settled) continue;
      const key = nativeKey(settled[2]);
      const gate = gates.findLast((g) => g.key === key && g.index <= index);
      if (!gate?.outcomeQualifies || gate.handOverOffset === undefined) continue;
      if (gate.index === index && line.offset <= gate.handOverOffset) continue;
      gate.sha = settled[1].toLowerCase();
      gate.failed = false;
      if (latest.get(gate.key) === gate) settlements.set(gate.key, gate.sha);
    }
  }
  const covering = (gate: Gate) => {
    if (!gate.noChange) return gate;
    return gates.filter((g) => g.index < gate.index && g.outcomeQualifies && !g.failed && (g.sha || g.ambiguous)).at(-1) ?? gate;
  };
  for (const gate of latest.values()) {
    if (gate.noChange && gate.outcomeQualifies && !gate.failed) {
      const prior = covering(gate);
      if (prior.sha) noChanges.set(gate.key, prior.sha);
      if (prior.ambiguous) m.unresolvedCommits.add(gate.key);
    }
  }
  const runs = sections.map((section, index) => ({
    section, index, key: nativeKey(section.title),
  })).filter(({ section }) =>
    !lastField(section, /^[ \t]*(?:[-*+] +)?\*\*Executed:\*\*\s*(.*)$/i).startsWith("verification-only continuation")
  );
  for (const [position, step] of steps.entries()) {
    const key = "Step " + step.number;
    const ran = runs.findLast((run) =>
      run.key === key ||
      (citesSection(step, run.section) && run.key !== FINAL && !run.key?.startsWith("Checkpoint after Step "))
    );
    if (!ran) continue;
    const candidates = [...latest.values()].filter(
      (g) =>
        g.index > ran.index &&
        g.bound >= position &&
        g.outcomeQualifies &&
        !g.failed &&
        (g.sha || g.ambiguous || g.noChange) &&
        !gates.some((later) => later.failed && later.index > g.index && later.bound >= position),
    );
    candidates.sort((a, b) => a.bound - b.bound);
    if (!candidates.length) continue;
    const proof = covering(candidates[0]);
    if (proof.ambiguous) m.unresolvedCommits.add(key);
    if (proof.sha) byStep.set(key, proof.sha);
  }
  const final = latest.get(FINAL);
  let staleFinal;
  if (final && gates.some((g) => g.failed && g.index > final.index)) staleFinal = "a subsequent gate failed.";
  else if (final?.outcomeQualifies && !final.failed && (final.sha || final.ambiguous || final.noChange) &&
    runs.some(({ section, index, key }) => index > final.index &&
      (key?.startsWith("Step ") || (!key && steps.some((step) => citesSection(step, section)))))) {
    staleFinal = "implementation continued after this gate.";
  } else if (final && !final.recorded && gates.some((g) => g.key === FINAL && g.recorded)) {
    staleFinal = "the latest attempt recorded no commit.";
  }
  return { byStep, noChanges, settlements, staleFinal };
}

function checkCurrentResult(m: Migration) {
  const state = taskState({
    taskDir: m.dir,
    planText: m.before.get("plan.md") ?? "",
    resultText: m.before.get("result.md") ?? null,
    goalsText: null,
  });
  const damage = state.structure.diagnostics.filter(({ code }) =>
    code === "missing-result-anchor" || code === "missing-result-section" ||
    code === "unknown-result-section" || code === "duplicate-result-record"
  );
  if (damage.length) {
    const reasons = damage.map(({ code, detail }) => code + ": " + detail).join("; ");
    throw new Error("current task needs lifecycle repair through /resume-task before migration: " + reasons);
  }
}

function unmarkedResultFormat(parts: Part[], steps: readonly PlanStep[]) {
  const seen = new Set<string>();
  let repeated = false;
  const legacy = parts.some(({ original, restored }) => {
    const key = nativeKey(original.title);
    if (original !== restored || /^(?:Full Run|Decision log|Reconciliation|Compacted)\b/i.test(original.title)) return true;
    if (!key) return steps.some((step) => citesSection(step, original));
    if (!key.startsWith("Step ") && key !== original.title) return true;
    if (seen.has(key)) repeated = true;
    seen.add(key);
    return false;
  });
  if (legacy) return "legacy";
  const current = parts.some(({ restored: section }) =>
    section.title === "Open findings" ||
    (nativeKey(section.title)?.startsWith("Step ") &&
      [...markdownLines(section.body)].some((line) => line.live && COMMIT_FIELD.test(line.visible)))
  );
  if (current) return "current";
  return repeated ? "legacy" : "ambiguous";
}

const KEPT_LEGACY_SECTION = /^(?:Decision log|Health boundar(?:y|ies)|Reconciliation|Compacted)\b/i;
const WAIT_LABELS = [
  { key: "Blocked", label: /^[ \t]*\*\*blocked:?\*\*/i },
  { key: "In review", label: /^[ \t]*\*\*in[ \t]+review:?\*\*/i },
];

function waitLabel(section: Section) {
  for (const line of markdownLines(section.body)) {
    const kind = line.live && WAIT_LABELS.find(({ label }) => label.test(line.visible));
    if (kind) return kind.key;
  }
}

const LATER_VERDICT_SECTION = /^(?:Reconciliation|Health boundary)\b/i;
const FINALIZATION_SECTION = /^Health boundary\b/i;
const GOAL_VERDICT = /^[ \t]*[-*+][ \t]+(G\d+[A-Za-z]*)(?:[ \t]+\(external\))?[ \t]+[—–-][ \t]+\S/;
const HEALTH_FIELD = /^[ \t]*(?:[-*+] +)?\*\*Health:\*\*/i;

function laterVerdicts(parts: Part[], acceptance: Section | undefined): string[] {
  const sources = parts.filter(({ original }) =>
    LATER_VERDICT_SECTION.test(original.title) && (!acceptance || original.start > acceptance.start)
  );
  const finalized = sources.findLast(({ original }) => FINALIZATION_SECTION.test(original.title));
  const latest = new Map<string, { part: Part; offset: number; text: string }>();
  for (const part of sources) {
    const lines = [...markdownLines(part.restored.body)];
    for (const [index, line] of lines.entries()) {
      if (!line.live) continue;
      if (HEALTH_FIELD.test(line.visible)) latest.set("Health", { part, offset: line.offset, text: line.text });
      const goal = GOAL_VERDICT.exec(line.visible);
      if (!goal || (finalized && part.original.start < finalized.original.start)) continue;
      let text = line.text;
      for (const next of lines.slice(index + 1)) {
        if (!next.live || !/^[ \t]+\S/.test(next.visible) || /^[ \t]*[-*+][ \t]/.test(next.visible)) break;
        text += "\n" + next.text;
      }
      latest.set(goal[1], { part, offset: line.offset, text });
    }
  }
  const pieces: string[] = [];
  for (const part of sources) {
    const kept = [...latest.values()].filter((entry) => entry.part === part).sort((a, b) => a.offset - b.offset);
    if (!kept.length) continue;
    const health = kept.filter((entry) => HEALTH_FIELD.test(entry.text)).map((entry) => entry.text);
    const verdicts = kept.filter((entry) => !HEALTH_FIELD.test(entry.text)).map((entry) => entry.text).join("\n");
    pieces.push("```text\n" + part.original.line + "\n```\n\n" + [...health, verdicts].filter(Boolean).join("\n\n") + "\n");
  }
  return pieces;
}

function migrateResult(m: Migration, steps: readonly PlanStep[], status: string | null) {
  const source = m.before.get("result.md");
  if (source === undefined && !steps.some((s) => s.checked)) return;
  const text = source ?? "# Result\n\n**Plan:** [./plan.md](./plan.md)\n\n";
  const doc = document(text);
  const parts = doc.sections.map((original) => ({ original, restored: m.restore(original) }));
  const marked = doc.prefix.split(/\r?\n/).includes(MIGRATED_RESULT);
  const format = marked ? "current" : unmarkedResultFormat(parts, steps);
  let coverage;
  if (format === "current") {
    checkCurrentResult(m);
  } else {
    const potential = legacyCoverage(parts.map((part) => part.restored), steps, m);
    if (format === "legacy") coverage = potential;
    else for (const key of potential.byStep.keys()) m.unresolvedCommits.add(key);
  }
  const records = new Map<string, RecordBlock>();
  const owner = new Map<Section, string>();
  const targets: Targets = new Map();
  const titles = new Map(steps.map((s) => ["Step " + s.number, "Step " + s.number + " — " + (linkText(s.title) || "Recorded work")]));
  const record = (key: string, fallback?: string) => {
    if (!records.has(key)) records.set(key, { title: titles.get(key) ?? fallback ?? key, parts: [], notes: [] });
    return records.get(key)!;
  };
  const last = new Map<string, Section>();
  for (const section of doc.sections) {
    const key = nativeKey(section.title);
    if (key) last.set(key, section);
  }
  const active = status === "blocked" ? "Blocked" : status === "in-review" ? "In review" : null;
  const labelledWait = active && !last.has(active)
    ? doc.sections.findLast((section) =>
      !nativeKey(section.title) &&
      !KEPT_LEGACY_SECTION.test(section.title) &&
      !steps.some((step) => citesSection(step, section)) &&
      waitLabel(section) === active
    )
    : undefined;
  for (const { original: section, restored } of parts) {
    const own = nativeKey(section.title);
    const cited = steps.filter((step) => citesSection(step, section));
    const key = own ?? (cited.length ? "Step " + cited[0].number : section === labelledWait ? active! : undefined);
    const stale = (own === "Blocked" || own === "In review") && (own !== active || last.get(own) !== section);
    if (!key || stale || (own === "Current state" && last.get(own) !== section)) {
      m.archive("result.md", section);
      if (restored.raw !== section.raw) m.archive("result.md", restored);
      for (const h of [section, ...section.children]) targets.set(h.anchor, null);
      continue;
    }
    owner.set(section, key);
    record(
      key,
      key.startsWith("Step ")
        ? key + " — " + (linkText(section.title.replace(/^Step\s+\d+[a-z]*\s*[—–:-]?\s*/i, "")) || "Recorded work")
        : undefined,
    ).parts.push({ original: section, restored });
  }
  const keyOfStep = (step: PlanStep) => "Step " + step.number;
  const shared = new Map<string, string>();
  for (const step of steps.filter((s) => s.checked)) {
    const key = keyOfStep(step);
    const rec = record(key);
    const section = doc.sections.find((s) => citesSection(step, s));
    const target = section && owner.get(section);
    if (target && target !== key) shared.set(key, target);
    if (!rec.parts.length && !target) rec.notes.push("No step record was kept.");
  }
  const folded = records.has("Acceptance") || status === "done" || status === "in-review"
    ? laterVerdicts(parts, last.get("Acceptance"))
    : [];
  if (folded.length) record("Acceptance");
  if (status === "done" && !records.has("Acceptance")) record("Acceptance").notes.push("No acceptance record was kept.");
  if (active && !records.has(active)) record(active).notes.push("No wait record was kept.");
  const stepKeys = [...new Set([...steps.map(keyOfStep), ...records.keys()].filter((k) => k.startsWith("Step ")))];
  const checkpointKeys = [
    ...new Set(
      [...steps.map((s) => "Checkpoint after Step " + s.number), ...records.keys()].filter((k) => k.startsWith("Checkpoint ")),
    ),
  ];
  const ordered = ["Current state", ...stepKeys, ...checkpointKeys, ...singletons.slice(1)].filter((k) => records.has(k));
  if (coverage) {
    for (const [key, sha] of coverage.settlements) {
      if (records.has(key)) record(key).notes.push("**Commit:** `" + sha + "` — settled hand-over");
    }
    for (const [key, sha] of coverage.byStep) {
      if (records.has(key)) record(key).notes.push("**Commit:** SHA `" + sha + "`");
    }
    for (const [key, sha] of coverage.noChanges) {
      if (records.has(key)) record(key).notes.push("**Notes:** Covering SHA `" + sha + "` from the last landed gate.");
    }
    if (coverage.staleFinal) record(FINAL).notes.push("**Commit:** not run — " + coverage.staleFinal);
  }
  let result = marked ? doc.prefix : joinBlock(doc.prefix, MIGRATED_RESULT + "\n");
  let completed = "";
  for (const key of ordered) {
    const rec = records.get(key)!;
    const pieces: string[] = [];
    for (const { original, restored } of rec.parts) {
      let body = restored.body;
      if (coverage && key.startsWith("Step ")) {
        body = editLines(body, (line, visible) =>
          COMMIT_FIELD.test(visible) ? line.replace(/\*\*Commit:\*\*/i, "Prior commit wording:") : line,
        );
      }
      if (key === "Current state") {
        body = editLines(body, (line, visible) =>
          /^[-* ]*\*\*Pointers:\*\*/.test(visible)
            ? line
                .replace(/(?:[,;]\s*)?\bSHA\s+[0-9a-f]{7,40}\s+\(recorded \d{4}-\d{2}-\d{2}\)/gi, "")
                .replace(/(\*\*Pointers:\*\*\s*)[,;]\s*/, "$1")
            : line,
        );
      }
      const labelled = rec.parts.length > 1 || original.line !== "## " + rec.title;
      if (labelled) body = "```text\n" + original.line + "\n```\n" + body;
      pieces.push(body);
    }
    if (key === "Acceptance") pieces.push(...folded);
    const content = pieces.reduce(joinBlock, "");
    let block = "## " + rec.title + (rec.parts[0]?.restored.raw.match(/\r?\n/)?.[0] ?? "\n") + content;
    for (const note of rec.notes) block = joinBlock(block, note + "\n");
    const completion = [...markdownLines(block)].filter((l) => l.live && /^\*\*Completed:\*\*\s+\d{4}-\d\d-\d\d/.test(l.visible));
    for (const line of completion.reverse()) {
      if (!completed && status === "done") completed = line.text;
      block =
        block.slice(0, line.offset) +
        block.slice(
          Math.min(block.length, line.offset + line.text.length + (block[line.offset + line.text.length] === "\r" ? 2 : 1)),
        );
    }
    result = joinBlock(result, block);
  }
  if (status === "done" && !completed)
    completed =
      [...markdownLines(text)].filter((l) => l.live && /^\*\*Completed:\*\*\s+\d{4}-\d\d-\d\d/.test(l.visible)).at(-1)?.text ??
      "";
  if (completed) result = joinBlock(result, completed + "\n");
  const parsed = document(result);
  const fresh = new Map(parsed.sections.map((s) => [s.title, s]));
  for (const [index, key] of ordered.entries()) {
    const rec = records.get(key)!;
    const freshSection = fresh.get(rec.title);
    if (!freshSection) {
      const previous = index > 0 ? records.get(ordered[index - 1]) : undefined;
      const opener = previous ? `section "${previous.parts.at(-1)?.original.title ?? previous.title}"` : "the text before the first section";
      throw new Error(
        `result record "${rec.title}" would be hidden because ${opener} of result.md ends inside an open code fence or HTML comment; close it in result.md and run a fresh preview`,
      );
    }
    const nested = new Map<string, string[]>();
    for (const child of freshSection.children) nested.set(child.title, [...(nested.get(child.title) ?? []), child.anchor]);
    for (const { original, restored } of rec.parts) {
      targets.set(original.anchor, freshSection.anchor);
      for (const child of restored.children) targets.set(child.anchor, nested.get(child.title)?.shift() ?? freshSection.anchor);
      if ((original.raw !== restored.raw || !result.includes(original.raw)) && source !== undefined)
        m.archive("result.md", original);
    }
  }
  for (const key of ["Current state", active]) {
    const section = key && fresh.get(key);
    if (section && targets.get(section.anchor) === null) targets.set(section.anchor, AMBIGUOUS_ANCHOR);
  }
  m.links.set("result.md", targets);
  let linked = parsed.prefix;
  const generated = new Set<number>();
  for (const [i, section] of parsed.sections.entries()) {
    linked += section.raw;
    const target = shared.get(ordered[i]);
    if (!target) continue;
    const evidence = fresh.get(records.get(target)!.title)!;
    const note = `Evidence: [${evidence.title}](#${evidence.anchor}).\n\n`;
    linked = joinBlock(linked, note);
    generated.add(linked.length - note.length);
  }
  m.after.set("result.md", repairLinks(m, "result.md", linked, generated));
  return new Map(steps.filter((s) => s.checked).map((s) => [s.number, fresh.get(records.get(keyOfStep(s))!.title)!.anchor]));
}

function editLines(text: string, transform: (line: string, visible: string, position: { number: number; offset: number }) => string): string {
  const changes: { at: number; old: string; next: string }[] = [];
  for (const l of markdownLines(text)) {
    if (!l.live) continue;
    const next = transform(l.text, l.visible, l);
    if (next !== l.text) changes.push({ at: l.offset, old: l.text, next });
  }
  for (const change of changes.reverse())
    text = text.slice(0, change.at) + change.next + text.slice(change.at + change.old.length);
  return text;
}

function* linkLabels(markup: string) {
  const ends = new Map<number, number>();
  const opens: number[] = [];
  for (const token of markup.matchAll(/\\.|[\[\]]/g)) {
    if (token[0] === "[") opens.push(token.index);
    if (token[0] !== "]") continue;
    const open = opens.pop();
    if (open !== undefined) ends.set(open, token.index);
  }
  const destination = /\((?:<([^>\n]+)>|([^()\s]+))(?:[ \t]+(?:"[^"]*"|'[^']*'))?\)/y;
  for (let open = 0; open < markup.length; open++) {
    const close = ends.get(open);
    if (close === undefined) continue;
    destination.lastIndex = close + 1;
    const match = destination.exec(markup);
    const refEnd = ends.get(close + 1);
    const end = match ? destination.lastIndex : (refEnd ?? close) + 1;
    yield { open, close, end, match, refEnd };
    if (match || refEnd !== undefined) open = end - 1;
  }
}

function linkText(markup: string) {
  let written = 0;
  let output = "";
  for (const { open, close, end, match, refEnd } of linkLabels(withoutCodeSpans(markup))) {
    if (open < written || (!match && refEnd === undefined)) continue;
    output += markup.slice(written, markup[open - 1] === "!" ? open - 1 : open) + markup.slice(open + 1, close);
    written = end;
  }
  return output + markup.slice(written);
}

function repairLinks(m: Migration, file: string, text: string, generated?: ReadonlySet<number>) {
  const review = new Set<number>();
  const redirect = (target: string, line?: number): string | null | undefined => {
    const hash = target.indexOf("#");
    if (hash < 0 || /^[a-z][\w+.-]*:|^[/~]/i.test(target)) return undefined;
    const path = target.slice(0, hash);
    try {
      const resolved = path ? relative(m.dir, resolve(m.dir, dirname(file), decodeURIComponent(path))) : file;
      const old = decodeURIComponent(target.slice(hash + 1));
      const anchor = m.links.get(resolved)?.get(old);
      if (anchor === AMBIGUOUS_ANCHOR) {
        if (line !== undefined) review.add(line);
        return undefined;
      }
      if (anchor === undefined || anchor === old) return undefined;
      return anchor === null ? null : path + "#" + anchor;
    } catch {
      return undefined;
    }
  };
  const definition = /^ {0,3}\[((?:\\.|[^\[\]\\])+)\]:[ \t]*(?:<([^>]+)>|(\S+))/;
  const labelOnly = /^ {0,3}\[((?:\\.|[^\[\]\\])+)\]:[ \t]*$/;
  const continuation = /^[ \t]*(?:<([^>]+)>|(\S+))[ \t]*(?:"[^"]*"|'[^']*'|\([^)]*\))?[ \t]*$/;
  const normalize = (id: string) => id.trim().replace(/\s+/g, " ").toLowerCase();
  const removed = new Set<string>();
  const continued = new Map<number, { target: string; destination: number }>();
  let pending: { label: string; number: number } | undefined;
  for (const l of markdownLines(text)) {
    const destination = pending && l.live && l.number === pending.number + 1 ? continuation.exec(l.visible) : null;
    if (pending && destination) {
      const pair = { target: destination[1] ?? destination[2], destination: l.number };
      continued.set(pending.number, pair).set(l.number, pair);
      if (redirect(pair.target) === null) removed.add(normalize(pending.label));
      pending = undefined;
      continue;
    }
    pending = undefined;
    if (!l.live) continue;
    const match = definition.exec(l.visible);
    if (match && redirect(match[2] ?? match[3]) === null) removed.add(normalize(match[1]));
    const bare = !match && labelOnly.exec(l.visible);
    if (bare) pending = { label: bare[1], number: l.number };
  }
  const repaired = editLines(text, (line, visible, position) => {
    if (generated?.has(position.offset)) return line;
    const pair = continued.get(position.number);
    if (pair && pair.destination !== position.number) return redirect(pair.target) === null ? "" : line;
    if (pair) {
      const next = redirect(pair.target, position.number);
      if (next === null) return "";
      if (next === undefined) return line;
      const at = visible.indexOf(pair.target);
      return line.slice(0, at) + next + line.slice(at + pair.target.length);
    }
    const def = definition.exec(visible);
    if (def) {
      const target = def[2] ?? def[3];
      const next = redirect(target, position.number);
      if (next === null) return "";
      if (next === undefined) return line;
      const at = def[0].lastIndexOf(target);
      return line.slice(0, at) + next + line.slice(at + target.length);
    }
    let written = 0;
    let output = "";
    for (const { open, close, end, match, refEnd } of linkLabels(withoutCodeSpans(visible))) {
      if (open < written) continue;
      const label = line.slice(open + 1, close);
      let start = open;
      let replacement = label;
      if (match) {
        if (file === "plan.md" && label === "result" && /^\s*-\s+\[[xX]\]/.test(visible)) continue;
        if (!line.startsWith(match[0], close + 1)) continue;
        const target = match[1] ?? match[2];
        const next = redirect(target, position.number);
        if (next === undefined) continue;
        if (next === null) {
          if (line[open - 1] === "!") start--;
        } else {
          start = close + (match[1] === undefined ? 2 : 3);
          replacement = next + line.slice(start + target.length, end);
        }
      } else {
        const ref = refEnd === undefined ? label : line.slice(close + 2, refEnd) || label;
        if (!removed.has(normalize(ref))) continue;
      }
      output += line.slice(written, start) + replacement;
      written = end;
    }
    return output + line.slice(written);
  });
  const protectedFile = deliverableFileName(file) && carriesStatusHeader(text);
  if (review.size || (protectedFile && repaired !== text)) {
    const proposed = repaired.split(/\r?\n/);
    for (const line of markdownLines(text)) {
      if (review.has(line.number) || (protectedFile && line.text !== proposed[line.number - 1]))
        m.manualLinks.push({ file, line: line.number, text: line.text });
    }
  }
  return protectedFile ? text : repaired;
}

function liftWrappedEvidence(plan: string) {
  const edits: { at: number; length: number; value: string }[] = [];
  let step = false;
  let checked: { at: number; hasLink: boolean } | undefined;
  for (const line of markdownLines(plan)) {
    if (!line.live) continue;
    if (/^#{1,6}\s/.test(line.visible)) {
      step = /^#{1,6}\s+Step\s+\d+[a-z]*\b/i.test(line.visible);
      checked = undefined;
      continue;
    }
    if (!step) continue;
    if (/^\s*-\s+\[[^\]]\]/.test(line.visible)) {
      checked = /^\s*-\s+\[[xX]\]\s+\*\*What:?\*\*/i.test(line.visible)
        ? { at: line.offset + line.text.trimEnd().length, hasLink: !!lastResultLink(line.visible) }
        : undefined;
      continue;
    }
    if (/^\s*[-*+]?\s*\*\*[\w -]+:\*\*/.test(line.visible)) checked = undefined;
    if (!checked) continue;
    const hit = lastResultLink(line.visible);
    if (!hit || !/^(?:\.\/)?result\.md#[^()\s]+$/.test(hit[1])) continue;
    const end = hit.index + hit[0].length;
    if (line.visible.slice(end).trim()) continue;
    if (!checked.hasLink) {
      edits.push({ at: checked.at, length: 0, value: " " + hit[0] });
      checked.hasLink = true;
    }
    const start = line.text.slice(0, hit.index).trimEnd().length;
    edits.push({ at: line.offset + start, length: end - start, value: "" });
  }
  for (const edit of edits.sort((a, b) => b.at - a.at)) {
    plan = plan.slice(0, edit.at) + edit.value + plan.slice(edit.at + edit.length);
  }
  return plan;
}

function migrateTask(m: Migration) {
  if (carriesStatusHeader(m.before.get("history.md") ?? ""))
    throw new Error("rename the history.md deliverable to a free task-local document name, update its references, and run a fresh preview");
  moveDecisions(m, "CONTEXT.md");
  moveDecisions(m, "plan.md");
  const plan = liftWrappedEvidence(m.after.get("plan.md") ?? "");
  if (m.after.has("plan.md")) m.after.set("plan.md", plan);
  const anchors = migrateResult(m, parsePlan(plan, []).steps, readPlanStatus(plan).status);
  for (const [file, text] of m.after) {
    if (basename(file) === "history.md" || file === "observations.md" || file === "result.md") continue;
    if (file === "spec.md") repairLinks(m, file, text);
    else m.after.set(file, repairLinks(m, file, text));
  }
  if (!anchors || !m.after.has("plan.md")) return;
  let step: string | undefined;
  let checked = false;
  const linked = editLines(m.after.get("plan.md")!, (line, visible) => {
    if (/^#{1,6}\s/.test(visible)) {
      step = /^#{1,6}\s+Step\s+(\d+[a-z]*)\b/i.exec(visible)?.[1].toLowerCase();
      checked = false;
    }
    if (!step || checked || !anchors.has(step) || !/^\s*-\s+\[[xX]\]/.test(visible)) return line;
    checked = true;
    const link = `([result](./result.md#${anchors.get(step)}))`;
    const existing = lastResultLink(visible);
    if (existing) return line.slice(0, existing.index) + link + line.slice(existing.index + existing[0].length);
    return line.trimEnd() + " " + link;
  });
  m.after.set("plan.md", linked);
}

const GROUP_FILE = "GROUP_CONTEXT.md";
const OLD_LOG = "GROUP_LOG.md";
const GROUP_HISTORY = "GROUP_HISTORY.md";
const GROUP_FILES = [GROUP_FILE, OLD_LOG, GROUP_HISTORY];
const INLINE_CODE_SPAN = /(?<!`)(`+)(?!`).*?(?<!`)\1(?!`)/g;
interface CitationDate {
  date?: string;
  maintenance?: boolean;
}

function within(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}

function taskRecordExists(path: string) {
  let parent = path;
  while (!lstatSync(parent, { throwIfNoEntry: false })) parent = dirname(parent);
  if (realpathSync(parent) !== parent) throw new Error("unsupported task record path: " + path);
  return parent === path;
}

function taskCitationDate(m: Migration, path: string, heading: string, local: boolean): CitationDate | undefined {
  const boundary = m.storeRoot ?? m.dir;
  const candidates = new Set<string>();
  if (m.storeRoot && !local && !/^(?:\.{1,2}\/|\/)/.test(path)) candidates.add(resolve(m.storeRoot, path));
  candidates.add(resolve(m.dir, path));
  if (!path.includes("..")) {
    for (const container of ["Archive", "Backlog"]) candidates.add(resolve(m.dir, container, path));
  }
  for (const target of candidates) {
    if (!within(boundary, target)) continue;
    if (!taskRecordExists(target)) {
      m.external.set(target, "absent");
      continue;
    }
    const contents = readRegular(target);
    m.external.set(target, digest(contents));
    const records = document(contents).sections.filter((s) => s.title === heading || s.anchor === heading);
    if (records.length !== 1) return undefined;
    const record = records[0];
    const date = /\b(\d{4}-\d\d-\d\d)\b/.exec(record.title)?.[1] ?? lastField(record, /^\*\*Date:\*\*\s*(\d{4}-\d\d-\d\d)\b/i);
    return { date: date || undefined };
  }
}

function groupCitation(m: Migration, text: string, log: Section[], markdownLink: boolean): CitationDate | undefined {
  if (!text.replace(INLINE_CODE_SPAN, "").trim()) return undefined;
  const linked = /^\[[^\]]*\]\(<?([^)>]+)>?\)$/.exec(text.trim());
  let value = (linked?.[1] ?? text).replaceAll("`", "").trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  if (/^[a-z][\w+.-]*:|^\/\//i.test(value)) return undefined;
  const isPath = (path: string) => !/\s/.test(path) || !!linked || /^(?:`|\.{0,2}\/)/.test(text.trim());
  const logRef = /^((?:.*\/)?GROUP_LOG\.md)\s*(?:§\s*|#)(.+)$/i.exec(value);
  if (logRef && isPath(logRef[1])) {
    const ref = logRef[2].replace(/^\*|\*$/g, "").trim();
    const entry = log.find((s) => s.title === ref || s.anchor === ref);
    const match = /^Change set\s*[—–-]\s*(\d{4}-\d\d-\d\d):\s*(.+)$/i.exec(entry?.title ?? ref);
    if (!match) return {};
    return /^(?:restructure|compaction)(?:\s+\d+)?$/i.test(match[2]) ? { maintenance: true } : { date: match[1] };
  }
  const task = /^(.+?\/(?:result|plan|CONTEXT|approaches)\.md)\s*(?:§\s*|#)(.+)$/i.exec(value);
  if (task) {
    const source = taskCitationDate(m, task[1], task[2].trim(), markdownLink || !!linked);
    if (source || isPath(task[1])) return source ?? { date: /\b(\d{4}-\d\d-\d\d)\b/.exec(task[2])?.[1] };
  }
  const shorthand = /^(.+?)\s+(result|plan|CONTEXT|approaches)(?:\.md)?\s+§\s*(.+)$/i.exec(value);
  if (shorthand) return taskCitationDate(m, shorthand[1] + "/" + shorthand[2] + ".md", shorthand[3].trim(), !shorthand[1].includes("/"));
  return undefined;
}

function matchingOpen(text: string, open: string, close: string): number {
  if (!text.endsWith(close)) return -1;
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === close) depth++;
    else if (text[i] === open && --depth === 0) return i;
  }
  return -1;
}

function citationPieces(text: string, markup: string): string[] {
  let start = 0;
  const pieces: string[] = [];
  for (const separator of markup.matchAll(/;\s*/g)) {
    pieces.push(text.slice(start, separator.index));
    start = separator.index + separator[0].length;
  }
  pieces.push(text.slice(start));
  return pieces;
}

function groupRule(m: Migration, line: string, visible: string, log: Section[]) {
  if (!/^\s*(?:[-*+]|\d+\.)\s/.test(visible)) return line;
  const markup = visible.replace(INLINE_CODE_SPAN, (span) => "x".repeat(span.length));
  const punctuation = /[.!?]$/.exec(line.trimEnd())?.[0] ?? "";
  let rule = line.trimEnd().slice(0, punctuation ? -1 : undefined);
  const dates = new Set<string>();
  let maintenance = false,
    changed = false;
  let trailing = true;
  let end = rule.length;
  while (end > 0) {
    const close = markup.lastIndexOf(")", end - 1);
    if (close < 0) break;
    trailing &&= !line.slice(close + 1, end).trim();
    const open = matchingOpen(markup.slice(0, close + 1), "(", ")");
    end = close;
    if (open < 0) continue;
    const prefix = line.slice(0, open);
    const labelStart = matchingOpen(markup.slice(0, open), "[", "]");
    end = labelStart >= 0 ? labelStart : open;
    const inner = line.slice(open + 1, close);
    const pieces = labelStart >= 0 ? [inner.replace(/^<(.+)>$/, "$1")] : citationPieces(inner, markup.slice(open + 1, close));
    const kept: string[] = [];
    let removed = false;
    for (const piece of pieces) {
      const source = groupCitation(m, piece, log, labelStart >= 0);
      if (!source) {
        kept.push(piece);
        continue;
      }
      if (trailing) {
        if (source.date) dates.add(source.date);
        maintenance ||= !!source.maintenance;
      }
      removed = true;
    }
    if (!removed) {
      trailing = false;
      if (labelStart < 0) end = close;
      continue;
    }
    changed = true;
    const suffix = rule.slice(close + 1);
    if (labelStart >= 0) {
      const label = prefix.slice(labelStart + 1, -1);
      rule = prefix.slice(0, labelStart).replace(/!$/, "") + label + suffix;
    } else if (kept.length) rule = prefix + "(" + kept.join("; ") + ")" + suffix;
    else rule = prefix.trimEnd() + suffix;
    trailing &&= labelStart < 0 && !kept.length;
  }
  if (!changed) return line;
  if (punctuation && !rule.endsWith(punctuation)) rule += punctuation;
  return rule + (!maintenance && dates.size === 1 ? " (" + [...dates][0] + ")" : "");
}

function questionBody(section: Section, maximum: bigint, eol: string): string {
  const body = section.body;
  const first = [...markdownLines(body)].find((line) => line.text.trim());
  const field = first?.live && /^( {0,3}\*\*Last id:\*\*[ \t]*GQ)(\d+)[ \t]*$/.exec(first.visible);
  if (first && field) {
    const at = first.offset + field[1].length;
    return body.slice(0, at) + maximum + body.slice(at + field[2].length);
  }
  const at = first?.offset ?? 0;
  const before = body.slice(0, at) || eol;
  return before + "**Last id:** GQ" + maximum + eol + (first ? eol : "") + body.slice(at);
}

function migrateGroup(m: Migration) {
  const old = m.before.get(OLD_LOG);
  const source = m.before.get(GROUP_FILE);
  if (source === undefined && old === undefined) return;
  const context = source ?? "# " + basename(m.dir) + "\n";
  const parsed = document(context);
  const decisions = parsed.sections.filter((s) => s.title === "Decisions");
  if (old !== undefined) {
    let history = old;
    for (const s of decisions) history = joinBlock(history, `<!-- Migrated from GROUP_CONTEXT.md on ${m.day} -->\n` + s.raw);
    const existing = m.before.get(GROUP_HISTORY);
    if (existing !== undefined && existing !== history)
      throw new Error("both group history files exist; preserve and resolve the collision before migration");
    m.after.set(GROUP_HISTORY, history);
    m.after.delete(OLD_LOG);
    m.moved.push({ file: OLD_LOG, heading: "File prefix" });
    for (const s of decisions) m.moved.push({ file: GROUP_FILE, heading: s.title });
  }
  let maximum = 0n;
  for (const text of [context, old ?? ""])
    for (const match of text.matchAll(/\bGQ(\d+)\b/g)) {
      const id = BigInt(match[1]);
      if (id > maximum) maximum = id;
    }
  const eol = context.match(/\r?\n/)?.[0] ?? "\n";
  const log = old === undefined ? [] : document(old).sections;
  let updated = parsed.prefix;
  const questions = parsed.sections.filter((s) => s.title === "Open Questions");
  if (questions.length > 1) throw new Error("multiple Open Questions sections in group file");
  for (const section of parsed.sections) {
    let body = section.body;
    if (section.title === "Decisions") body = editLines(body, (line, visible) => groupRule(m, line, visible, log));
    if (section.title === "Open Questions") body = questionBody(section, maximum, section.raw.match(/\r?\n/)?.[0] ?? eol);
    updated += section.raw.slice(0, section.end - section.start) + body;
  }
  if (!questions.length) {
    if (updated && !updated.endsWith("\n")) updated += eol;
    if (updated && !/\n\r?\n$/.test(updated)) updated += eol;
    updated += "## Open Questions" + eol + eol + "**Last id:** GQ" + maximum + eol;
  }
  m.after.set(GROUP_FILE, updated);
}

function preserveChangedSections(m: Migration) {
  for (const [file, original] of m.before) {
    if (basename(file) === "history.md") continue;
    const current = m.after.get(file);
    if (current === original) continue;
    const { prefix, sections } = document(original);
    if (prefix && !current?.startsWith(prefix)) m.archive(file, { start: 0, title: "File prefix", raw: prefix });
    for (const section of sections) {
      if (!current?.includes(section.raw)) m.archive(file, section);
    }
  }
}

function hashFiles(dir: string, files: Files, legacy: string[], storeRoot?: string) {
  const hashes = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, text]) => [path, digest(text)]);
  return digest(JSON.stringify([dir, ...(storeRoot ? [storeRoot] : []), hashes, ...legacy]));
}

function readFolder(dir: string, storeRoot?: string) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const names = entries.map((entry) => entry.name);
  const legacy = entries
    .filter((entry) => {
      if (!entry.isFile() || ROLE_FILES.includes(entry.name)) return false;
      const lower = entry.name.toLowerCase();
      return holdsRoleFile([lower]) || ROLE_FILES.some((role) => role.toLowerCase() === lower);
    })
    .map((entry) => entry.name)
    .sort();
  const group = names.some((name) => GROUP_FILES.includes(name));
  if (group && holdsRoleFile(names)) throw new Error("folder contains both group files and task roles");
  const before = group
    ? new Map(GROUP_FILES.filter((name) => names.includes(name)).map((name) => [name, readRegular(join(dir, name))]))
    : localFiles(dir);
  return { group, before, legacy, beforeHash: hashFiles(dir, before, legacy, storeRoot) };
}

function planMigration(dir: string, day: string, storeRoot?: string) {
  const { group, before, legacy, beforeHash } = readFolder(dir, storeRoot);
  const m = new Migration(dir, before, day, storeRoot);
  if (group && !legacy.length) migrateGroup(m);
  else if (!legacy.length && holdsRoleFile([...before.keys()])) {
    migrateTask(m);
    preserveChangedSections(m);
    m.appendHistory();
  }
  const changes = [...new Set([...before.keys(), ...m.after.keys()])].filter((k) => before.get(k) !== m.after.get(k));
  changes.sort((a, b) => {
    const order = (name: string) => (!m.after.has(name) ? 2 : ["history.md", GROUP_HISTORY].includes(name) ? 0 : 1);
    return order(a) - order(b);
  });
  const afterHash = hashFiles(dir, m.after, legacy, storeRoot);
  const token = day + "." + digest(JSON.stringify([beforeHash, afterHash, [...m.external].sort()])) + "." + afterHash;
  return {
    m,
    report: {
      folder: dir,
      token,
      changes,
      removed: changes.filter((name) => !m.after.has(name)),
      skipped: legacy,
      missingSnapshots: [...m.missing],
      unresolvedCommits: [...m.unresolvedCommits],
      manualLinks: m.manualLinks,
      moved: m.moved,
    },
    beforeHash,
    afterHash,
  };
}

function publish(m: Migration, changes: string[], beforeHash: string) {
  const prepared = new Map<string, string>();
  const modes = new Map<string, number>();
  const applied: string[] = [];
  const verifyDirectory = (path: string) => {
    if (realpathSync(dirname(path)) !== dirname(path)) throw new Error(`directory changed: ${dirname(path)}`);
  };
  const verify = (file: string, expected: string | undefined) => {
    const path = join(m.dir, file);
    verifyDirectory(path);
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat ? !stat.isFile() || readRegular(path) !== expected : expected !== undefined)
      throw new Error(`input changed: ${file}`);
  };
  function stage(file: string, text: string) {
    const path = join(m.dir, file);
    verifyDirectory(path);
    const temp = join(dirname(path), ".task-migrate-" + randomUUID());
    prepared.set(file, temp);
    writeFileSync(temp, text, { flag: "wx", mode: 0o600 });
    const mode = modes.get(file);
    if (mode !== undefined) chmodSync(temp, mode);
  }
  try {
    for (const file of changes) {
      const old = lstatSync(join(m.dir, file), { throwIfNoEntry: false });
      if (old) modes.set(file, old.mode & 0o7777);
      else if (file === GROUP_HISTORY && m.before.has(OLD_LOG)) modes.set(file, lstatSync(join(m.dir, OLD_LOG)).mode & 0o7777);
      else modes.set(file, 0o666 & ~process.umask());
      if (m.after.has(file)) stage(file, m.after.get(file)!);
    }
    if (readFolder(m.dir, m.storeRoot).beforeHash !== beforeHash) throw new Error("folder inputs changed before publication");
    for (const [path, hash] of m.external) {
      if (m.before.has(GROUP_FILE)) taskRecordExists(path);
      const current = lstatSync(path, { throwIfNoEntry: false });
      if (current ? !current.isFile() || digest(readRegular(path)) !== hash : hash !== "absent")
        throw new Error("source changed before publication: " + path);
    }
    for (const file of changes) verify(file, m.before.get(file));
    for (const file of changes) {
      verify(file, m.before.get(file));
      const temp = prepared.get(file);
      if (temp) {
        renameSync(temp, join(m.dir, file));
        prepared.delete(file);
      } else unlinkSync(join(m.dir, file));
      applied.push(file);
    }
  } catch (err) {
    const failures: string[] = [];
    for (const file of applied.reverse()) {
      try {
        verify(file, m.after.get(file));
        const old = m.before.get(file);
        if (old === undefined) unlinkSync(join(m.dir, file));
        else {
          stage(file, old);
          renameSync(prepared.get(file)!, join(m.dir, file));
          prepared.delete(file);
        }
      } catch (rollback) {
        failures.push(String(rollback));
      }
    }
    if (failures.length) throw new Error(`${err}; rollback needs attention: ${failures.join("; ")}`);
    throw err;
  } finally {
    for (const path of prepared.values()) if (lstatSync(path, { throwIfNoEntry: false })) unlinkSync(path);
  }
}

function main() {
  process.stdout.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code !== "EPIPE" && error.code !== "ENOTCONN") throw error;
  });
  const args = process.argv.slice(2);
  const hasRoot = args[0] === "--root";
  const rootArg = hasRoot ? args.splice(0, 2)[1] : undefined;
  const apply = args[0] === "--apply";
  if ((hasRoot && !rootArg) || args.length !== (apply ? 3 : 1))
    throw new Error("usage: node scripts/task-migrate.ts [--root <store-root>] [--apply <preview-token>] <folder>");
  if (apply && !/^\d{4}-\d{2}-\d{2}(?:\.[0-9a-f]{64}){2}$/.test(args[1])) throw new Error("invalid preview token");
  const requested = resolve(args.at(-1)!);
  if (!lstatSync(requested).isDirectory()) throw new Error("expected a regular directory: " + requested);
  const dir = realpathSync(requested);
  const storeRoot = rootArg ? realpathSync(resolve(rootArg)) : undefined;
  if (storeRoot && !within(storeRoot, dir)) throw new Error("folder is outside the selected store root: " + dir);
  const day = apply ? args[1].split(".")[0] : new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("invalid preview token");
  const planned = planMigration(dir, day, storeRoot);
  if (
    apply &&
    args[1] !== planned.report.token &&
    !(planned.report.changes.length === 0 && args[1].split(".")[2] === planned.beforeHash)
  )
    throw new Error("input or preview changed; run a fresh preview");
  if (apply && planned.report.changes.length) {
    const lock = join(dir, ".task-migrate.lock");
    const fd = openSync(lock, "wx", 0o600);
    try {
      writeFileSync(fd, String(process.pid) + "\n");
      const current = planMigration(dir, day, storeRoot);
      if (current.report.token !== args[1]) throw new Error("input changed before apply");
      publish(current.m, current.report.changes, current.beforeHash);
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
  process.stdout.write(JSON.stringify({ ...planned.report, applied: apply ? planned.report.changes : [] }) + "\n");
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error("[task-migrate] " + (err as Error).message);
    process.exitCode = 2;
  }
}
