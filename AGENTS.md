# Natural Link — Obsidian plugin

## Project overview

- **Name**: Natural Link (`obsidian-natural-link`)
- **Purpose**: Create links to notes using natural word forms. Finds matching notes regardless of word declension, order, or incomplete input.
- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Architecture

### File structure

```
src/
  main.ts                      # Plugin entry point, lifecycle, command registration
  settings.ts                  # Settings tab (version, searchNonExistingNotes toggle, hotkey button)
  types.ts                     # Core interfaces: Stemmer, NoteInfo, SearchResult
  snowball-stemmers.d.ts       # Type declarations for snowball-stemmers library
  stemming/
    russian-stemmer.ts         # Russian stemmer (Snowball algorithm, ё→е normalization)
    english-stemmer.ts         # English stemmer (Snowball algorithm)
    multi-stemmer.ts           # Composite stemmer: combines multiple language stemmers
  search/
    tokenizer.ts               # Text tokenization (split into words, lowercase)
    notes-index.ts             # NotesIndex: built from NoteInfo[] + Stemmer, search(query)
  i18n/
    index.ts                   # t(key) translation function, locale detection, EN fallback
    en.ts                      # English translations (base/fallback language)
    ru.ts                      # Russian translations
  ui/
    natural-link-modal.ts      # SuggestModal for searching and inserting links
tests/
  __mocks__/
    obsidian.ts                # Minimal Obsidian API mock for testing
  stemming/
    russian-stemmer.test.ts
    english-stemmer.test.ts
    multi-stemmer.test.ts
  search/
    tokenizer.test.ts
    notes-index.test.ts
  i18n/
    i18n.test.ts
```

### Key modules

- **Stemmer interface** (`types.ts`): `stem(word: string): string[]`. Implementations wrap the `snowball-stemmers` library. `RussianStemmer` normalizes `ё` → `е` before stemming (Snowball doesn't recognize `ё`). `MultiStemmer` composes multiple language stemmers and deduplicates results.
- **NotesIndex** (`search/notes-index.ts`): Built from `NoteInfo[]` + `Stemmer`. Provides `search(query): SearchResult[]`. Handles tokenization, stemming, prefix matching for incomplete last word, and ranking internally. Built once per modal open.
- **i18n** (`i18n/`): Simple key-value translations. `en.ts` is the base language (all keys required). Other locales use `Partial<typeof en>` for compile-time key validation. Locale detected via `moment.locale()`.
- **NaturalLinkModal** (`ui/natural-link-modal.ts`): Obsidian `SuggestModal`. Gets `NotesIndex` in constructor. Inserts `[[NoteTitle|userInput]]` on selection. Supports Shift+Enter to insert `[[rawInput|rawInput]]` bypassing search results.

### Search algorithm

1. Tokenize query into words (lowercase, strip punctuation)
2. All words except the last: stem with all enabled stemmers, match stems exactly against note title/alias stems
3. Last word: match as prefix of stems or original tokens (supports incomplete input)
4. Partial matches allowed (not all query words need to match), ranked lower
5. Ranking: query match ratio (0.5) + source specificity (0.4) + title bonus (0.1)

### Settings

- **`version`** (`number`): Schema version for future migrations. Current: `1`.
- **`searchNonExistingNotes`** (`boolean`, default `true`): When enabled, search results include notes referenced by `[[links]]` that don't exist yet as files. Uses `metadataCache.unresolvedLinks` to collect unresolved link targets, deduplicates against existing notes.

### Data flow

1. User invokes command → `main.ts` collects `NoteInfo[]` from Obsidian API (`vault.getMarkdownFiles()` + `metadataCache`). If `searchNonExistingNotes` is enabled, also collects unresolved link targets via `metadataCache.unresolvedLinks`.
2. Builds `NotesIndex(notes, multiStemmer)`
3. Opens `NaturalLinkModal` with the index
4. On each keystroke: `index.search(query)` returns ranked results
5. On selection (Enter): inserts `[[NoteTitle|userInput]]` via editor
6. On Shift+Enter: inserts `[[rawInput|rawInput]]` (link as typed, bypasses search results)

## Environment & tooling

- Node.js: v18+ recommended
- **Package manager**: npm
- **Bundler**: esbuild (`esbuild.config.mjs`)
- **Test framework**: Vitest (`vitest.config.ts`)
- **Key dependency**: `snowball-stemmers` (zero-dependency Snowball stemming for Russian and English)

### Commands

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (esbuild)
npm run build        # Type check (tsc) + production build (esbuild)
npm test             # Run tests (vitest run)
npm run test:watch   # Watch mode tests (vitest)
npm run lint         # ESLint
```

## Testing

- **Framework**: Vitest with obsidian mock (`tests/__mocks__/obsidian.ts`)
- **Mock strategy**: Obsidian API is mocked via vitest alias in `vitest.config.ts`. All business logic (stemming, tokenization, search) is independent of Obsidian and fully testable.
- **TDD approach**: Tests written before implementation for stemming, tokenizer, NotesIndex, and i18n.

## Coding conventions

- TypeScript with strict checks enabled.
- `main.ts` is minimal: lifecycle + command registration only. Feature logic delegated to modules.
- Each file has a single responsibility.
- `Stemmer` interface designed for extensibility (future: lemmatization via `lemmatize?()` method).
- All UI strings go through `t(key)` for i18n.
- Links always use piped format `[[Title|displayText]]` to preserve user input on note rename.

## i18n

- Base language: English (`src/i18n/en.ts`)
- Supported: English, Russian
- Adding a new language: create `src/i18n/xx.ts` with `Partial<typeof en>`, register in `src/i18n/index.ts` `locales` map
- Compile-time key validation via `Partial<typeof en>` type

## Plugin command

- **ID**: `insert-natural-link`
- **Type**: `editorCallback` (available only when editor is active)
- **No default hotkey assigned**. Recommended: Cmd/Ctrl+Shift+K (documented in README). User assigns via Settings → Hotkeys.

## Known limitations

- Snowball stemming does not handle consonant alternations (e.g. бег/бежать have different stems). Requires lemmatization or semantic search for full coverage.
- No fuzzy/typo tolerance yet.

## Documentation maintenance

- **Keep `README.md`, `README.ru.md`, and `AGENTS.md` up to date**: when adding, changing, or removing features, update all three files to reflect the current state.
- **Readability first**: these files should be well-structured and easy to read. When updating, don't just append new information — restructure sections as needed to maintain logical flow and avoid duplication. Remove outdated content.
- `README.md` is for the end user (English). `README.ru.md` is the Russian translation — keep it in sync with `README.md`.
- `AGENTS.md` is for the AI agent: file structure, modules, algorithms, conventions, limitations. Keep it precise and navigable.

## Future extensions (designed for but not yet implemented)

- Lemmatization: add `lemmatize?(word: string): string` to `Stemmer` interface for creating notes in base form
- Fuzzy matching on stems for typo tolerance
- Semantic/vector search (can replace search logic inside `NotesIndex` without changing its API)
- Inline `[[` integration via `EditorSuggest`
