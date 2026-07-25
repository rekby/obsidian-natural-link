# {{PLUGIN_NAME}} — notes for agents

Shared conventions live in [`agents/template/`](agents/template/) and come from
the plugin template. **Do not edit those files here** — change them in the
template and sync, otherwise the next sync conflicts.

- [conventions.md](agents/template/conventions.md) — file ownership, key order
- [testing.md](agents/template/testing.md) — unit / e2e / demo layers
- [demo-workflow.md](agents/template/demo-workflow.md) — reproducible screenshots
- [release.md](agents/template/release.md) — how a release is cut
- [template-sync.md](agents/template/template-sync.md) — pulling template updates

## This plugin

_What it does, and the one or two design decisions a newcomer would otherwise
get wrong._

## Verify before calling a change done

```bash
npm run build && npm test && npm run lint
npm run obsidian-tests
```

If demo scenarios or their vaults changed, also `npm run demo` and commit the
regenerated `docs/demo/**` together with `CHECKSUMS.txt`.

`README.md` (English) and `README.ru.md` (Russian) are a pair: same structure
and the same technical facts, translated prose.
