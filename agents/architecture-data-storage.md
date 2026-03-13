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

- `version` (`number`): settings schema version. Current value: `2`.
- `searchNonExistingNotes` (`boolean`, default `true`):
  - include unresolved `[[links]]` from `metadataCache.unresolvedLinks` in suggestions.
- `inlineLinkSuggest` (`boolean`, default `false`):
  - when `true`, plugin `EditorSuggest` handles `[[` trigger;
  - when `false`, native Obsidian suggest handles it.
- `swapEnterAndTab` (`boolean`, default `false`):
  - when `false` (default): Enter inserts without display text, Tab inserts with display text;
  - when `true`: Enter inserts with display text, Tab inserts without.
  - Migrated from v1 to v2: stored boolean was flipped to preserve existing user behavior after the default was inverted.

## `localStorage` fields

- key: `"natural-link-recentNotes"`
- value: `Record<string, number>` (`noteTitle -> lastUsedTimestamp`)

Managed by `src/search/recent-notes.ts` via:
- `app.loadLocalStorage("natural-link-recentNotes")`
- `app.saveLocalStorage("natural-link-recentNotes", data)`
- These APIs are official in Obsidian since v1.8.7.

`RecentNotes` keeps this map bounded (up to `MAX_RECENT_COUNT`) and exposes top-N recent entries for ranking.

Context ranking also reads non-persisted runtime signals:
- open markdown leaves via `workspace.getLeavesOfType("markdown")`;
- most recent leaf via `workspace.getMostRecentLeaf()`;
- edit timestamps via `TFile.stat.mtime`.

These runtime signals are not persisted by this plugin.

## Storage-related flow

1. Plugin loads synced settings (`data.json`) at startup.
2. UI selection events update recent-note timestamps in device-local storage.
3. Search returns base ranking from `NotesIndex`.
4. Context priority is computed from recent usage + file edit time + open leaves, but only for relevant candidates.
5. The final context boost list is capped (up to 5 notes).
6. Setting toggles (for inline suggest and unresolved note behavior) immediately influence UI query handling.
