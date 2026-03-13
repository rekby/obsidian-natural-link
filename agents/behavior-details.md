# Behavior details

Design rationale and cross-cutting behaviors not covered in user-facing docs.
For architecture see `agents/architecture-overview.md`.
For UI flow see `agents/architecture-ui-flow.md`.

## Maintenance rule

When implementing a feature or changing behavior, add the design rationale here.
If the reason behind a decision is unclear from the code, ask the user to explain — then document the answer in this file.

## Design decisions

- **Piped link format `[[Title|text]]`**: always used so that display text survives note renames. Even "as typed" mode produces `[[raw|raw]]` for the same reason: if a note with that name exists or is created later and then renamed, the user's original text stays visible.
- **SuggestSession caches resolved note once**: when user types `#` or `^`, the session locks to the currently highlighted note. This ensures heading/block filtering works against one stable note, not a shifting search result.
- **Reverse prefix matching** (`lastToken.startsWith(sourceStem)` in `src/search/notes-index.ts`): needed to find notes while the user is still typing a longer word form. Example: user types `"деревянн"`, source stem is shorter — the user's input starts with the stem, so the note is found mid-keystroke.
- **Russian consonant alternation normalization** (`src/stemming/russian-stemmer.ts`): after Snowball stemming, stems are canonicalized to a shared form so related alternated forms (for example `друг/друж`, `ход/хож`, `плат/плач`) match more reliably in search. The exact mapping is intentionally kept in code and tests rather than documented here.
- **`BLOCK_ID_LENGTH = 6` hex chars**: matches the format Obsidian itself generates for block IDs.
- **Three inline suggest commands (toggle / enable / disable)**: enable and disable exist so the user can bind hotkeys to a target state and press them without needing to know the current state. Toggle alone requires awareness of current state.
- **`searchNonExistingNotes` defaults to `true`**: repeats standard Obsidian behavior where unresolved links appear in search.
- **Empty query shows recent notes**: provides quick access to recently used notes when opening the modal or typing `[[` without a query.
- **README demos use separate localized vaults**: documentation capture runs against dedicated English and Russian vaults so README media stays deterministic and does not depend on smoke-test fixtures.
- **README GIFs are rendered from element screenshots, not desktop capture**: WebdriverIO captures the Obsidian app container frame-by-frame and `ffmpeg` assembles the GIFs. This keeps output deterministic and avoids recording unrelated desktop UI.

## Cross-cutting behaviors

Behaviors spanning multiple modules that require reading 3+ files to piece together.

- **Inline suggest priority chain** (`src/main.ts` → `src/ui/natural-link-suggest.ts`): `prioritizeSuggest()` moves plugin suggest to the front of Obsidian's internal `editorSuggest.suggests` array (undocumented API). When the setting is off, `onTrigger()` returns `null` and native suggest handles `[[`. If the internal API changes, suggest still works but at lower priority (silent fallback).
- **Edit-in-place flow** (`src/ui/natural-link-suggest.ts` → `src/ui/link-suggest-core.ts`): when cursor is inside existing `[[...]]`, `resolveEditingContext()` extends replacement range past `]]` and extracts the original `|display` text. `buildLink()` receives this as `explicitDisplay` and preserves it. The `[[` and `]]` brackets are also consumed by `replaceRange()`.
- **Sub-link resolution** (`src/ui/suggest-session.ts` → modal/suggest → `src/ui/link-suggest-core.ts`): while in note search mode, `SuggestSession` stores the last suggestion list. When `#` or `^` is typed, `getResolvedNote()` reads the UI's highlighted index (via internal Obsidian API, fallback to 0), locks to that note, and all subsequent heading/block queries filter within that single note.
- **Block ID write flow** (`src/ui/link-suggest-core.ts` → Obsidian vault): selecting a block without `^id` triggers `prepareBlockId()` (generates 6 hex chars, checks vault-wide uniqueness via `metadataCache`), then `writeBlockIdIfNeeded()` appends ` ^{id}` to the line via `vault.process()`. This is a side effect: selecting a suggestion modifies the target file.
- **Display text extraction** (`src/ui/link-suggest-core.ts` → `src/ui/query-parser.ts`): display text is the `notePart` (text the user typed before `#`, `^`, or `|`), not the heading/block part. So `"заметка#заголовок"` produces display `"заметка"`. The intent: display text represents what the user was "saying", not the navigation path.
