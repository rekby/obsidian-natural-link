#!/usr/bin/env bash
#
# Pull changes from the official obsidianmd/obsidian-sample-plugin into this
# template. Only the template does this — plugins receive upstream changes
# transitively, through a normal template sync.
#
# The template shares sample-plugin's root commit, so this is an ordinary 3-way
# merge. The recurring noise is modify/delete on the files the template deleted
# in its first commit; those are re-deleted automatically here.
set -euo pipefail

# Deleted in the template's first commit because plugins own them.
UPSTREAM_DELETED=(
	'src/main.ts'
	'src/settings.ts'
	'styles.css'
	'manifest.json'
	'versions.json'
	'README.md'
	'AGENTS.md'
	'package-lock.json'
	'.github/workflows/lint.yml'
	'.github/workflows/release.yml'
)

if ! git remote get-url upstream >/dev/null 2>&1; then
	git remote add upstream https://github.com/obsidianmd/obsidian-sample-plugin.git
fi

git fetch upstream

if ! git merge --no-commit --no-ff upstream/master; then
	echo "merge reported conflicts, resolving the known modify/delete set..." >&2
fi

for path in "${UPSTREAM_DELETED[@]}"; do
	if git ls-files --unmerged -- "$path" | grep -q .; then
		git rm -q --force -- "$path"
	fi
done

remaining=$(git diff --name-only --diff-filter=U)
if [ -n "$remaining" ]; then
	echo
	echo "review by hand — upstream changed files the template also maintains:"
	echo "$remaining" | sed 's/^/  /'
	echo
	echo "then: git commit"
	exit 1
fi

echo "no conflicts left. Verify, then commit:"
echo "  npm install && npm run build && npm test && npm run lint"
echo "  git commit"
