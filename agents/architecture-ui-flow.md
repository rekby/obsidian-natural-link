# Architecture: UI flow

This file covers query parsing, suggestion generation, and insertion flow in both UI surfaces.
For stemming/search internals see `agents/architecture-search-morphology.md`.
For storage settings and recent-note persistence see `agents/architecture-data-storage.md`.

## Relevant modules

- `src/ui/query-parser.ts`: parses wikilink query into note/display/heading/block parts.
- `src/ui/link-suggest-core.ts`: shared engine for search, render, and link construction.
- `src/ui/natural-link-modal.ts`: `SuggestModal<LinkSuggestion>` wrapper (command/hotkey).
- `src/ui/natural-link-suggest.ts`: `EditorSuggest<LinkSuggestion>` wrapper (inline `[[` trigger).

## LinkSuggestion type

`LinkSuggestion` is a discriminated union used by both UIs:
- `{ type: "note"; note: NoteInfo; matchedAlias?: string }`
- `{ type: "heading"; note: NoteInfo; heading: string; level: number }`
- `{ type: "block"; note: NoteInfo; blockId: string; blockText: string; needsWrite?: { line: number } }`

## Query syntax handling

`parseQuery()` supports:
- `|` (pipe): explicit display text part.
- `#` (hash): heading filter within the best note match.
- `^` (caret): block suggestion/filtering within the best note match.

`#` and `^` are mutually exclusive; whichever appears first in the link target wins.

## Shared UI data flow

1. User input query is parsed by `parseQuery()` into `notePart` + optional sub-parts.
2. `notePart` is resolved via morphology-based search in `NotesIndex`.
3. If heading mode (`#`): read headings from metadata cache and filter by prefix.
4. If block mode (`^`): inspect all sections, show text previews, filter by text match and block-ID prefix, generate missing block IDs, and prepare `needsWrite` metadata.
5. If query is empty: use recent notes as top suggestions.
6. Build inserted link via `buildLink()`:
   - `Enter` inserts piped form `[[target|display]]`;
   - `Tab` inserts without explicit display (`[[target]]`).
7. `Shift+Enter` inserts `buildRawLink()` output (`[[raw|raw]]`).

## Modal flow

1. Command opens `NaturalLinkModal`.
2. `main.ts` prepares `NotesIndex` and `LinkSuggestCore` once for modal session.
3. Keystrokes call `core.getSuggestions(query)`.
4. Selection inserts built link with `editor.replaceSelection(link)`.

## Inline suggest flow (`[[`)

1. Typing `[[` triggers `NaturalLinkSuggest.onTrigger()`.
2. Plugin suggest is prioritized over native suggest while enabled. When inline suggest is disabled, `onTrigger()` returns `null` and native suggest takes over.
3. Each suggestion call builds fresh `LinkSuggestCore` to reflect current vault state.
4. Selection replaces the `[[...]]` range and writes generated block IDs when needed.
5. Instruction bar shows hotkey hints (including `Shift+Enter` behavior).
