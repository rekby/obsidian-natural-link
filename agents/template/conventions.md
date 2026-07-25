# Conventions

## File ownership

The governing rule:

> **The template does not ship a file at any path a plugin owns.**

If the template never ships `manifest.json`, a `manifest.json` conflict cannot
happen — no merge driver, no discipline required.

This matters because `.gitattributes` cannot enforce ownership on its own: a
merge driver only runs when a path changed on *both* sides relative to the merge
base. If the template changes a file and the plugin has not touched it, git
silently takes the template's version and `merge=ours` never runs. `ours` means
"mine *on conflict*", not "mine always".

### Template-owned — the plugin should not edit these

`.github/**`, `.gitattributes`, `.editorconfig`, `.npmrc`, `LICENSE`,
`eslint.config.mts`, `vitest.config.ts`, `esbuild.config.mjs`,
`version-bump.mjs`, `wdio.conf.mjs`, `wdio.demo.conf.mjs`, `scripts/**`,
`obsidian-tests/lib/**`, `agents/template/**`, `templates/**`.

Editing one of these in a plugin means the next sync conflicts. If a change is
genuinely needed, make it in the template and sync.

### Plugin-owned — the template never ships these

`manifest.json`, `versions.json`, `package-lock.json`, `src/**`, `styles.css`,
`README.md`, `README.ru.md`, `docs/**`, `tests/**`,
`obsidian-tests/{vault,demo-vault,demo-vaults,specs,demo}/**`, `AGENTS.md`,
`CLAUDE.md`, `agents/*.md`.

`LICENSE` is template-owned because every plugin uses AGPL-3.0-or-later.
`tests/__mocks__/obsidian.ts` is plugin-owned because each plugin stubs a
different slice of the Obsidian API; `templates/starter/` holds the starting
point.

### Merged — genuine 3-way

`package.json`, `tsconfig.json`, `.gitignore`.

## Key order in shared files

`.gitignore` uses git's built-in `union` driver, so both sides' lines survive.
Occasional duplicate lines are the accepted cost; tidy with `sort -u` when it
bothers you.

For the two JSON files the ordering rule is: **keep the block the plugin edits
away from the block the template edits.** A line-based 3-way merge only
conflicts when hunks are adjacent, and npm's default ordering puts
`dependencies` directly before `devDependencies` — the worst case.

`package.json`:

```
name, version, description, author, license, keywords   <- plugin
dependencies                                            <- plugin
main, type, engines                                     <- buffer
scripts, devDependencies, overrides                     <- template
```

`npm install` does not reorder top-level keys — it only inserts a package
alphabetically inside the relevant block — so this layout survives normal use.

`tsconfig.json`: `compilerOptions` (template) first, `include` / `exclude` /
`paths` (plugin) last.

## Known compromises

- **Dependabot in plugins can bump template-owned devDependencies.** The bumped
  version then differs from the template until the next sync, which may conflict
  on one line in `devDependencies`. Preferring the template's version is
  correct; toolchain upgrades belong in the template.
- **`npm run lint` prints an `ENOENT: manifest.json` stack trace in the template
  itself.** `eslint-plugin-obsidianmd` reads the manifest when it loads, and the
  template deliberately has none. It is noise, not a failure — the command still
  exits 0, and in a real plugin it does not appear.
- **`selfCheckGifDeterminism` proves same-machine reproducibility only.** Two
  different machines are not verified to produce identical bytes; the pinned
  binaries and rendering flags make it likely, not guaranteed.

## Style

`.editorconfig` is authoritative: UTF-8, LF, tabs at width 4, final newline.
ESLint checks `src/**` and `manifest.json`; the test harness under
`obsidian-tests/` and `scripts/` is plain `.mjs` and is verified by running it.
