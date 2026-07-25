# obsidian-plugin-template

Shared template for Obsidian plugins. It is the common git ancestor of the
plugins built on it, so improvements to CI, tests or the demo pipeline reach all
of them with a `git merge` instead of five copy-pastes.

> This file documents the template itself. GitHub renders it only when a
> repository has no root `README.md`, so in a plugin it stays out of the way.

## What you get

- **Build** — esbuild bundle, `tsc --noEmit` type check, `version-bump.mjs` +
  `workflow_dispatch` release with build-provenance attestation.
- **Unit tests** — Vitest with the `obsidian` module aliased to a local stub.
- **Functional e2e** — WebdriverIO driving a real Obsidian desktop app, with
  helpers for temp-vault fixtures and for bounding calls that might hang.
- **Byte-reproducible demo assets** — screenshots and GIFs that come out
  identical on re-run, so regenerating them produces no git diff unless the UI
  actually changed. Five layers of determinism, documented in
  [`agents/template/demo-workflow.md`](../agents/template/demo-workflow.md).
- **CI** — build + unit + lint on every PR, real-Obsidian e2e in a parallel job.
- **Lint** — flat ESLint with `eslint-plugin-obsidianmd`, including JSON
  validation of `manifest.json`.
- **Docs scaffolding** — paired English/Russian README templates.

## Starting a new plugin

```bash
git clone https://github.com/rekby/obsidian-plugin-template.git my-plugin
cd my-plugin
git remote rename origin template
node scripts/init-plugin.mjs --id my-plugin --name "My Plugin"
npm install
npm run build && npm test && npm run lint
```

Cloning (rather than downloading) is what gives you shared history with the
template, so later updates are ordinary merges.

## Adopting the template in an existing plugin

See [`agents/template/template-sync.md`](../agents/template/template-sync.md).
The short version: one `git merge --allow-unrelated-histories`, then plain
`git merge template/master` forever after.

## Keeping the template current

`bash scripts/merge-upstream.sh` merges the official
[obsidianmd/obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
into the template. Plugins receive those changes through their normal sync.

## Layout

| Path | Owner | Purpose |
| --- | --- | --- |
| `obsidian-tests/lib/` | template | Test harness and determinism library |
| `obsidian-tests/fixture-plugin/` | template | Minimal plugin so the template tests itself |
| `templates/starter/` | template | Scaffolding for new plugins; never merged into live paths |
| `agents/template/` | template | Shared methodology docs |
| `scripts/` | template | Merge, scaffold and version helpers |
| `src/`, `manifest.json`, `docs/`, `tests/` | plugin | Never shipped by the template |

Full ownership table: [`agents/template/conventions.md`](../agents/template/conventions.md).

## License

AGPL-3.0-or-later.
