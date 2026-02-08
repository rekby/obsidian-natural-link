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
}

/**
 * A single search result from NotesIndex.
 */
export interface SearchResult {
	note: NoteInfo;
	/** The alias that matched the query, if the best match was on an alias (not the title). */
	matchedAlias?: string;
}
