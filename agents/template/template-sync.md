# Syncing with the template

The template is the common ancestor of every plugin. Updates travel one way:
template → plugins, by `git merge`.

## The invariant that makes this work

The first merge is between two histories with no common ancestor, so it needs
`--allow-unrelated-histories`. That flag does **not** rewrite history — it only
lifts git's refusal to merge unrelated trees. It creates an ordinary merge
commit `M` whose second parent is a real template commit.

From then on `git merge-base master template/master` finds that commit, so every
later sync is a plain 3-way merge and the flag is never needed again.

Check the invariant at any time:

```bash
git merge-base --all HEAD template/master   # must print a commit
```

**What destroys it:** GitHub's "Squash and merge" or "Rebase and merge" on the
PR that carries the adoption merge, a local `git rebase` across `M`, or
`git merge --squash`. If `M` is lost, every future sync degrades permanently
into an add/add conflict on every file.

So: **configure the repository to allow merge commits only** (disable squash and
rebase merging in GitHub settings) before landing the adoption PR, and never
rebase across the merge.

## First adoption of an existing plugin

The trick that turns a 20-file conflict into a 2-file one: make the
template-owned files byte-identical *before* merging. With no merge base git
compares against an empty base, so identical both-added files merge cleanly.

```bash
# 0. Baseline: prove what passes today, so you can prove it still passes after.
git switch master && git pull --ff-only
git status --porcelain                       # must be clean
npm ci && npm run build && npm test && npm run lint
npm run obsidian-tests
git switch -c chore/adopt-template

# 1. Structural prep, only where needed:
#    - move a root main.ts to src/main.ts, fix tsconfig include/baseUrl
#    - delete legacy .eslintrc / .eslintignore
#    - reorder package.json keys (see conventions.md)
#    - switch LICENSE and package.json "license" to AGPL-3.0-or-later
git commit -m "chore: normalize layout and license before template adoption"

# 2. Add the template as a remote (a local path works too)
git remote add template https://github.com/rekby/obsidian-plugin-template.git
git fetch template

# 3. Lay down template-owned files verbatim
git archive template/master \
    .github .editorconfig .npmrc .gitattributes LICENSE \
    eslint.config.mts vitest.config.ts esbuild.config.mjs version-bump.mjs \
    wdio.conf.mjs wdio.demo.conf.mjs \
    scripts obsidian-tests/lib agents/template templates \
  | tar -x
git add -A && git commit -m "chore: adopt template-owned tooling verbatim"

# 4. The one and only unrelated-histories merge
git merge --allow-unrelated-histories --no-commit --no-ff template/master
bash scripts/resolve-template-merge.sh
# hand-merge package.json / tsconfig.json
npm install && git add package-lock.json
git commit

# 5. Compare against the baseline from step 0
npm run build && npm test && npm run lint
npm run obsidian-tests
git merge-base --all HEAD template/master   # must print a commit
```

## Routine sync

```bash
git fetch template
git switch -c chore/template-sync-$(date +%Y%m%d)
git merge template/master        # plain 3-way, no flags
bash scripts/resolve-template-merge.sh   # only if it reports conflicts
npm install && npm run build && npm test && npm run lint
git commit
```

Land it with a merge commit — `gh pr merge --merge`, never `--squash` or
`--rebase`.

## Pulling obsidian-sample-plugin into the template

Only the template does this; plugins get upstream changes through a normal sync.

```bash
bash scripts/merge-upstream.sh
```

It re-deletes the files the template dropped in its first commit (they come back
as modify/delete conflicts whenever upstream touches them) and stops for review
if upstream changed something the template also maintains.

## Escape hatch: a plugin that permanently rejects part of the template

Put the rejection in recorded history so it does not resurrect every sync:

```bash
git checkout --orphan template-vendor
git pull template master
git rm -r <the parts this plugin never wants>
git commit -m "chore: drop unused template parts for this plugin"
git switch master
git merge template-vendor        # merge this branch instead of template/master
```
