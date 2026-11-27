import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { corpusFiles } from "../scripts/corpus.ts";

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

const ROLE_EXAMPLES = new Set([
  "./CONTEXT.md",
  "./goals.md",
  "./plan.md",
  "./result.md",
  "./ticket.md",
  "./approaches.md",
  "./observations.md",
  "./adr.md",
]);

const TASK_ROLE_BASENAMES = new Set([
  "CONTEXT.md",
  "goals.md",
  "plan.md",
  "result.md",
  "ticket.md",
  "approaches.md",
  "observations.md",
  "adr.md",
  "rfc.md",
  "GROUP_CONTEXT.md",
  "GROUP_LOG.md",
  "DECISIONS.md",
  "DOC_CONVENTIONS.md",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "MEMORY.md",
]);

interface HeadingInfo {
  readonly titles: readonly string[];
  readonly anchors: ReadonlySet<string>;
}

interface CorpusSnapshot {
  readonly docs: ReadonlyMap<string, string>;
  readonly skills: ReadonlySet<string>;
  readonly existsOnDisk?: (relPath: string) => boolean;
}

function toPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

function stripFences(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let fence: { ch: string; len: number } | null = null;
  for (const line of lines) {
    const match = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence !== null) {
      out.push("");
      if (match && match[1][0] === fence.ch && match[1].length >= fence.len && line.trim().slice(match[1].length).trim() === "") {
        fence = null;
      }
      continue;
    }
    if (match) {
      fence = { ch: match[1][0], len: match[1].length };
      out.push("");
      continue;
    }
    out.push(line);
  }
  return out;
}

function slugifyHeading(title: string): string {
  return title
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/ /g, "-");
}

function extractHeadings(text: string): HeadingInfo {
  const titles: string[] = [];
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  for (const line of stripFences(text)) {
    const match = /^#+\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const title = match[1];
    titles.push(title);
    const base = slugifyHeading(title);
    let slug = base;
    if (anchors.has(slug)) {
      let n = counts.get(base) ?? 1;
      while (anchors.has(`${base}-${n}`)) n += 1;
      slug = `${base}-${n}`;
      counts.set(base, n + 1);
    } else {
      counts.set(base, 1);
    }
    anchors.add(slug);
  }
  return { titles, anchors };
}

function isPlaceholderHeading(heading: string): boolean {
  return heading.includes("<") || heading.includes("*") || heading === "..." || heading === "…";
}

function matchesHeading(titles: readonly string[], heading: string): boolean {
  return titles.some((title) => title === heading || title.startsWith(`${heading} (`));
}

function resolveDocPath(fromRel: string, target: string): string {
  const normalized = toPosix(target);
  if (normalized.startsWith("./") || normalized.startsWith("../")) {
    const fromDir = posix.dirname(fromRel);
    const joined = posix.normalize(fromDir === "." ? normalized : posix.join(fromDir, normalized));
    if (joined.startsWith("skills/")) {
      const parts = joined.split("/");
      if (parts.length >= 4 && parts[2] === "references") {
        return posix.join("references", ...parts.slice(3));
      }
    }
    return joined;
  }
  return posix.normalize(normalized);
}

function maskConventionsTemplate(rel: string, line: string): string {
  if (rel !== "references/workflow/skill-conventions.md") return line;
  return line.replace(/``.*?``/g, "");
}

function isConfirmGatedRosterLine(rel: string, line: string, skills: ReadonlySet<string>): boolean {
  if (rel !== "references/workflow/skill-conventions.md") return false;
  const match = /^- `([a-z0-9-]+)` — /.exec(line);
  return match !== null && skills.has(match[1]) && line.includes("§ *");
}

function buildHeadingIndex(docs: ReadonlyMap<string, string>): Map<string, HeadingInfo> {
  const index = new Map<string, HeadingInfo>();
  for (const [rel, text] of docs) {
    index.set(rel, extractHeadings(text));
  }
  return index;
}

function checkLinksAndPaths(snapshot: CorpusSnapshot): string[] {
  const headingIndex = buildHeadingIndex(snapshot.docs);
  const hasPath = (rel: string): boolean => snapshot.docs.has(rel) || (snapshot.existsOnDisk?.(rel) ?? false);
  const failures: string[] = [];

  for (const [rel, text] of snapshot.docs) {
    const ownHeadings = headingIndex.get(rel)!;
    const lines = stripFences(text);

    for (let i = 0; i < lines.length; i++) {
      const line = maskConventionsTemplate(rel, lines[i]);

      for (const match of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const href = match[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.includes("<") || href.includes("*")) continue;
        if (href.startsWith("#")) {
          const frag = href.slice(1);
          if (!ownHeadings.anchors.has(frag)) {
            failures.push(`${rel}:${i + 1} broken anchor ${href}`);
          }
          continue;
        }
        const hashIdx = href.indexOf("#");
        const filePart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
        const frag = hashIdx >= 0 ? href.slice(hashIdx + 1) : undefined;
        if (ROLE_EXAMPLES.has(filePart)) continue;
        if (!filePart.startsWith("./") && !filePart.startsWith("../") && !filePart.startsWith("skills/") && !filePart.startsWith("references/")) {
          continue;
        }
        const resolved = resolveDocPath(rel, filePart);
        if (!hasPath(resolved)) {
          failures.push(`${rel}:${i + 1} missing link target ${href} (resolved ${resolved})`);
          continue;
        }
        if (frag && resolved.endsWith(".md")) {
          const targetHeadings = headingIndex.get(resolved);
          if (!targetHeadings || !targetHeadings.anchors.has(frag)) {
            failures.push(`${rel}:${i + 1} broken link anchor ${href} in ${resolved}`);
          }
        }
      }

      for (const match of line.matchAll(/`((?:\.\.?\/|skills\/|references\/)[^`\s]+\.(?:md|ts|json|yaml|toml|sh)|(?:CORE_RULES|AGENTS)\.md)`/g)) {
        const rawPath = match[1];
        if (rawPath.includes("<") || rawPath.includes("*") || rawPath.includes("…")) continue;
        if (ROLE_EXAMPLES.has(rawPath) || rawPath === "AGENTS.md") continue;
        const resolved = resolveDocPath(rel, rawPath);
        if (!hasPath(resolved)) {
          failures.push(`${rel}:${i + 1} missing backtick path ${rawPath} (resolved ${resolved})`);
        }
      }
    }
  }

  return failures;
}

function checkSectionCitations(snapshot: CorpusSnapshot): string[] {
  const headingIndex = buildHeadingIndex(snapshot.docs);
  const failures: string[] = [];

  const tokenRe = /`([^`\s]+\.md)`(?:\s*(§§?)\s*(\*[^*]+\*(?:(?:,\s*(?:and\s+)?|\s+and\s+)\*[^*]+\*)*))?|\[\s*[^\]]+\s*\]\(([^)\s#]+\.md)(?:#[^)]*)?\)|`([a-z0-9-]+)`\s*(§§?)\s*(\*[^*]+\*(?:(?:,\s*(?:and\s+)?|\s+and\s+)\*[^*]+\*)*)|\b(its|that file's|Core Rules)\s+(§§?)\s*(\*[^*]+\*(?:(?:,\s*(?:and\s+)?|\s+and\s+)\*[^*]+\*)*)|((?:,\s*(?:and\s+)?|\s+and\s+))?(§§?)\s*(\*[^*]+\*(?:(?:,\s*(?:and\s+)?|\s+and\s+)\*[^*]+\*)*)/g;

  for (const [rel, text] of snapshot.docs) {
    const ownHeadings = headingIndex.get(rel)!;
    const lines = stripFences(text);

    const ownersByBase = new Map<string, Set<string>>();
    for (const rawLine of lines) {
      const line = maskConventionsTemplate(rel, rawLine);
      for (const match of line.matchAll(/`((?:\.\.?\/|skills\/|references\/)[^`\s]+\.md)`/g)) {
        const p = match[1];
        if (p.includes("<") || p.includes("*") || ROLE_EXAMPLES.has(p)) continue;
        const resolved = resolveDocPath(rel, p);
        if (snapshot.docs.has(resolved)) {
          const base = posix.basename(resolved);
          const set = ownersByBase.get(base) ?? new Set<string>();
          set.add(resolved);
          ownersByBase.set(base, set);
        }
      }
    }

    const resolveOwner = (cited: string): string | undefined => {
      if (cited.includes("<") || cited.includes("*") || ROLE_EXAMPLES.has(cited)) return undefined;
      if (cited.startsWith("./") || cited.startsWith("../") || cited.startsWith("skills/") || cited.startsWith("references/") || cited === "CORE_RULES.md") {
        const resolved = resolveDocPath(rel, cited);
        return snapshot.docs.has(resolved) ? resolved : undefined;
      }
      if (TASK_ROLE_BASENAMES.has(cited)) return undefined;
      const sibling = resolveDocPath(rel, `./${cited}`);
      if (snapshot.docs.has(sibling)) return sibling;
      const candidates = ownersByBase.get(cited);
      return candidates?.size === 1 ? [...candidates][0] : undefined;
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      if (isConfirmGatedRosterLine(rel, rawLine, snapshot.skills)) continue;
      const line = maskConventionsTemplate(rel, rawLine);

      let nearestOwner: string | undefined;
      let lastExplicitOwner: string | undefined;
      let lastExplicitEnd = -1;

      for (const match of line.matchAll(tokenRe)) {
        const idx = match.index!;
        const [
          full,
          citedFile,
          fileSym,
          fileList,
          linkFile,
          skillName,
          skillSym,
          skillList,
          prefix,
          ,
          preList,
          joiner,
          bareSym,
          bareList,
        ] = match;

        if (citedFile !== undefined) {
          const owner = resolveOwner(citedFile);
          if (owner !== undefined) nearestOwner = owner;
          if (fileSym !== undefined) {
            if (owner === undefined) {
              if (!citedFile.includes("<") && !citedFile.includes("*") && !TASK_ROLE_BASENAMES.has(citedFile)) {
                failures.push(`${rel}:${i + 1} unresolved section owner ${citedFile}`);
              }
            } else {
              const titles = headingIndex.get(owner)!.titles;
              for (const [, heading] of fileList.matchAll(/\*([^*]+)\*/g)) {
                if (isPlaceholderHeading(heading)) continue;
                if (!matchesHeading(titles, heading)) {
                  failures.push(`${rel}:${i + 1} ${owner} lacks heading § *${heading}*`);
                }
              }
              lastExplicitOwner = owner;
              lastExplicitEnd = idx + full.length;
            }
          }
          continue;
        }

        if (linkFile !== undefined) {
          const owner = resolveOwner(linkFile);
          if (owner !== undefined) nearestOwner = owner;
          continue;
        }

        if (skillName !== undefined && skillSym !== undefined) {
          if (!snapshot.skills.has(skillName)) {
            failures.push(`${rel}:${i + 1} unknown skill owner \`${skillName}\` in ${full}`);
            continue;
          }
          const owner = `skills/${skillName}/SKILL.md`;
          nearestOwner = owner;
          const titles = headingIndex.get(owner)?.titles ?? [];
          for (const [, heading] of skillList.matchAll(/\*([^*]+)\*/g)) {
            if (heading.includes("<") || heading.includes("*")) continue;
            if (!matchesHeading(titles, heading)) {
              failures.push(`${rel}:${i + 1} ${owner} lacks heading § *${heading}*`);
            }
          }
          lastExplicitOwner = owner;
          lastExplicitEnd = idx + full.length;
          continue;
        }

        if (prefix !== undefined) {
          const owner = prefix === "Core Rules" ? "CORE_RULES.md" : nearestOwner;
          if (owner === undefined || !headingIndex.has(owner)) {
            failures.push(`${rel}:${i + 1} ${prefix} section citation has no preceding owner on the line`);
            continue;
          }
          const titles = headingIndex.get(owner)!.titles;
          for (const [, heading] of preList.matchAll(/\*([^*]+)\*/g)) {
            if (heading.includes("<") || heading.includes("*")) continue;
            if (!matchesHeading(titles, heading)) {
              failures.push(`${rel}:${i + 1} ${owner} lacks heading § *${heading}* (via ${prefix})`);
            }
          }
          lastExplicitOwner = owner;
          lastExplicitEnd = idx + full.length;
          continue;
        }

        if (bareSym !== undefined) {
          const chained = joiner !== undefined && lastExplicitOwner !== undefined && idx === lastExplicitEnd;
          const headings = [...bareList.matchAll(/\*([^*]+)\*/g)]
            .map((entry) => entry[1])
            .filter((heading) => !isPlaceholderHeading(heading));
          for (const heading of headings) {
            if (chained) {
              const titles = headingIndex.get(lastExplicitOwner!)!.titles;
              if (!matchesHeading(titles, heading)) {
                failures.push(`${rel}:${i + 1} ${lastExplicitOwner} lacks chained heading § *${heading}*`);
              }
              continue;
            }
            if (matchesHeading(ownHeadings.titles, heading)) continue;
            if (nearestOwner !== undefined && matchesHeading(headingIndex.get(nearestOwner)!.titles, heading)) {
              continue;
            }
            failures.push(`${rel}:${i + 1} unresolved bare citation § *${heading}* (nearest owner: ${nearestOwner ?? "none"})`);
          }
          if (chained) lastExplicitEnd = idx + full.length;
        }
      }
    }
  }

  return failures;
}

function sectionBody(text: string, heading: string): string | undefined {
  const level = /^#+/.exec(heading)?.[0].length ?? 0;
  if (level === 0) return undefined;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return undefined;
  const endRe = new RegExp(`^#{1,${level}} `);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (endRe.test(line)) break;
    body.push(line);
  }
  return body.join("\n");
}

function extractDomainPackUtilities(domainPacksText: string): string[] {
  const body = sectionBody(domainPacksText, "## Utility skills");
  if (body === undefined) return [];
  const line = body.split("\n").find((l) => l.startsWith("The initial members are "));
  if (line === undefined) return [];
  return [...line.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
}

function checkConfirmGatedAndConventions(snapshot: CorpusSnapshot): string[] {
  const failures: string[] = [];
  const conventions = snapshot.docs.get("references/workflow/skill-conventions.md");
  const domainPacks = snapshot.docs.get("references/workflow/domain-packs.md");
  if (conventions === undefined) return ["missing references/workflow/skill-conventions.md"];
  if (domainPacks === undefined) return ["missing references/workflow/domain-packs.md"];

  const headingIndex = buildHeadingIndex(snapshot.docs);
  const lines = conventions.split(/\r?\n/);

  const rosterStart = lines.indexOf("**Confirm-gated skills:**");
  if (rosterStart < 0) {
    failures.push("skill-conventions.md missing **Confirm-gated skills:** roster");
  } else {
    const rosterLines: string[] = [];
    for (const line of lines.slice(rosterStart + 1)) {
      if (line.trim() === "") {
        if (rosterLines.length === 0) continue;
        break;
      }
      rosterLines.push(line);
    }
    if (rosterLines.length === 0) {
      failures.push("skill-conventions.md **Confirm-gated skills:** roster is empty");
    }
    for (const line of rosterLines) {
      const skillMatch = /^- `([a-z0-9-]+)` — /.exec(line);
      if (!skillMatch) {
        failures.push(`unparseable confirm-gated roster line: ${line}`);
        continue;
      }
      const skill = skillMatch[1];
      const skillPath = `skills/${skill}/SKILL.md`;
      if (!snapshot.skills.has(skill) || !headingIndex.has(skillPath)) {
        failures.push(`confirm-gated roster names missing skill \`${skill}\``);
        continue;
      }
      const headings = [...line.matchAll(/§ \*([^*]+)\*/g)].map((m) => m[1]);
      if (headings.length === 0) {
        failures.push(`confirm-gated roster entry for \`${skill}\` names no proposal heading`);
        continue;
      }
      const titles = headingIndex.get(skillPath)!.titles;
      for (const heading of headings) {
        if (!matchesHeading(titles, heading)) {
          failures.push(`confirm-gated roster entry for \`${skill}\` names missing heading § *${heading}*`);
        }
      }
    }
  }

  const categories = [
    "### Utilities",
    "### Standalone protocols",
    "### Composites — sequential phases",
  ] as const;

  const seenAcrossCategories = new Map<string, string>();
  const utilities: string[] = [];

  for (const heading of categories) {
    const body = sectionBody(conventions, heading);
    if (body === undefined) {
      failures.push(`skill-conventions.md missing ${heading}`);
      continue;
    }
    const localSeen = new Set<string>();
    const entries = body.split("\n").filter((l) => l.startsWith("- "));
    if (entries.length === 0) {
      failures.push(`skill-conventions.md ${heading} has no members`);
    }
    for (const line of entries) {
      const match = /^- `([a-z0-9-]+)` — /.exec(line);
      if (!match) {
        failures.push(`unparseable member line under ${heading}: ${line}`);
        continue;
      }
      const skill = match[1];
      if (!snapshot.skills.has(skill)) {
        failures.push(`${heading} registers missing skill \`${skill}\``);
      }
      if (localSeen.has(skill)) {
        failures.push(`${heading} duplicates skill \`${skill}\``);
      }
      localSeen.add(skill);
      const priorCategory = seenAcrossCategories.get(skill);
      if (priorCategory !== undefined) {
        failures.push(`skill \`${skill}\` overlaps between ${priorCategory} and ${heading}`);
      }
      seenAcrossCategories.set(skill, heading);
      if (heading === "### Utilities") utilities.push(skill);
    }
  }

  const modalBody = sectionBody(conventions, "### Modal flags — interleaved behavior");
  if (modalBody === undefined) {
    failures.push("skill-conventions.md missing ### Modal flags — interleaved behavior");
  } else {
    for (const line of modalBody.split("\n").filter((l) => l.startsWith("- "))) {
      const parenMatch = /^- `[^`]+` \(([^)]+)\) — /.exec(line);
      if (!parenMatch) {
        failures.push(`unparseable modal-flag line: ${line}`);
        continue;
      }
      for (const [, skill] of parenMatch[1].matchAll(/`([a-z0-9-]+)`/g)) {
        if (!snapshot.skills.has(skill)) {
          failures.push(`### Modal flags — interleaved behavior names missing skill \`${skill}\``);
        }
      }
    }
  }

  const domainUtilities = extractDomainPackUtilities(domainPacks);
  const sortedConvUtils = [...utilities].sort();
  const sortedPackUtils = [...domainUtilities].sort();
  if (JSON.stringify(sortedConvUtils) !== JSON.stringify(sortedPackUtils)) {
    failures.push(
      `Utilities mismatch: skill-conventions.md has [${sortedConvUtils.join(", ")}], domain-packs.md has [${sortedPackUtils.join(", ")}]`,
    );
  }

  return failures;
}

function extractLeadingBacktickList(text: string): string[] {
  const skills: string[] = [];
  let rest = text;
  while (true) {
    const match = /^(?:(?:,\s*(?:and\s+)?|\s+and\s+))?`([a-z0-9-]+)`/.exec(rest);
    if (!match) break;
    skills.push(match[1]);
    rest = rest.slice(match[0].length);
  }
  return skills;
}

function checkDomainPackRegistrations(snapshot: CorpusSnapshot): string[] {
  const failures: string[] = [];
  const domainPacks = snapshot.docs.get("references/workflow/domain-packs.md");
  if (domainPacks === undefined) return ["missing references/workflow/domain-packs.md"];

  const splitBody = sectionBody(domainPacks, "## The split");
  const whichBody = sectionBody(domainPacks, "## Which skills resolve a domain vs. load a fixed pack");
  if (splitBody === undefined) return ["domain-packs.md missing ## The split"];
  if (whichBody === undefined) return ["domain-packs.md missing ## Which skills resolve a domain vs. load a fixed pack"];

  const registered = new Map<string, string>();
  const add = (category: string, names: readonly string[]): void => {
    for (const name of names) {
      if (!snapshot.skills.has(name)) {
        failures.push(`domain-packs.md (${category}) registers missing skill \`${name}\``);
      }
      const prior = registered.get(name);
      if (prior !== undefined) {
        failures.push(`domain-packs.md registers \`${name}\` in both ${prior} and ${category}`);
      }
      registered.set(name, category);
    }
  };

  const spineLine = splitBody.split("\n").find((l) => l.startsWith("The spine skills "));
  if (spineLine === undefined) {
    failures.push("domain-packs.md ## The split missing spine skills list");
  } else {
    add("Spine", extractLeadingBacktickList(spineLine.slice("The spine skills ".length)));
  }

  const whichLines = whichBody.split("\n");

  const engLine = whichLines.find((l) => l.startsWith("- **Engineering-only skills**"));
  if (engLine === undefined) {
    failures.push("domain-packs.md missing Engineering-only skills list");
  } else {
    const afterColon = engLine.split("`references/engineering/`: ")[1] ?? "";
    add("Engineering-only", extractLeadingBacktickList(afterColon));
  }

  const docLine = whichLines.find((l) => l.startsWith("- **Documentation-contributed skills**"));
  if (docLine === undefined) {
    failures.push("domain-packs.md missing Documentation-contributed skills list");
  } else {
    const afterColon = docLine.split("`references/documentation/`: ")[1] ?? "";
    const docSkills = afterColon
      .split(";")
      .map((part) => /^\s*`([a-z0-9-]+)`/.exec(part)?.[1])
      .filter((name): name is string => name !== undefined);
    add("Documentation-contributed", docSkills);
  }

  const mixedLine = whichLines.find((l) => l.startsWith("- **Mixed-domain findings:**"));
  if (mixedLine === undefined) {
    failures.push("domain-packs.md missing Mixed-domain findings line");
  } else {
    add("Mixed-domain", extractLeadingBacktickList(mixedLine.slice("- **Mixed-domain findings:** ".length)));
  }

  const packFreeStart = whichLines.findIndex((l) => l.startsWith("- **Pack-free skills**"));
  if (packFreeStart < 0) {
    failures.push("domain-packs.md missing Pack-free skills list");
  } else {
    const packFreeNames: string[] = [];
    for (const line of whichLines.slice(packFreeStart + 1)) {
      if (!line.startsWith("  - ")) break;
      packFreeNames.push(...extractLeadingBacktickList(line.slice("  - ".length)));
    }
    add("Pack-free", packFreeNames);
  }

  const nonPackLine = whichLines.find((l) => l.startsWith("The skills "));
  if (nonPackLine === undefined) {
    failures.push("domain-packs.md missing non-pack standalone skills list");
  } else {
    add("Non-pack standalone", extractLeadingBacktickList(nonPackLine.slice("The skills ".length)));
  }

  add("Utility skills", extractDomainPackUtilities(domainPacks));

  for (const skill of [...snapshot.skills].sort()) {
    if (!registered.has(skill)) {
      failures.push(`skill \`${skill}\` is missing from references/workflow/domain-packs.md`);
    }
  }

  return failures;
}

function checkColdMarkers(snapshot: CorpusSnapshot): string[] {
  const failures: string[] = [];

  for (const [rel, text] of snapshot.docs) {
    const skillMatch = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel);
    if (!skillMatch) continue;
    const skill = skillMatch[1];
    const lines = stripFences(text);

    let inCoreRules = false;
    let sawNumbered = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^## Core Rules\s*$/.test(line)) {
        inCoreRules = true;
        sawNumbered = false;
        if (line.includes("<!-- cold -->")) {
          failures.push(`${rel}:${i + 1} places <!-- cold --> on ## Core Rules heading`);
        }
        continue;
      }
      if (inCoreRules) {
        if (line.trim() === "" && !sawNumbered) continue;
        if (/^\d+\.\s/.test(line)) {
          sawNumbered = true;
          if (line.includes("<!-- cold -->")) {
            failures.push(`${rel}:${i + 1} places <!-- cold --> inside numbered ## Core Rules block`);
          }
        } else {
          inCoreRules = false;
        }
      }
    }

    const targets = new Map<string, { hot: number[]; cold: number[] }>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isCold = line.includes("<!-- cold -->");
      const citedOnLine = new Set<string>();

      for (const match of line.matchAll(/`((?:\.\.?\/|skills\/|references\/)[^`\s]+\.md)`/g)) {
        const raw = match[1];
        if (raw.includes("<") || raw.includes("*") || ROLE_EXAMPLES.has(raw)) continue;
        const resolved = resolveDocPath(rel, raw);
        if (resolved === "CORE_RULES.md") continue;
        citedOnLine.add(resolved);
      }

      for (const match of line.matchAll(/\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g)) {
        const raw = match[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.includes("<") || raw.includes("*") || ROLE_EXAMPLES.has(raw)) continue;
        const resolved = resolveDocPath(rel, raw);
        if (resolved === "CORE_RULES.md") continue;
        citedOnLine.add(resolved);
      }

      for (const target of citedOnLine) {
        const entry = targets.get(target) ?? { hot: [], cold: [] };
        (isCold ? entry.cold : entry.hot).push(i + 1);
        targets.set(target, entry);
      }
    }

    for (const [target, entry] of targets) {
      if (entry.hot.length > 0 && entry.cold.length > 0) {
        failures.push(
          `${skill}: mixed hot/cold citations for ${target} (hot lines: ${entry.hot.join(", ")}; cold lines: ${entry.cold.join(", ")})`,
        );
      }
    }
  }

  return failures;
}

function loadLiveSnapshot(): { readonly snapshot: CorpusSnapshot; readonly discoveryErrors: readonly string[] } {
  const discoveryErrors: string[] = [];
  const files = corpusFiles(ROOT, {
    onSymlink: (abs) => discoveryErrors.push(`unexpected symlink: ${relative(ROOT, abs)}`),
    onUnreadable: (abs, errCode) => discoveryErrors.push(`unreadable path: ${relative(ROOT, abs)} (${errCode})`),
    onMissing: (abs, reason) => discoveryErrors.push(`missing root file: ${relative(ROOT, abs)} (${reason})`),
  });

  const docs = new Map<string, string>();
  for (const abs of files) {
    const rel = toPosix(relative(ROOT, realpathSync(abs)));
    docs.set(rel, readFileSync(abs, "utf8"));
  }

  const skills = new Set(
    readdirSync(join(ROOT, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && existsSync(join(ROOT, "skills", entry.name, "SKILL.md")))
      .map((entry) => entry.name),
  );

  return {
    discoveryErrors,
    snapshot: {
      docs,
      skills,
      existsOnDisk: (relPath) => existsSync(resolve(ROOT, relPath)),
    },
  };
}

const LIVE = loadLiveSnapshot();

describe("live corpus structural checks", () => {
  test("corpus discovery finds all kit Markdown files with no symlinks, unreadable paths, or missing roots", () => {
    assert.deepEqual(LIVE.discoveryErrors, []);
    assert.ok(LIVE.snapshot.docs.size > 0, "corpus is non-empty");
    assert.ok(LIVE.snapshot.skills.size > 0, "skills directory is non-empty");
  });

  test("every relative Markdown link, anchor fragment, and kit-file backtick path resolves across the corpus", () => {
    assert.deepEqual(checkLinksAndPaths(LIVE.snapshot), []);
  });

  test("every § section citation across the corpus resolves to a real # Markdown heading", () => {
    assert.deepEqual(checkSectionCitations(LIVE.snapshot), []);
  });

  test("confirm-gated proposal headings and skill-conventions Current members registrations are valid and disjoint", () => {
    assert.deepEqual(checkConfirmGatedAndConventions(LIVE.snapshot), []);
  });

  test("domain-packs.md registers exactly the skills under skills/*/SKILL.md", () => {
    assert.deepEqual(checkDomainPackRegistrations(LIVE.snapshot), []);
  });

  test("every SKILL.md has zero mixed hot/cold citations and no <!-- cold --> inside numbered Core Rules", () => {
    assert.deepEqual(checkColdMarkers(LIVE.snapshot), []);
  });
});

describe("detector fault-based self-tests", () => {
  test("link and path detector flags broken relative links, anchors, and backtick paths while ignoring role examples and placeholders", () => {
    const snapshot: CorpusSnapshot = {
      skills: new Set(["demo"]),
      docs: new Map([
        [
          "skills/demo/SKILL.md",
          [
            "# Demo",
            "Valid: [ok](./references/workflow/guide.md#good-heading) and `./CONTEXT.md` and [role](./ticket.md) and `scripts/<name>.ts`.",
            "```markdown",
            "[fenced-broken](./references/workflow/missing.md#nope) and `./references/workflow/also-missing.md`",
            "```",
            "Broken link: [bad](./references/workflow/nope.md).",
            "Broken anchor: [bad-anchor](./references/workflow/guide.md#missing-anchor).",
            "Broken same-file anchor: [self](#no-such-heading).",
            "Broken backtick: `./references/workflow/ghost.md`.",
          ].join("\r\n"),
        ],
        ["references/workflow/guide.md", "# Guide\r\n\r\n## Good heading\r\n"],
      ]),
    };

    const failures = checkLinksAndPaths(snapshot);
    assert.equal(failures.length, 4, failures.join("\n"));
    assert.match(failures[0], /missing link target \.\/references\/workflow\/nope\.md/);
    assert.match(failures[1], /broken link anchor .*#missing-anchor/);
    assert.match(failures[2], /broken anchor #no-such-heading/);
    assert.match(failures[3], /missing backtick path \.\/references\/workflow\/ghost\.md/);
  });

  test("section detector rejects missing headings, bold-lead-only targets, and anaphoric or chained cross-file mismatches", () => {
    const snapshot: CorpusSnapshot = {
      skills: new Set(["demo"]),
      docs: new Map([
        [
          "references/workflow/caller.md",
          [
            "# Caller",
            "",
            "## The record",
            "",
            "Explicit ok: `./owner.md` § *Real section*.",
            "Explicit missing: `./owner.md` § *No such heading*.",
            "Bold lead only: `./owner.md` § *Bold only*.",
            "Anaphoric cross-file mismatch: `./owner.md` § *Real section*; advance under its § *The record*.",
            "Chained cross-file mismatch: `./owner.md` § *Real section* and § *The record*.",
          ].join("\n"),
        ],
        [
          "references/workflow/owner.md",
          [
            "# Owner",
            "",
            "## Real section (extra detail)",
            "",
            "**Bold only.** Paragraph text.",
            "",
            "## The record — other phase",
          ].join("\n"),
        ],
      ]),
    };

    const failures = checkSectionCitations(snapshot);
    assert.equal(failures.length, 4, failures.join("\n"));
    assert.match(failures[0], /lacks heading § \*No such heading\*/);
    assert.match(failures[1], /lacks heading § \*Bold only\*/);
    assert.match(failures[2], /lacks heading § \*The record\* \(via its\)/);
    assert.match(failures[3], /lacks chained heading § \*The record\*/);
  });

  test("confirm-gated and Current members detector catches missing multi-heading proposals, overlaps, and Utilities drift", () => {
    const snapshot: CorpusSnapshot = {
      skills: new Set(["alpha", "beta", "gamma"]),
      docs: new Map([
        ["skills/alpha/SKILL.md", "# Alpha\n\n## First\n"],
        ["skills/beta/SKILL.md", "# Beta\n\n## Setup\n"],
        ["skills/gamma/SKILL.md", "# Gamma\n\n## Run\n"],
        [
          "references/workflow/skill-conventions.md",
          [
            "## Current members",
            "",
            "### Utilities",
            "",
            "- `alpha` — utility.",
            "",
            "### Standalone protocols",
            "",
            "- `alpha` — overlaps with Utilities.",
            "- `ghost` — missing skill.",
            "",
            "### Composites — sequential phases",
            "",
            "- `beta` — composite.",
            "",
            "### Modal flags — interleaved behavior",
            "",
            "- `-x` (`gamma`, `missing-flag-skill`) — flag.",
            "",
            "## The invocation gate",
            "",
            "**Confirm-gated skills:**",
            "",
            "- `alpha` — two headings: its § *First*, and its § *Missing second*.",
            "- `beta` — missing heading: its § *Absent*.",
          ].join("\n"),
        ],
        [
          "references/workflow/domain-packs.md",
          [
            "## Utility skills",
            "",
            "The initial members are `alpha` and `gamma`.",
          ].join("\n"),
        ],
      ]),
    };

    const failures = checkConfirmGatedAndConventions(snapshot);
    assert.ok(failures.some((f) => f.includes("`alpha` names missing heading § *Missing second*")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("`beta` names missing heading § *Absent*")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("`alpha` overlaps between ### Utilities and ### Standalone protocols")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("registers missing skill `ghost`")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("names missing skill `missing-flag-skill`")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("Utilities mismatch")), failures.join("\n"));
  });

  test("domain-packs registration detector catches unregistered, unknown, and duplicated skills", () => {
    const snapshot: CorpusSnapshot = {
      skills: new Set(["spine-one", "eng-one", "doc-one", "mix-one", "pack-free-one", "plain-one", "util-one", "unregistered-one"]),
      docs: new Map([
        [
          "references/workflow/domain-packs.md",
          [
            "## The split",
            "",
            "The spine skills `spine-one` carry domain-neutral methodology.",
            "",
            "## Which skills resolve a domain vs. load a fixed pack",
            "",
            "- **Engineering-only skills** load `references/engineering/`: `eng-one`, `ghost-eng`.",
            "- **Documentation-contributed skills** load `references/documentation/`: `doc-one` checks docs.",
            "- **Mixed-domain findings:** `mix-one` applies both.",
            "- **Pack-free skills** apply the neutral core:",
            "  - `pack-free-one` and `eng-one` operate on envelopes.",
            "",
            "The skills `plain-one` resolve no domain pack.",
            "",
            "## Utility skills",
            "",
            "The initial members are `util-one`.",
          ].join("\n"),
        ],
      ]),
    };

    const failures = checkDomainPackRegistrations(snapshot);
    assert.ok(failures.some((f) => f.includes("registers missing skill `ghost-eng`")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("registers `eng-one` in both Engineering-only and Pack-free")), failures.join("\n"));
    assert.ok(failures.some((f) => f.includes("skill `unregistered-one` is missing")), failures.join("\n"));
  });

  test("cold-marker detector catches mixed backtick and Markdown-link citations and numbered Core Rules markers while allowing unnumbered cold lines", () => {
    const snapshot: CorpusSnapshot = {
      skills: new Set(["demo"]),
      docs: new Map([
        [
          "skills/demo/SKILL.md",
          [
            "## Core Rules",
            "",
            "1. Apply `AGENTS.md`.",
            "2. Load `./references/workflow/hot.md`. <!-- cold -->",
            "",
            "Unnumbered write-surface note (`./references/workflow/cold-only.md`). <!-- cold -->",
            "",
            "Hot backtick `./references/workflow/mixed-bt.md`.",
            "Cold backtick `./references/workflow/mixed-bt.md`. <!-- cold -->",
            "Hot link [a](./references/workflow/mixed-link.md).",
            "Cold link [b](./references/workflow/mixed-link.md). <!-- cold -->",
          ].join("\n"),
        ],
      ]),
    };

    const failures = checkColdMarkers(snapshot);
    assert.equal(failures.length, 3, failures.join("\n"));
    assert.match(failures[0], /places <!-- cold --> inside numbered ## Core Rules block/);
    assert.match(failures[1], /mixed hot\/cold citations for references\/workflow\/mixed-bt\.md/);
    assert.match(failures[2], /mixed hot\/cold citations for references\/workflow\/mixed-link\.md/);
  });
});
