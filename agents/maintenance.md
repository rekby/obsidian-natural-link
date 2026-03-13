# Maintenance

## Environment and tooling

- Node.js: v18+ recommended
- Package manager: npm
- Bundler: esbuild (`esbuild.config.mjs`)
- Test framework: Vitest (`vitest.config.ts`)
- Key dependency: `snowball-stemmers` (zero-dependency Snowball stemming for Russian and English)

## Common commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (esbuild)
npm run build        # Type check (tsc) + production build (esbuild)
npm test             # Run tests (vitest run)
npm run test:watch   # Watch mode tests (vitest)
npm run obsidian-tests # Build plugin and run real Obsidian UI tests
npm run demo:capture # Capture localized README demo frames in Obsidian
npm run demo:render  # Render demo GIFs via ffmpeg
npm run demo         # Full demo regeneration pipeline
npm run lint         # ESLint
```

## Documentation maintenance policy

- Keep `README.md`, `README.ru.md`, and `AGENTS.md` up to date after feature changes.
- Keep docs readable: prefer restructuring over appending; remove outdated text.
- `README.md` is end-user documentation (English).
- `README.ru.md` is Russian translation and should stay in sync with `README.md`.
- `AGENTS.md` + `agents/*.md` are agent-facing docs and should stay precise and navigable.
- `docs/demo/en/*.gif` and `docs/demo/ru/*.gif` are committed documentation assets and should be regenerated, not hand-edited.
- `agents/behavior-details.md` must be updated when design decisions are made or changed. If a rationale is unclear, ask the user.

## Demo media maintenance

- Raw demo frames/manifests under `obsidian-tests/demo-artifacts/` are temporary and must stay ignored.
- The demo render step requires `ffmpeg`. The render script should fail loudly when it is missing or misconfigured.
- Keep demo vaults in `obsidian-tests/demo-vaults/` readable and intentionally curated; they are documentation fixtures, not arbitrary test debris.

## Security and dependency checks

- Once per session, run `npm audit` and suggest fixes for reported vulnerabilities.

## Known limitations

- Snowball stemming plus current normalization improves many alternations, but does not cover all Russian lexical alternations (for example: `бег` / `бежать`). Full coverage requires lemmatization or semantic search.
- No fuzzy/typo tolerance yet.

## Future extensions (designed but not implemented)

- Lemmatization: add `lemmatize?(word: string): string` to `Stemmer` interface for creating notes in base form.
- Fuzzy matching on stems for typo tolerance.
- Semantic/vector search replacing internal logic inside `NotesIndex` without changing its API.
