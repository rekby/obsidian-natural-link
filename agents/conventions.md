# Conventions

## Coding conventions

- TypeScript strict mode is enabled and expected.
- `src/main.ts` stays minimal: plugin lifecycle + command registration + `EditorSuggest` registration.
- Keep one clear responsibility per file.
- `Stemmer` interface is intentionally extensible (future `lemmatize?()` support).
- All UI strings go through `t(key)` for localization.
- Link insertion modes:
  - `Enter`: piped format `[[Title|displayText]]` to preserve visible text on note rename;
  - `Tab`: no explicit display text `[[Title]]`;
  - `Shift+Enter`: raw-as-typed format `[[raw|raw]]`.
- Modal and inline suggest must delegate to `LinkSuggestCore` to avoid logic drift.

## i18n conventions

- Base language: English (`src/i18n/en.ts`)
- Supported now: English, Russian
- New locale pattern:
  - create `src/i18n/xx.ts` with `Partial<typeof en>`
  - register locale in `src/i18n/index.ts` `locales` map
- Keep compile-time key validation via `Partial<typeof en>`.

## Search and linking invariants

- Query processing:
  - Tokenize to lowercase words
  - Stem all words except the last one for exact stem matches
  - Use prefix matching for the last word and raw tokens
- Ranking stays weighted:
  - query match ratio (0.5)
  - source specificity (0.4)
  - title bonus (0.1)
- Partial matches are allowed but ranked lower.

## Architecture constraints to preserve

- Keep business logic decoupled from Obsidian APIs where possible for testability.
- Shared UI behavior must remain centralized in `src/ui/link-suggest-core.ts`.
- Use `RecentNotes` for recency boost and device-local persistence model.
