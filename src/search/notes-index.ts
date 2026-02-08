import { NoteInfo, SearchResult, Stemmer } from "../types";
import { tokenize } from "./tokenizer";

/**
 * Index of notes for morphological search.
 * Built once (e.g. when the modal opens), used for every keystroke query.
 */
export class NotesIndex {
	private readonly notes: NoteInfo[];
	private readonly stemmer: Stemmer;

	constructor(notes: NoteInfo[], stemmer: Stemmer) {
		this.notes = notes;
		this.stemmer = stemmer;
	}

	/**
	 * Search for notes matching the query.
	 * - All words except the last are matched by stem equality.
	 * - The last word is matched as a prefix of stems or original tokens.
	 * - Results are ranked by relevance.
	 */
	search(query: string): SearchResult[] {
		const queryTokens = tokenize(query);
		if (queryTokens.length === 0) {
			return [];
		}

		const lastToken = queryTokens[queryTokens.length - 1]!;
		const fullTokens = queryTokens.slice(0, -1);

		// Stem the full (non-last) query tokens
		const fullQueryStems = fullTokens.map((t) => new Set(this.stemmer.stem(t)));

		const scored: Array<{ note: NoteInfo; score: number }> = [];

		for (const note of this.notes) {
			const bestScore = this.scoreNote(note, fullQueryStems, lastToken);
			if (bestScore > 0) {
				scored.push({ note, score: bestScore });
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored.map((s) => ({ note: s.note }));
	}

	/**
	 * Compute match score for a note against the query.
	 * Returns the best score across title and all aliases.
	 * Returns 0 if no match.
	 */
	private scoreNote(
		note: NoteInfo,
		fullQueryStems: Set<string>[],
		lastToken: string,
	): number {
		const sources = [
			{ text: note.title, isTitle: true },
			...note.aliases.map((a) => ({ text: a, isTitle: false })),
		];

		let bestScore = 0;
		for (const source of sources) {
			const score = this.scoreSource(
				source.text,
				fullQueryStems,
				lastToken,
				source.isTitle,
			);
			if (score > bestScore) {
				bestScore = score;
			}
		}
		return bestScore;
	}

	/**
	 * Score a single source (title or alias) against the query.
	 */
	private scoreSource(
		sourceText: string,
		fullQueryStems: Set<string>[],
		lastToken: string,
		isTitle: boolean,
	): number {
		const sourceTokens = tokenize(sourceText);
		if (sourceTokens.length === 0) {
			return 0;
		}

		const sourceStems = sourceTokens.map((t) => this.stemmer.stem(t));

		// Count how many full query stems match at least one source stem
		let fullMatches = 0;
		for (const queryStems of fullQueryStems) {
			const matched = sourceStems.some((stems) =>
				stems.some((s) => queryStems.has(s)),
			);
			if (matched) {
				fullMatches++;
			}
		}

		// Check last token as prefix against source stems and original tokens
		const lastMatches = this.matchPrefix(lastToken, sourceTokens, sourceStems);

		const totalQueryWords = fullQueryStems.length + 1;
		const matchedWords = fullMatches + (lastMatches ? 1 : 0);

		// At least one query word must match
		if (matchedWords === 0) {
			return 0;
		}

		// queryMatchRatio: fraction of query words that matched
		const queryMatchRatio = matchedWords / totalQueryWords;

		// sourceMatchRatio: how specific the match is (fewer extra source words = better)
		const sourceMatchRatio = Math.min(matchedWords, sourceTokens.length) / sourceTokens.length;

		// title bonus
		const titleBonus = isTitle ? 0.1 : 0;

		return queryMatchRatio * 0.5 + sourceMatchRatio * 0.4 + titleBonus;
	}

	/**
	 * Check if lastToken is a prefix of any source token or its stems.
	 */
	private matchPrefix(
		lastToken: string,
		sourceTokens: string[],
		sourceStems: string[][],
	): boolean {
		// Check as prefix of original tokens
		for (const token of sourceTokens) {
			if (token.startsWith(lastToken)) {
				return true;
			}
		}
		// Check as prefix of stems
		for (const stems of sourceStems) {
			for (const stem of stems) {
				if (stem.startsWith(lastToken)) {
					return true;
				}
			}
		}
		// Also check if lastToken's stem matches any source stem exactly
		// (handles the case where the last word is actually complete)
		const lastStems = this.stemmer.stem(lastToken);
		for (const stems of sourceStems) {
			for (const sourceStem of stems) {
				for (const lastStem of lastStems) {
					if (sourceStem === lastStem) {
						return true;
					}
				}
			}
		}
		return false;
	}
}
