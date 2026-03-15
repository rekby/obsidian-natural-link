# Architecture: search and morphology

This file covers stemming, tokenization, indexing, and ranking.
For UI behavior see `agents/architecture-ui-flow.md`.
For persistence details see `agents/architecture-data-storage.md`.

## Relevant modules

- `src/types.ts` (`Stemmer`): `stem(word: string): string[]`, optional `stemPrefix(prefix: string): string[]`
- `src/stemming/russian-stemmer.ts`: Russian Snowball stemming with `ё -> е` plus consonant alternation normalization (`г/д/з/ж`, `к/т/ц/ч`, `х/с/ш`, `ст/ск/щ`, `б/бл`, `п/пл`, `в/вл`, `м/мл`, `ф/фл`)
- `src/stemming/russian-base-stem.ts`: extracted Russian base stemming primitives used both at runtime and in dictionary generation filters
- `src/stemming/english-stemmer.ts`: English Snowball stemming
- `src/stemming/irregular-forms.ts`: `IrregularFormsLookup`, shared irregular dictionary logic with stem-level matching and prefix lookup for incomplete last token; prefix canonical lookups are cached (bounded FIFO, max 1024 entries) per lookup instance
- `src/stemming/english-irregular-forms.ts`: English irregular dictionary (`irregular -> canonical`)
- `src/stemming/russian-irregular-forms.ts`: Russian irregular dictionary (`irregular -> canonical`)
- `src/stemming/multi-stemmer.ts`: combines enabled stemmers and deduplicates stems
- `scripts/dictionaries/opencorpora-source.ts`: OpenCorpora download + parser (`<lemma><l t=.../><f t=.../>`)
- `scripts/dictionaries/wordnet-source.ts`: WordNet 3.1 dict download + parser for `*.exc` exception lists
- `scripts/dictionaries/build-russian-irregular-forms.ts`: build-time filtering and stem-aware dedup (`form -> canonical`) before generating runtime dictionary file
- `scripts/dictionaries/build-english-irregular-forms.ts`: build-time filtering of WordNet exceptions against English Snowball stems before generating runtime dictionary file
- `scripts/dictionaries/emit-ts-map.ts`: deterministic TypeScript `ReadonlyMap` emitter for generated dictionaries
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
   - if stemmers implement `stemPrefix()`, include dictionary-derived canonical stems for irregular-prefix typing;
   - supports incomplete user input.
4. Allow partial matches (not all query words are required), but rank them lower.
5. Apply ranking formula:
   - query match ratio (`0.5`)
   - source specificity (`0.4`)
   - title bonus (`0.1`)

## Russian dictionary generation (build-time)

1. `npm run dict:ru:build` downloads OpenCorpora export archive (`dict.opcorpora.xml.bz2`) into `.cache/dictionaries/opencorpora/` when missing.
2. Parser extracts `form -> lemma` pairs from each `lemma` entry in XML.
3. Generator normalizes lowercase + `ё -> е`, skips non-Russian and identity pairs, and drops any pair already covered by base Russian stemming (`russianBaseStem(form)` intersects `russianBaseStem(lemma)`).
4. Remaining pairs are deduplicated by `(canonical, stem(form))` so runtime map avoids multiple keys that collapse to the same stem bucket.
5. Final deterministic map is written to `src/stemming/russian-irregular-forms.ts`.

## English dictionary generation (build-time)

1. `npm run dict:en:build` downloads WordNet 3.1 dictionary archive (`wn3.1.dict.tar.gz`) into `.cache/dictionaries/wordnet/` when missing.
2. Parser reads WordNet exception lists (`noun.exc`, `verb.exc`, `adj.exc`, `adv.exc`) and expands each line to `form -> canonical` pairs.
3. Generator normalizes lowercase, skips identity pairs, skips non `[a-z-]` forms, and removes pairs already covered by English Snowball stemming (`stem(form) === stem(canonical)`).
4. Remaining pairs are deduplicated by `(canonical, stem(form))` to reduce runtime map noise.
5. Final deterministic map is written to `src/stemming/english-irregular-forms.ts`.

## Link displayText as aliases

Before `NotesIndex` is built, `collectNotes()` in `src/main.ts` calls `collectLinkDisplayTexts()` to scan all wikilinks in the vault and collect explicitly-set display texts (links that contain `|`, e.g. `[[Note|display]]`). These are passed to `addLinkDisplayAliases()` (`src/search/link-aliases.ts`) which appends each unique displayText to the target note's `aliases` array, skipping values that duplicate the note title or an existing alias. Auto-generated display texts (e.g. `"Note > Heading"` for `[[Note#Heading]]`) are excluded because their `original` field does not contain `|`.

## NotesIndex role

`NotesIndex` is built from `NoteInfo[]` and `Stemmer`. It encapsulates:
- tokenization and normalization;
- stem-level matching strategy;
- prefix handling for incomplete final token (`stemPrefix` and `stem` of the last token are computed once per `search()` call, not per note);
- ranking logic.

## Inline suggest session caching

`NaturalLinkSuggest` (EditorSuggest) reuses a single `LinkSuggestCore` with a pre-built `NotesIndex` for the duration of the active `[[` suggest session. The core, stemmer, and index are built once when the first `getSuggestions` call fires and released when the session ends (`onTrigger` returns null, or `selectSuggestion` runs). This avoids reconstructing the irregular-form dictionaries and note index on every keystroke.

## Recency integration

`RecentNotes.boostRecent()` is applied on top of base search results to prioritize recently selected notes.
Storage format and persistence APIs are documented in `agents/architecture-data-storage.md`.
