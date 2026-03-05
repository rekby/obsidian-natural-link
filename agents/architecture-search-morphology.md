# Architecture: search and morphology

This file covers stemming, tokenization, indexing, and ranking.
For UI behavior see `agents/architecture-ui-flow.md`.
For persistence details see `agents/architecture-data-storage.md`.

## Relevant modules

- `src/types.ts` (`Stemmer`): `stem(word: string): string[]`
- `src/stemming/russian-stemmer.ts`: Russian Snowball stemming with `ё -> е` plus consonant alternation normalization (`г/д/з/ж`, `к/т/ц/ч`, `х/с/ш`, `ст/ск/щ`, `б/бл`, `п/пл`, `в/вл`, `м/мл`, `ф/фл`)
- `src/stemming/english-stemmer.ts`: English Snowball stemming
- `src/stemming/multi-stemmer.ts`: combines enabled stemmers and deduplicates stems
- `src/search/tokenizer.ts`: word tokenization and lowercasing
- `src/search/notes-index.ts`: index construction and query search
- `src/search/recent-notes.ts`: recency boost source used after search
- `src/search/link-aliases.ts`: enriches `NoteInfo.aliases` with displayTexts from wikilinks

## Search pipeline

1. Tokenize query into words (lowercase, strip punctuation).
2. For all words except the last:
   - stem with all enabled stemmers;
   - match stems exactly against note title/alias stems.
3. For the last word:
   - match by prefix against stems or original tokens;
   - supports incomplete user input.
4. Allow partial matches (not all query words are required), but rank them lower.
5. Apply ranking formula:
   - query match ratio (`0.5`)
   - source specificity (`0.4`)
   - title bonus (`0.1`)

## Link displayText as aliases

Before `NotesIndex` is built, `collectNotes()` in `src/main.ts` calls `collectLinkDisplayTexts()` to scan all wikilinks in the vault and collect explicitly-set display texts (links that contain `|`, e.g. `[[Note|display]]`). These are passed to `addLinkDisplayAliases()` (`src/search/link-aliases.ts`) which appends each unique displayText to the target note's `aliases` array, skipping values that duplicate the note title or an existing alias. Auto-generated display texts (e.g. `"Note > Heading"` for `[[Note#Heading]]`) are excluded because their `original` field does not contain `|`.

## NotesIndex role

`NotesIndex` is built from `NoteInfo[]` and `Stemmer`. It encapsulates:
- tokenization and normalization;
- stem-level matching strategy;
- prefix handling for incomplete final token;
- ranking logic.

## Recency integration

`RecentNotes.boostRecent()` is applied on top of base search results to prioritize recently selected notes.
Storage format and persistence APIs are documented in `agents/architecture-data-storage.md`.
