import { Stemmer } from "../types";

export class MultiStemmer implements Stemmer {
	private readonly stemmers: Stemmer[];
	private readonly stemCache = new Map<string, string[]>();
	private readonly stemPrefixCache = new Map<string, string[]>();

	constructor(stemmers: Stemmer[]) {
		this.stemmers = stemmers;
	}

	stem(word: string): string[] {
		const cached = this.stemCache.get(word);
		if (cached) return cached;

		const stems = new Set<string>();
		for (const stemmer of this.stemmers) {
			for (const s of stemmer.stem(word)) {
				stems.add(s);
			}
		}
		const result = [...stems];
		this.stemCache.set(word, result);
		return result;
	}

	stemPrefix(prefix: string): string[] {
		const cached = this.stemPrefixCache.get(prefix);
		if (cached) return cached;

		const stems = new Set<string>();
		for (const stemmer of this.stemmers) {
			if (!stemmer.stemPrefix) {
				continue;
			}
			for (const s of stemmer.stemPrefix(prefix)) {
				stems.add(s);
			}
		}
		const result = [...stems];
		this.stemPrefixCache.set(prefix, result);
		return result;
	}
}
