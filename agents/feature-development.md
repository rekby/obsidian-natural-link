# Feature development

This guide describes how to add or change user-facing functionality while keeping behavior consistent across both UIs (`NaturalLinkModal` and `NaturalLinkSuggest`).

## Main rule

- Keep `src/main.ts` minimal (lifecycle and registration only).
- Implement feature logic in focused modules (`src/search/`, `src/stemming/`, `src/ui/`, `src/i18n/`).
- Avoid duplicating behavior between modal and inline suggest. Shared behavior must live in `src/ui/link-suggest-core.ts`.

## Feature workflow

1. Identify affected area:
   - Search / ranking: `src/search/notes-index.ts`
   - Word normalization / stemming: `src/stemming/*`
   - Link query parsing: `src/ui/query-parser.ts`
   - Suggest rendering or insertion: `src/ui/link-suggest-core.ts`
   - Command registration or lifecycle: `src/main.ts`
2. Add or adjust tests first in corresponding `tests/**`.
3. Implement minimal change in the narrowest module.
4. Ensure both UIs get the same behavior via `LinkSuggestCore`.
5. Update docs (`README.md`, `README.ru.md`, `AGENTS.md` + relevant `agents/*.md` file).

## Special character handling in wikilinks

Both UIs support wikilink special characters via `parseQuery()`:

- **`|` (pipe)**: Splits query into link target and explicit display text. Example: `note|custom text` -> link target is `note`, display text is `custom text`.
- **`#` (hash)**: After the note part, filters headings from the best-matching note via `metadataCache`. Example: `note#intro` -> searches for `note`, then filters headings by `intro` prefix.
- **`^` (caret)**: After the note part, shows all text blocks (sections) from the best-matching note with text previews, filtered by prefix. Existing `^id` markers are preserved. Blocks without IDs get a generated unique ID (written to the file on selection via `vault.process()`).
- `#` and `^` are mutually exclusive - whichever appears first in the link target wins.

## Settings and storage

Settings are stored in `data.json` (synced via Obsidian Sync). Device-local state is stored in `localStorage` (not synced).

### `data.json` (synced)

- `version` (`number`): Schema version for future migrations. Current: `1`.
- `searchNonExistingNotes` (`boolean`, default `true`): Include unresolved `[[links]]` in search results via `metadataCache.unresolvedLinks`.
- `inlineLinkSuggest` (`boolean`, default `false`): Controls whether plugin suggest takes over `[[` trigger.

### `localStorage` (device-local, not synced)

- `recentNotes` (`Record<string, number>`): Note title -> timestamp map used by `RecentNotes`.
- Stored via `app.loadLocalStorage("natural-link-recentNotes")` / `app.saveLocalStorage("natural-link-recentNotes", ...)`.

## Plugin commands

- **`insert-link`**
  - Type: `editorCallback` (editor must be active)
  - Behavior: opens `NaturalLinkModal` and inserts selected link into current editor.
- **`toggle-inline-link-suggest`**
  - Type: `callback`
  - Behavior: toggles `settings.inlineLinkSuggest`, persists with `saveSettings()`, shows localized notice.
- **`enable-inline-link-suggest`**
  - Type: `callback`
  - Behavior: sets `settings.inlineLinkSuggest = true`, persists setting, shows localized enabled notice.
- **`disable-inline-link-suggest`**
  - Type: `callback`
  - Behavior: sets `settings.inlineLinkSuggest = false`, persists setting, shows localized disabled notice.
- No default hotkey assigned. Recommended: Cmd/Ctrl+Shift+K for `insert-link`.

## Before finishing a feature

- Run tests and lint (see `agents/testing.md` and `agents/maintenance.md`).
- Verify no behavior drift between modal and inline suggest.
- Ensure i18n keys and docs are updated for any visible text or behavior changes.
