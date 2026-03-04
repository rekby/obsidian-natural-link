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
npm run lint         # ESLint
```

## Documentation maintenance policy

- Keep `README.md`, `README.ru.md`, and `AGENTS.md` up to date after feature changes.
- Keep docs readable: prefer restructuring over appending; remove outdated text.
- `README.md` is end-user documentation (English).
- `README.ru.md` is Russian translation and should stay in sync with `README.md`.
- `AGENTS.md` + `agents/*.md` are agent-facing docs and should stay precise and navigable.
- `agents/behavior-details.md` must be updated when design decisions are made or changed. If a rationale is unclear, ask the user.

## Security and dependency checks

- Once per session, run `npm audit` and suggest fixes for reported vulnerabilities.

## Known limitations

- Snowball stemming does not handle consonant alternations (for example: `бег` / `бежать` have different stems). Full coverage requires lemmatization or semantic search.
- No fuzzy/typo tolerance yet.

## Future extensions (designed but not implemented)

- Lemmatization: add `lemmatize?(word: string): string` to `Stemmer` interface for creating notes in base form.
- Fuzzy matching on stems for typo tolerance.
- Semantic/vector search replacing internal logic inside `NotesIndex` without changing its API.
