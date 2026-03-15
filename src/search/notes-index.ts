import { NoteInfo, SearchResult, Stemmer } from "../types";
import { tokenize } from "./tokenizer";

interface IndexedSource {
	text: string;
	isTitle: boolean;
	tokens: string[];
	stems: string[][];
}

interface IndexedNote {
	note: NoteInfo;
	sources: IndexedSource[];
}

const MIN_REVERSE_PREFIX_LEN = 3;

/**
 * Index of notes for morphological search.
 * Built once (e.g. when the modal opens), used for every keystroke query.
 * Tokens and stems are pre-computed at construction time so that
 * search() only performs lightweight matching without any stemmer calls.
 * An inverted index narrows candidates before scoring so that only
 * potentially-matching notes are evaluated.
 */
export class NotesIndex {
	private readonly indexedNotes: IndexedNote[];
	private readonly stemmer: Stemmer;
	private readonly stemToNoteIndices = new Map<string, number[]>();
	private readonly tokenToNoteIndices = new Map<string, number[]>();
	private readonly sortedStems: string[];
	private readonly sortedTokens: string[];

	constructor(notes: NoteInfo[], stemmer: Stemmer) {
		this.stemmer = stemmer;
		this.indexedNotes = notes.map((note) => this.buildIndexedNote(note));
		this.buildInvertedIndex();
		this.sortedStems = [...this.stemToNoteIndices.keys()].sort();
		this.sortedTokens = [...this.tokenToNoteIndices.keys()].sort();
	}

	private buildIndexedNote(note: NoteInfo): IndexedNote {
		const sources: IndexedSource[] = [];
		sources.push(this.buildIndexedSource(note.title, true));
		for (const alias of note.aliases) {
			sources.push(this.buildIndexedSource(alias, false));
		}
		return { note, sources };
	}

	private buildIndexedSource(text: string, isTitle: boolean): IndexedSource {
		const tokens = tokenize(text);
		const stems = tokens.map((t) => this.stemmer.stem(t));
		return { text, isTitle, tokens, stems };
	}

	private buildInvertedIndex(): void {
		for (let i = 0; i < this.indexedNotes.length; i++) {
			const indexed = this.indexedNotes[i]!;
			for (const source of indexed.sources) {
				for (const token of source.tokens) {
					appendUnique(this.tokenToNoteIndices, token, i);
				}
				for (const tokenStems of source.stems) {
					for (const s of tokenStems) {
						appendUnique(this.stemToNoteIndices, s, i);
					}
				}
			}
		}
	}

	/**
	 * Search for notes matching the query.
	 * Uses the inverted index to find candidate notes, then scores only those.
	 */
	search(query: string): SearchResult[] {
		const queryTokens = tokenize(query);
		if (queryTokens.length === 0) {
			return [];
		}

		const lastToken = queryTokens[queryTokens.length - 1]!;
		const fullTokens = queryTokens.slice(0, -1);

		const fullQueryStems = fullTokens.map((t) => new Set(this.stemmer.stem(t)));

		const lastStems = this.stemmer.stem(lastToken);
		const prefixStems = this.stemmer.stemPrefix
			? new Set(this.stemmer.stemPrefix(lastToken))
			: undefined;

		const candidates = this.findCandidates(fullQueryStems, lastToken, lastStems, prefixStems);

		const scored: Array<{ note: NoteInfo; score: number; matchedAlias?: string }> = [];

		for (const idx of candidates) {
			const indexed = this.indexedNotes[idx]!;
			const { score, matchedAlias } = this.scoreNote(indexed, fullQueryStems, lastToken, lastStems, prefixStems);
			if (score > 0) {
				scored.push({ note: indexed.note, score, matchedAlias });
			}
		}

		scored.sort((a, b) => b.score - a.score);
		return scored.map((s) => ({ note: s.note, matchedAlias: s.matchedAlias }));
	}

	private findCandidates(
		fullQueryStems: Set<string>[],
		lastToken: string,
		lastStems: string[],
		prefixStems: Set<string> | undefined,
	): Set<number> {
		const candidates = new Set<number>();

		for (const queryStems of fullQueryStems) {
			for (const stem of queryStems) {
				addAll(candidates, this.stemToNoteIndices.get(stem));
			}
		}

		collectByPrefix(this.sortedTokens, this.tokenToNoteIndices, lastToken, candidates);
		collectByPrefix(this.sortedStems, this.stemToNoteIndices, lastToken, candidates);

		for (const stem of lastStems) {
			addAll(candidates, this.stemToNoteIndices.get(stem));
		}

		for (let len = MIN_REVERSE_PREFIX_LEN; len < lastToken.length; len++) {
			const sub = lastToken.slice(0, len);
			addAll(candidates, this.tokenToNoteIndices.get(sub));
			addAll(candidates, this.stemToNoteIndices.get(sub));
		}

		if (prefixStems) {
			for (const stem of prefixStems) {
				addAll(candidates, this.stemToNoteIndices.get(stem));
			}
		}

		return candidates;
	}

	private scoreNote(
		indexed: IndexedNote,
		fullQueryStems: Set<string>[],
		lastToken: string,
		lastStems: string[],
		prefixStems: Set<string> | undefined,
	): { score: number; matchedAlias?: string } {
		let bestScore = 0;
		let bestAlias: string | undefined;
		for (const source of indexed.sources) {
			const score = this.scoreSource(source, fullQueryStems, lastToken, lastStems, prefixStems);
			if (score > bestScore) {
				bestScore = score;
				bestAlias = source.isTitle ? undefined : source.text;
			}
		}
		return { score: bestScore, matchedAlias: bestAlias };
	}

	private scoreSource(
		source: IndexedSource,
		fullQueryStems: Set<string>[],
		lastToken: string,
		lastStems: string[],
		prefixStems: Set<string> | undefined,
	): number {
		if (source.tokens.length === 0) {
			return 0;
		}

		let fullMatches = 0;
		for (const queryStems of fullQueryStems) {
			const matched = source.stems.some((stems) =>
				stems.some((s) => queryStems.has(s)),
			);
			if (matched) {
				fullMatches++;
			}
		}

		const lastMatches = matchPrefix(lastToken, lastStems, prefixStems, source.tokens, source.stems);

		const totalQueryWords = fullQueryStems.length + 1;
		const matchedWords = fullMatches + (lastMatches ? 1 : 0);

		if (matchedWords === 0) {
			return 0;
		}

		const queryMatchRatio = matchedWords / totalQueryWords;
		const sourceMatchRatio = Math.min(matchedWords, source.tokens.length) / source.tokens.length;
		const titleBonus = source.isTitle ? 0.1 : 0;

		return queryMatchRatio * 0.5 + sourceMatchRatio * 0.4 + titleBonus;
	}
}

function matchPrefix(
	lastToken: string,
	lastStems: string[],
	prefixStems: Set<string> | undefined,
	sourceTokens: string[],
	sourceStems: string[][],
): boolean {
	for (const token of sourceTokens) {
		if (token.startsWith(lastToken)) {
			return true;
		}
	}
	for (const stems of sourceStems) {
		for (const stem of stems) {
			if (stem.startsWith(lastToken)) {
				return true;
			}
		}
	}
	for (const stems of sourceStems) {
		for (const sourceStem of stems) {
			for (const lastStem of lastStems) {
				if (sourceStem === lastStem) {
					return true;
				}
			}
		}
	}
	for (const token of sourceTokens) {
		if (token.length >= MIN_REVERSE_PREFIX_LEN && lastToken.startsWith(token)) {
			return true;
		}
	}
	for (const stems of sourceStems) {
		for (const stem of stems) {
			if (stem.length >= MIN_REVERSE_PREFIX_LEN && lastToken.startsWith(stem)) {
				return true;
			}
		}
	}

	if (prefixStems) {
		for (const stems of sourceStems) {
			for (const sourceStem of stems) {
				if (prefixStems.has(sourceStem)) {
					return true;
				}
			}
		}
	}

	return false;
}

function appendUnique(map: Map<string, number[]>, key: string, value: number): void {
	let list = map.get(key);
	if (!list) {
		list = [];
		map.set(key, list);
	}
	if (list.length === 0 || list[list.length - 1] !== value) {
		list.push(value);
	}
}

function addAll(target: Set<number>, source: number[] | undefined): void {
	if (!source) return;
	for (const v of source) {
		target.add(v);
	}
}

/**
 * Binary-search `sortedKeys` for entries starting with `prefix`,
 * then add their posting-list entries to `candidates`.
 */
function collectByPrefix(
	sortedKeys: string[],
	index: Map<string, number[]>,
	prefix: string,
	candidates: Set<number>,
): void {
	let lo = 0;
	let hi = sortedKeys.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (sortedKeys[mid]! < prefix) lo = mid + 1;
		else hi = mid;
	}
	while (lo < sortedKeys.length && sortedKeys[lo]!.startsWith(prefix)) {
		addAll(candidates, index.get(sortedKeys[lo]!));
		lo++;
	}
}
