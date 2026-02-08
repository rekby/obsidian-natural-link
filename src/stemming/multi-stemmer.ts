import { Stemmer } from "../types";

export class MultiStemmer implements Stemmer {
	private readonly stemmers: Stemmer[];

	constructor(stemmers: Stemmer[]) {
		this.stemmers = stemmers;
	}

	stem(word: string): string[] {
		const stems = new Set<string>();
		for (const stemmer of this.stemmers) {
			for (const s of stemmer.stem(word)) {
				stems.add(s);
			}
		}
		return [...stems];
	}
}
