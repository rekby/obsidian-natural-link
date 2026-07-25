#!/usr/bin/env bash
#
# Resolve a template merge mechanically, by file ownership.
#
# Run it while a merge is in progress (after `git merge template/master` reports
# conflicts). It resolves only the paths whose owner is unambiguous and leaves
# genuinely shared files — package.json, tsconfig.json — for you to merge by
# hand. It never commits.
#
# Ownership rules live in agents/template/conventions.md. Keep the two in sync.
set -euo pipefail

if ! git rev-parse --verify -q MERGE_HEAD >/dev/null; then
	echo "error: no merge in progress" >&2
	exit 1
fi

# Files the plugin owns: keep our version even though the template shipped one.
# Normally the template ships none of these, so this is a safety net for
# repositories that diverged before adopting the template.
PLUGIN_OWNED=(
	'manifest.json'
	'versions.json'
	'styles.css'
	'README.md'
	'README.ru.md'
	'AGENTS.md'
	'CLAUDE.md'
	'package-lock.json'
	'src/*'
	'tests/*'
	'docs/*'
	'agents/*'
	'obsidian-tests/vault/*'
	'obsidian-tests/demo-vault/*'
	'obsidian-tests/demo-vaults/*'
	'obsidian-tests/specs/*'
	'obsidian-tests/demo/*'
)

# Files the template owns: take its version wholesale.
TEMPLATE_OWNED=(
	'.github/*'
	'.editorconfig'
	'.gitattributes'
	'.npmrc'
	'LICENSE'
	'eslint.config.mts'
	'vitest.config.ts'
	'esbuild.config.mjs'
	'version-bump.mjs'
	'wdio.conf.mjs'
	'wdio.demo.conf.mjs'
	'scripts/*'
	'obsidian-tests/lib/*'
	'agents/template/*'
	'templates/*'
)

matches_any() {
	local path="$1"; shift
	local pattern
	for pattern in "$@"; do
		# shellcheck disable=SC2053  # glob match is intentional
		if [[ "$path" == $pattern ]]; then return 0; fi
	done
	return 1
}

resolved_ours=0
resolved_theirs=0
left=()

while IFS= read -r conflicted; do
	[ -n "$conflicted" ] || continue

	# agents/template/* is template-owned but also matches agents/*, so the
	# template list is checked first.
	if matches_any "$conflicted" "${TEMPLATE_OWNED[@]}"; then
		git checkout --theirs -- "$conflicted" 2>/dev/null || true
		git add -- "$conflicted"
		resolved_theirs=$((resolved_theirs + 1))
	elif matches_any "$conflicted" "${PLUGIN_OWNED[@]}"; then
		git checkout --ours -- "$conflicted" 2>/dev/null || true
		git add -- "$conflicted"
		resolved_ours=$((resolved_ours + 1))
	else
		left+=("$conflicted")
	fi
done < <(git diff --name-only --diff-filter=U)

echo "resolved ${resolved_theirs} file(s) from the template, ${resolved_ours} from the plugin"

if [ ${#left[@]} -gt 0 ]; then
	echo
	echo "resolve by hand (see agents/template/conventions.md for the key order):"
	printf '  %s\n' "${left[@]}"
fi

if git ls-files --error-unmatch package-lock.json >/dev/null 2>&1; then
	echo
	echo "next: npm install && git add package-lock.json  # regenerate, never hand-merge"
fi
