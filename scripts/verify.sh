#!/usr/bin/env bash
# verify.sh — static contract checks for the agents-kit repo.
# Run locally before opening a PR; runs in CI via .github/workflows/test-plugin-install.yml.
# Exits non-zero on any contract violation; runs every check before exiting so
# a single run surfaces every drift, not just the first one.
set -euo pipefail

command -v jq >/dev/null || { echo "jq required" >&2; exit 2; }

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

fail=0
ok()  { printf "  ✓ %s\n" "$*"; }
err() { printf "  ✗ %s\n" "$*" >&2; fail=1; }
hdr() { printf "\n==> %s\n" "$*"; }

# parse_or_die <file> — validate a JSON file is parseable, with a clean error
# pointing at the file path on failure. Once a file is validated here, the jq
# calls below can safely extract values without worrying about parse errors.
parse_or_die() {
    local file="$1"
    if ! jq empty "$file" >/dev/null 2>&1; then
        printf "  ✗ manifest unparseable: %s\n" "$file" >&2
        exit 2
    fi
}

parse_or_die .claude-plugin/plugin.json
parse_or_die .claude-plugin/marketplace.json

# 1. Version sync (CORE_RULES.md ↔ plugin.json)
hdr "Version sync (CORE_RULES.md ↔ plugin.json)"
rules_version=$(grep -oE '^\*\*Version:\*\* [0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.]+)?' CORE_RULES.md | awk '{print $2}' || true)
plugin_version=$(jq -r '.version // empty' .claude-plugin/plugin.json)
if [ -z "$rules_version" ]; then
    err "CORE_RULES.md is missing or has a malformed '**Version:** X.Y.Z' line"
elif [ -z "$plugin_version" ]; then
    err ".claude-plugin/plugin.json is missing 'version'"
elif [ "$rules_version" != "$plugin_version" ]; then
    err "version mismatch — CORE_RULES.md: $rules_version | plugin.json: $plugin_version"
else
    ok "$rules_version"
fi

# 2. Plugin manifest required keys
hdr "Plugin manifest keys (.claude-plugin/plugin.json)"
for key in name description version; do
    val=$(jq -r --arg k "$key" '.[$k] // empty' .claude-plugin/plugin.json)
    if [ -z "$val" ]; then
        err "missing or empty key: $key"
    else
        ok "$key"
    fi
done

# 3. Marketplace manifest required keys + per-plugin entry shape
hdr "Marketplace manifest keys (.claude-plugin/marketplace.json)"
for key in name owner plugins; do
    if ! jq -e --arg k "$key" 'has($k)' .claude-plugin/marketplace.json >/dev/null; then
        err "missing key: $key"
    fi
done
plugins_count=$(jq '.plugins | length' .claude-plugin/marketplace.json)
if [ "$plugins_count" -lt 1 ]; then
    err "plugins[] is empty"
else
    ok "plugins[] has $plugins_count entry(ies)"
    for i in $(seq 0 $((plugins_count - 1))); do
        for key in name description source; do
            val=$(jq -r --argjson i "$i" --arg k "$key" '.plugins[$i][$k] // empty' .claude-plugin/marketplace.json)
            [ -n "$val" ] || err "plugins[$i] missing key: $key"
        done
    done
fi

# 4. Cross-manifest consistency for the self-entry (the marketplace entry whose source is "./")
hdr "Cross-manifest consistency (name + description)"
self_idx=$(jq -r '[.plugins[].source] | index("./") // 0' .claude-plugin/marketplace.json)
plugin_name=$(jq -r '.name' .claude-plugin/plugin.json)
plugin_desc=$(jq -r '.description' .claude-plugin/plugin.json)
mk_self_name=$(jq -r --argjson i "$self_idx" '.plugins[$i].name // empty' .claude-plugin/marketplace.json)
mk_self_desc=$(jq -r --argjson i "$self_idx" '.plugins[$i].description // empty' .claude-plugin/marketplace.json)
mk_meta_desc=$(jq -r '.metadata.description // empty' .claude-plugin/marketplace.json)

if [ "$plugin_name" != "$mk_self_name" ]; then
    err "name drift — plugin.json: $plugin_name | marketplace self-entry: $mk_self_name"
else
    ok "name matches plugin.json ↔ marketplace self-entry: $plugin_name"
fi
if [ "$plugin_desc" != "$mk_self_desc" ]; then
    err "description drift — plugin.json ↔ marketplace self-entry"
else
    ok "description matches plugin.json ↔ marketplace self-entry"
fi
if [ -n "$mk_meta_desc" ] && [ "$plugin_desc" != "$mk_meta_desc" ]; then
    err "description drift — plugin.json ↔ marketplace.metadata.description"
elif [ -n "$mk_meta_desc" ]; then
    ok "description matches plugin.json ↔ marketplace.metadata"
fi

# 5. Symlink contract — engineering skills' AGENTS.md is a real symlink to ../../CORE_RULES.md.
#    Standalone skills (proofread, translate, fact-check) deliberately have no AGENTS.md sibling.
hdr "Symlink contract (engineering skills' AGENTS.md → ../../CORE_RULES.md)"
eng_count=0
std_count=0
for d in skills/*/; do
    [ -d "$d" ] || continue
    a="${d}AGENTS.md"
    if [ -e "$a" ]; then
        eng_count=$((eng_count + 1))
        if [ ! -L "$a" ]; then
            err "$a is not a symlink (kit ships symlinks; consumers receive dereferenced copies)"
            continue
        fi
        target=$(readlink "$a")
        [ "$target" = "../../CORE_RULES.md" ] || err "$a points to '$target' — expected '../../CORE_RULES.md'"
    else
        std_count=$((std_count + 1))
    fi
done
ok "engineering skills: $eng_count | standalone skills: $std_count"

# 6. Directive contract — every engineering SKILL.md carries the Core Rules block + confirmation line
hdr "Directive contract (engineering SKILL.md)"
directive_missing=0
sweep_missing() {
    local pattern="$1"
    for d in skills/*/; do
        [ -L "${d}AGENTS.md" ] || continue
        if ! grep -Fq "$pattern" "${d}SKILL.md"; then
            err "${d}SKILL.md missing pattern: $pattern"
            directive_missing=1
        fi
    done
}
sweep_missing "## Core Rules"
sweep_missing "✅ Core agents-kit@<version> rules applied"
[ "$directive_missing" = 0 ] && ok "all engineering skills carry '## Core Rules' and the confirmation line"

# 7. Standalone exemption — standalone skills must NOT carry the directive
hdr "Standalone exemption (standalone SKILL.md must NOT carry the directive)"
exempt_violation=0
for d in skills/*/; do
    [ -d "$d" ] || continue
    [ -e "${d}AGENTS.md" ] && continue
    if grep -Fq "## Core Rules" "${d}SKILL.md" 2>/dev/null; then
        err "${d}SKILL.md is standalone but carries Core Rules directive"
        exempt_violation=1
    fi
done
[ "$exempt_violation" = 0 ] && ok "standalone skills correctly omit the directive"

echo
if [ "$fail" -ne 0 ]; then
    echo "verify.sh: FAILED" >&2
    exit 1
fi
echo "verify.sh: PASSED"
