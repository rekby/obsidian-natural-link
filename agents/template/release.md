# Releasing

Releases are made by the **Publish Release** workflow
(`.github/workflows/publish.yml`), triggered manually from the Actions tab with
a `patch` / `minor` choice.

What it does:

1. Bumps the version with `npm version`. If `package.json` currently ends in
   `-pre-release`, that suffix is stripped and the bare version is released
   instead of bumping — that is how a plugin ships its first release.
2. `npm version` fires the `version` npm script, which runs `version-bump.mjs`:
   it writes the new version into `manifest.json` and adds a
   `version → minAppVersion` entry to `versions.json`, then `git add`s both so
   they land inside the version commit.
3. Builds, attests build provenance, pushes the commit and the tag, and creates
   a GitHub release with `main.js`, `manifest.json` and — if present —
   `styles.css` attached.

## Conventions that matter

- **Tags have no `v` prefix.** `.npmrc` sets `tag-version-prefix=""`; Obsidian's
  community-plugin tooling expects bare semver tags.
- **`main.js` is gitignored.** It exists only as a release asset.
- **`versions.json` is append-only** and maps each released version to the
  minimum Obsidian version it supports. Never rewrite past entries — older
  Obsidian installs use it to find the last compatible release.
- Raising `manifest.minAppVersion` also changes which Obsidian the e2e and demo
  suites run against, since both pin to it. Regenerate demo assets after such a
  bump and check the diff.

## Local dry run

```bash
npm run build          # tsc --noEmit + esbuild production bundle
ls -la main.js manifest.json styles.css
```

Nothing else needs doing locally — the workflow owns the whole release.
