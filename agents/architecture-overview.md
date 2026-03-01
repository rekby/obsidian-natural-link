# Architecture overview

This file is a short module map. Detailed behavior lives in:
- `agents/architecture-search-morphology.md`
- `agents/architecture-ui-flow.md`
- `agents/architecture-data-storage.md`

## Module map and responsibilities

- **Plugin entry and wiring**
  - `src/main.ts`: plugin lifecycle, command registration, and `EditorSuggest` registration.
  - `src/settings.ts`: settings tab and settings toggles UI.

- **Core domain types**
  - `src/types.ts`: shared interfaces such as `Stemmer`, `NoteInfo`, `SearchResult`, and `LinkSuggestion`.
  - `src/snowball-stemmers.d.ts`: type definitions for `snowball-stemmers`.

- **Morphology and search**
  - `src/stemming/*`: language-specific stemming and multi-language composition.
  - `src/search/*`: tokenization, note indexing, ranking, and recent-note boosting hooks.
  - Details: `agents/architecture-search-morphology.md`.

- **UI and interaction flow**
  - `src/ui/query-parser.ts`: wikilink query parsing (`|`, `#`, `^`).
  - `src/ui/link-suggest-core.ts`: shared suggestion/render/link-building logic.
  - `src/ui/natural-link-modal.ts`: command/hotkey modal wrapper.
  - `src/ui/natural-link-suggest.ts`: inline `[[` suggest wrapper.
  - Details: `agents/architecture-ui-flow.md`.

- **Localization**
  - `src/i18n/index.ts`: locale detection and `t(key)`.
  - `src/i18n/en.ts`, `src/i18n/ru.ts`: base and localized strings.

- **Tests**
  - `tests/__mocks__/obsidian.ts`: Obsidian API mock.
  - `tests/stemming`, `tests/search`, `tests/ui`, `tests/i18n`: behavior-focused unit tests by module.

## Source of truth split

- Search and stemming internals: `agents/architecture-search-morphology.md`
- UI query/selection/insert flow: `agents/architecture-ui-flow.md`
- Settings and persistence model: `agents/architecture-data-storage.md`
