# Testing

Three layers, three commands:

```bash
npm test              # unit, Vitest, plain Node
npm run obsidian-tests   # functional e2e against a real Obsidian
npm run demo          # demo capture (assets, not assertions)
```

## Unit tests — Vitest

Live in `tests/**/*.test.ts` (or next to the source as `src/**/*.test.ts`).
`vitest.config.ts` aliases the `obsidian` module to `tests/__mocks__/obsidian.ts`
instead of calling `vi.mock("obsidian")` in every file: one stub, and it also
covers transitive imports.

The stub is deliberately minimal and plugin-owned — add to it only what your
plugin actually touches.

**Design for this layer.** Keep the logic that deserves unit tests free of
Obsidian types: pure functions over strings, paths and plain objects. A plugin
whose core is pure needs almost no mocking; one that reaches into `App`
everywhere can only be tested end-to-end, which is 100× slower.

## Functional e2e — WebdriverIO + real Obsidian

Live in `obsidian-tests/specs/**/*.e2e.mjs`, run by `wdio.conf.mjs`.
`wdio-obsidian-service` downloads a real Obsidian (cached in `.obsidian-cache/`),
copies the vault to a temp dir, installs the plugin and enables it.

Useful pieces from `obsidian-tests/lib/`:

- `waitForPlugin(pluginId)` — always call this before touching plugin state.
- `setPluginSettings(pluginId, patch)` — pin settings a test depends on.
- `runBounded(fn, arg, ms)` — run an in-app call against a time budget and get
  back `"ok"` / `"error:…"` / `"timeout"`. Use it for "does this hang or crash?"
  cases instead of letting the 180 s mocha timeout expire.
- `ensureHardlink()` / `writeVaultNote()` — write fixtures into the service's
  temp vault copy (`obsidianPage.getVaultPath()`), not into the repo. Hardlink
  large binaries rather than copying them per test.
- `syncVaultFiles()` + `waitForMetadataResolved()` — reset vault content between
  tests without restarting Obsidian.

Launch Obsidian once per suite (`before`), reset state per test (`beforeEach`).
A restart costs ~10 s and is almost never necessary.

## What CI runs

`test.yml` on every push and PR: build, unit tests, lint. `e2e.yml` in parallel:
the real-Obsidian suite under `xvfb-run`, with both npm and Obsidian downloads
cached. Demo generation is **not** in CI — it is a local, deliberate act whose
output is committed.

## Before calling a change done

```bash
npm run build && npm test && npm run lint
npm run obsidian-tests
```

If demo scenarios or the vaults behind them changed, also `npm run demo` and
commit the regenerated assets with their checksums.
