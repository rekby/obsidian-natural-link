# Architecture: data and storage

This file covers persisted settings, device-local state, and storage-related flow.
For search internals see `agents/architecture-search-morphology.md`.
For UI behavior see `agents/architecture-ui-flow.md`.

## Storage model

Two storage layers are used:

- **Synced settings (`data.json`)**
  - persisted via plugin settings API;
  - synced by Obsidian Sync.

- **Device-local state (`localStorage`)**
  - not synced between devices;
  - used for recent note history and recency boosting.

## `data.json` fields

- `version` (`number`): settings schema version. Current value: `1`.
- `searchNonExistingNotes` (`boolean`, default `true`):
  - include unresolved `[[links]]` from `metadataCache.unresolvedLinks` in suggestions.
- `inlineLinkSuggest` (`boolean`, default `false`):
  - when `true`, plugin `EditorSuggest` handles `[[` trigger;
  - when `false`, native Obsidian suggest handles it.

## `localStorage` fields

- key: `"natural-link-recentNotes"`
- value: `Record<string, number>` (`noteTitle -> lastUsedTimestamp`)

Managed by `src/search/recent-notes.ts` via:
- `app.loadLocalStorage("natural-link-recentNotes")`
- `app.saveLocalStorage("natural-link-recentNotes", data)`
- These APIs are official in Obsidian since v1.8.7.

`RecentNotes` keeps this map bounded (up to `MAX_RECENT_COUNT`) and exposes `boostRecent()` for result ordering.

## Storage-related flow

1. Plugin loads synced settings (`data.json`) at startup.
2. UI selection events update recent-note timestamps in device-local storage.
3. Search returns base ranking from `NotesIndex`.
4. `RecentNotes.boostRecent()` reorders top results using local recency history.
5. Setting toggles (for inline suggest and unresolved note behavior) immediately influence UI query handling.
