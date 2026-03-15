export type BaseStemFn = (word: string) => string[];

const MIN_PREFIX_LENGTH = 3;

/**
 * Maps irregular forms to canonical forms and provides stem-time lookups.
 * Stem-level mapping lets one dictionary entry cover inflected forms
 * that share the same stem with the irregular key.
 */
export class IrregularFormsLookup {
	private readonly stemToCanonical: Map<string, string>;

	constructor(
		private readonly dictionary: ReadonlyMap<string, string>,
		private readonly baseStem: BaseStemFn,
	) {
		this.stemToCanonical = new Map();
		for (const [irregular, canonical] of this.dictionary) {
			for (const stem of this.baseStem(irregular)) {
				this.stemToCanonical.set(stem, canonical);
			}
		}
	}

	stem(word: string): string[] {
		const wordStems = this.baseStem(word);
		const stems = new Set<string>(wordStems);
		for (const wordStem of wordStems) {
			const canonical = this.stemToCanonical.get(wordStem);
			if (!canonical) {
				continue;
			}
			for (const canonicalStem of this.baseStem(canonical)) {
				stems.add(canonicalStem);
			}
		}
		return [...stems];
	}

	stemPrefix(prefix: string): string[] {
		if (prefix.length < MIN_PREFIX_LENGTH) {
			return [];
		}
		const stems = new Set<string>();
		for (const [irregular, canonical] of this.dictionary) {
			if (!irregular.startsWith(prefix) || irregular === prefix) {
				continue;
			}
			for (const canonicalStem of this.baseStem(canonical)) {
				stems.add(canonicalStem);
			}
		}
		return [...stems];
	}
}
