/**
 * Interface for language-specific stemmers.
 * Extensible for future lemmatization support.
 */
export interface Stemmer {
	/** Reduces a word to its stem(s). May return multiple variants for multi-language support. */
	stem(word: string): string[];
}

/**
 * Information about a note, obtained from Obsidian API.
 */
export interface NoteInfo {
	/** File path in the vault (e.g. "folder/My Note.md") */
	path: string;
	/** Note title (filename without extension) */
	title: string;
	/** Aliases from frontmatter */
	aliases: string[];
	/** Whether the note file exists in the vault. Defaults to true if omitted. */
	exists?: boolean;
}

/**
 * A single search result from NotesIndex.
 */
export interface SearchResult {
	note: NoteInfo;
	/** The alias that matched the query, if the best match was on an alias (not the title). */
	matchedAlias?: string;
}

/**
 * Unified suggestion item used by both the modal and inline EditorSuggest.
 * Covers note matches, heading sub-links, and block reference sub-links.
 */
export type LinkSuggestion =
	| { type: "note"; note: NoteInfo; matchedAlias?: string }
	| { type: "heading"; note: NoteInfo; heading: string; level: number }
	| {
			type: "block";
			note: NoteInfo;
			/**
			 * Existing block ID (from the file).  Undefined when the block has no
			 * `^id` yet — the ID will be generated on selection.
			 */
			blockId?: string;
			/** First line of the block text for display in the suggestion list. */
			blockText: string;
			/**
			 * When set, the block has no existing ID.  `line` is the 0-based line
			 * number where ` ^{blockId}` should be appended on selection.
			 */
			needsWrite?: { line: number };
	  };
