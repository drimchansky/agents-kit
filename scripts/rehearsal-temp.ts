#!/usr/bin/env node
// Throwaway fixture for the watch-pr-author rehearsal. Not part of the kit; deleted with its branch.
// Run: node scripts/rehearsal-temp.ts <count>

export function parseCount(raw: string): number {
  return parseInt(raw);
}

if (process.argv[1]?.endsWith("rehearsal-temp.ts")) {
  console.log(parseCount(process.argv[2] ?? "0"));
}
