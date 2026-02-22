# Natural link — Obsidian plugin

## Project overview

- **Name**: Natural link (`obsidian-natural-link`)
- **Purpose**: Create links to notes using natural word forms. Finds matching notes regardless of word declension, order, or incomplete input.
- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Architecture

### File structure

```
src/
  main.ts                      # Plugin entry point, lifecycle, command & EditorSuggest registration
  settings.ts                  # Settings tab (version, searchNonExistingNotes, inlineLinkSuggest toggles, hotkey button)
  types.ts                     # Core interfaces: Stemmer, NoteInfo, SearchResult, LinkSuggestion
  snowball-stemmers.d.ts       # Type declarations for snowball-stemmers library
  stemming/
    russian-stemmer.ts         # Russian stemmer (Snowball algorithm, ё→е normalization)
    english-stemmer.ts         # English stemmer (Snowball algorithm)
    multi-stemmer.ts           # Composite stemmer: combines multiple language stemmers
  search/
    tokenizer.ts               # Text tokenization (split into words, lowercase)
    notes-index.ts             # NotesIndex: built from NoteInfo[] + Stemmer, search(query)
    recent-notes.ts            # RecentNotes: tracks recently selected notes, boosts them in results
  i18n/
    index.ts                   # t(key) translation function, locale detection, EN fallback
    en.ts                      # English translations (base/fallback language)
    ru.ts                      # Russian translations
  ui/
    query-parser.ts            # parseQuery(): splits wikilink query by |, #, ^ delimiters
    link-suggest-core.ts       # LinkSuggestCore: shared search, rendering, link-building logic
    natural-link-modal.ts      # SuggestModal wrapper (command/hotkey)
    natural-link-suggest.ts    # EditorSuggest wrapper (inline [[ trigger)
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
    recent-notes.test.ts
  i18n/
    i18n.test.ts
  ui/
    query-parser.test.ts
    link-suggest-core.test.ts
```

### Key modules

- **Stemmer interface** (`types.ts`): `stem(word: string): string[]`. Implementations wrap the `snowball-stemmers` library. `RussianStemmer` normalizes `ё` → `е` before stemming (Snowball doesn't recognize `ё`). `MultiStemmer` composes multiple language stemmers and deduplicates results.
- **NotesIndex** (`search/notes-index.ts`): Built from `NoteInfo[]` + `Stemmer`. Provides `search(query): SearchResult[]`. Handles tokenization, stemming, prefix matching for incomplete last word, and ranking internally.
- **RecentNotes** (`search/recent-notes.ts`): Tracks recently selected notes by title and timestamp. `boostRecent()` prepends the most recent selections to the top of search results. Stored in device-local `localStorage` via `app.loadLocalStorage` / `app.saveLocalStorage` (not synced). Prunes to `MAX_RECENT_COUNT` (1000) entries.
- **i18n** (`i18n/`): Simple key-value translations. `en.ts` is the base language (all keys required). Other locales use `Partial<typeof en>` for compile-time key validation. Locale detected via `moment.locale()`.
- **parseQuery** (`ui/query-parser.ts`): Splits a raw wikilink query by `|` (display text), `#` (heading), and `^` (block reference). `|` is checked first, then `#` or `^` within the link target. Returns a `ParsedQuery` with `notePart`, optional `headingPart`/`blockPart`/`displayPart`.
- **LinkSuggestCore** (`ui/link-suggest-core.ts`): Shared logic for both the modal and inline suggest. Receives dependencies (app, note collector, stemmer, recentNotes, settings) and provides `getSuggestions()` (async), `renderSuggestion()`, `buildLink()`, `buildRawLink()`, `writeBlockIdIfNeeded()`. Handles query parsing, morphological search, heading/block sub-link resolution (including section-based block suggestions with ID generation), and unified rendering. Both UI wrappers delegate to this class.
- **NaturalLinkModal** (`ui/natural-link-modal.ts`): Obsidian `SuggestModal<LinkSuggestion>` wrapper. Delegates to `LinkSuggestCore` for all search, rendering, and link-building logic. Handles Shift+Enter for raw link insertion.
- **NaturalLinkSuggest** (`ui/natural-link-suggest.ts`): Obsidian `EditorSuggest<LinkSuggestion>` registered via `registerEditorSuggest()`. Moved to front of internal suggests array via `prioritizeSuggest()` so it is checked before the native `[[` suggest. Triggers on `[[` when `inlineLinkSuggest` is enabled; returns `null` from `onTrigger` when disabled (native suggest takes over). Shows hotkey hints via `setInstructions`. Delegates to `LinkSuggestCore` for search/rendering.

### LinkSuggestion type

`LinkSuggestion` is a discriminated union used by both UIs:
- `{ type: "note"; note: NoteInfo; matchedAlias?: string }` — a matching note
- `{ type: "heading"; note: NoteInfo; heading: string; level: number }` — a heading within a note (after `#`)
- `{ type: "block"; note: NoteInfo; blockId: string; blockText: string; needsWrite?: { line: number } }` — a block within a note (after `^`). Shows text preview. `needsWrite` is set when the block ID was generated (not yet in file) and needs to be appended on selection.

### Search algorithm

1. Tokenize query into words (lowercase, strip punctuation)
2. All words except the last: stem with all enabled stemmers, match stems exactly against note title/alias stems
3. Last word: match as prefix of stems or original tokens (supports incomplete input)
4. Partial matches allowed (not all query words need to match), ranked lower
5. Ranking: query match ratio (0.5) + source specificity (0.4) + title bonus (0.1)

### Special character handling

Both UIs support wikilink special characters via `parseQuery()`:

- **`|` (pipe)**: Splits query into link target and explicit display text. Example: `note|custom text` → link target is "note", display text is "custom text".
- **`#` (hash)**: After the note part, filters headings from the best-matching note via `metadataCache`. Example: `note#intro` → searches for "note", then filters its headings by "intro" prefix.
- **`^` (caret)**: After the note part, shows ALL text blocks (sections) from the best-matching note with text previews, filtered by prefix. Existing `^id` markers are preserved. Blocks without IDs get a generated unique ID (written to the file on selection via `vault.process()`). Example: `note^intro` → searches for "note", shows sections whose text contains "intro" or whose block ID starts with "intro".
- `#` and `^` are mutually exclusive — whichever appears first in the link target wins.

### Settings and storage

Settings are stored in `data.json` (synced via Obsidian Sync). Device-local state is stored in `localStorage` (not synced).

**`data.json`** (synced):
- **`version`** (`number`): Schema version for future migrations. Current: `1`.
- **`searchNonExistingNotes`** (`boolean`, default `true`): When enabled, search results include notes referenced by `[[links]]` that don't exist yet as files. Uses `metadataCache.unresolvedLinks` to collect unresolved link targets, deduplicates against existing notes.
- **`inlineLinkSuggest`** (`boolean`, default `false`): When enabled, the plugin's `EditorSuggest` takes over `[[` triggers and replaces the native autocomplete with morphological search. When disabled, `onTrigger` returns `null` and the native suggest works as usual.

**`localStorage`** (device-local, not synced):
- **`recentNotes`** (`Record<string, number>`): Map of note title → timestamp. Tracks recently selected notes to boost them in search results. Managed by `RecentNotes` class. Stored via `app.loadLocalStorage("natural-link-recentNotes")` / `app.saveLocalStorage("natural-link-recentNotes", ...)` (official Obsidian API since v1.8.7).

### Data flow

Both the modal and the inline suggest share the same data flow through `LinkSuggestCore`:

1. User input (query string) → `parseQuery()` splits by `|`, `#`, `^`
2. `notePart` → morphological search via `NotesIndex.search()`
3. If `#` present: resolve best note → fetch `metadataCache.getFileCache(file).headings` → filter by prefix
4. If `^` present: resolve best note → read all sections via `metadataCache.getFileCache(file).sections` + file content → show text previews, generate block IDs for sections without one → on selection, write `^id` to file via `vault.process()`
5. If empty query: return recent notes from `RecentNotes`
6. Results boosted by `RecentNotes.boostRecent()`
7. On selection (Enter): `buildLink()` → `[[target|display]]` via editor
8. On Shift+Enter: `buildRawLink()` → `[[raw|raw]]` via editor

#### Modal (command/hotkey)

1. User invokes command → `main.ts` collects `NoteInfo[]`, builds `NotesIndex` + `LinkSuggestCore`
2. Opens `NaturalLinkModal` with the pre-built core (index built once)
3. On each keystroke: `core.getSuggestions(query)` returns ranked `LinkSuggestion[]`
4. On selection: `core.buildLink()` → `editor.replaceSelection(link)`

#### Inline suggest (`[[` trigger)

1. User types `[[` → `NaturalLinkSuggest.onTrigger()` detects `[[`, extracts query
2. Our suggest is placed at the front of the internal suggests array (`prioritizeSuggest()`) so it fires before the native `[[` suggest. Returns `null` when `inlineLinkSuggest` is disabled (native suggest handles it).
3. `getSuggestions()` builds a fresh `LinkSuggestCore` per call (notes may change)
4. On selection: `core.buildLink()` → replaces range from `[[` to `]]` inclusive; for block suggestions with generated IDs, `core.writeBlockIdIfNeeded()` writes `^id` to the target file
5. Shows instruction bar with hotkey hints (Shift+Enter, etc.)

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
- **Mock strategy**: Obsidian API is mocked via vitest alias in `vitest.config.ts`. All business logic (stemming, tokenization, search, query parsing, link building) is independent of Obsidian and fully testable.
- **TDD approach**: Tests written before implementation for stemming, tokenizer, NotesIndex, i18n, query parser, and link building.

## Coding conventions

- TypeScript with strict checks enabled.
- `main.ts` is minimal: lifecycle + command registration + `EditorSuggest` registration. Feature logic delegated to modules.
- Each file has a single responsibility.
- `Stemmer` interface designed for extensibility (future: lemmatization via `lemmatize?()` method).
- All UI strings go through `t(key)` for i18n.
- Links always use piped format `[[Title|displayText]]` to preserve user input on note rename.
- Both UIs (modal and inline suggest) delegate to `LinkSuggestCore` — no duplicated logic.

## i18n

- Base language: English (`src/i18n/en.ts`)
- Supported: English, Russian
- Adding a new language: create `src/i18n/xx.ts` with `Partial<typeof en>`, register in `src/i18n/index.ts` `locales` map
- Compile-time key validation via `Partial<typeof en>` type

## Plugin command

- **ID**: `insert-link`
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
