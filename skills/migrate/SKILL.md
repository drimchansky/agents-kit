---
name: migrate
description: Upgrade libraries, frameworks, or APIs — assess breaking changes, create a migration path, and update incrementally
disable-model-invocation: true
---

# Migrate

Plan and execute a migration — library upgrade, framework version bump, API change, or pattern replacement. Migrations should be incremental, verifiable at each step, and reversible when possible.

If the migration scope or target version is unclear, ask before starting.

## 1. Assess the Migration

### Understand What's Changing

- Read the changelog, migration guide, and release notes for the target version
- Identify breaking changes, deprecated APIs, and new required patterns
- Check for codemods or automated migration tools provided by the library
- Note peer dependency changes that cascade into other upgrades

### Map the Impact

- Search the codebase for all usages of affected APIs, components, and patterns
- Categorize changes by type: drop-in replacement, signature change, pattern replacement, removal
- Identify high-risk areas: custom wrappers around the library, monkey patches, undocumented API usage
- Estimate scope: how many files are affected? Is this a one-file or a hundred-file migration?

### Evaluate Risks

- Are there intermediate versions that must be stepped through, or can you jump directly?
- Do any dependencies block the upgrade (incompatible peer dependencies)?
- Is there a compatibility mode or migration layer that allows gradual adoption?
- What's the rollback plan if the migration introduces regressions?

## 2. Plan the Migration Path

### Choose a Strategy

- **Big bang** — Upgrade everything at once. Only viable for small codebases or non-breaking upgrades.
- **Incremental** — Migrate file by file or feature by feature. Preferred for large changes with coexistence support.
- **Parallel** — Run old and new side by side behind a flag. Useful when the new version changes fundamental behavior.

### Define Steps

Create an ordered migration plan:

1. **Prepare** — Update tooling, configuration, and type definitions
2. **Automate** — Run codemods or find-and-replace for mechanical changes
3. **Manual updates** — Handle cases that require human judgment (pattern changes, API redesigns)
4. **Integration** — Update tests, CI configuration, and build pipelines
5. **Verify** — Full test suite, manual smoke testing, staging deployment
6. **Cleanup** — Remove compatibility shims, old dependencies, and migration-only code

Each step should result in a working, deployable state if possible.

## 3. Execute

### For Each Step

- Make the change across all affected files before moving to the next type of change
- Run tests after each step — don't batch all changes and hope
- Commit after each stable step so you can revert cleanly if needed
- If a step reveals unexpected scope, pause and reassess rather than pushing through

### Common Migration Patterns

- **API rename** — Search and replace, verify no dynamic access patterns
- **Signature change** — Update call sites, add/remove arguments, adjust types
- **Pattern replacement** — Replace one approach with another (class → function, HOC → hook)
- **Dependency swap** — Replace one library with another that serves the same purpose
- **Config format change** — Update configuration files to new schema

## 4. Verify

Before completing:

- [ ] All tests pass (unit, integration, and e2e)
- [ ] No remaining references to deprecated or removed APIs
- [ ] No compatibility shims left that were only needed during migration
- [ ] Peer dependencies are consistent and lock file is clean
- [ ] Application behaves correctly in a realistic environment (dev server, staging)

## Output Structure

Adapt depth to the migration scope:

- **Migration Summary** — What was upgraded, from which version to which version
- **Breaking Changes Addressed** — List of breaking changes and how each was handled
- **Changes** — Files and patterns modified
- **Verification** — Tests run, environments tested
- **Follow-up** — Remaining deprecation warnings, optional improvements unlocked by the new version
