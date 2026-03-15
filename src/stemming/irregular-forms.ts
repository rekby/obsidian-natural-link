export type BaseStemFn = (word: string) => string[];
export type CanonicalResolver = (word: string) => ReadonlySet<string>;
export type PrefixCanonicalResolver = (prefix: string) => ReadonlySet<string>;

export type IrregularLookupOptions = {
	extraCanonicalResolver?: (
		word: string,
		resolveCanonicals: CanonicalResolver,
	) => Iterable<string>;
	extraPrefixCanonicalResolver?: (
		prefix: string,
		resolveCanonicalsByPrefix: PrefixCanonicalResolver,
	) => Iterable<string>;
};

const MIN_PREFIX_LENGTH = 3;
const MAX_PREFIX_CACHE_SIZE = 1024;

/**
 * Maps irregular forms to canonical forms and provides stem-time lookups.
 * Stem-level mapping lets one dictionary entry cover inflected forms
 * that share the same stem with the irregular key.
 */

export class IrregularFormsLookup {
	private readonly stemToCanonicals: Map<string, Set<string>>;
	private readonly prefixCanonicalCache = new Map<string, ReadonlySet<string>>();
	private readonly sortedKeys: string[];
	private readonly keyToCanonical: Map<string, string>;

	constructor(
		dictionary: ReadonlyMap<string, string>,
		private readonly baseStem: BaseStemFn,
		private readonly options: IrregularLookupOptions = {},
	) {
		this.keyToCanonical = new Map(dictionary);
		this.sortedKeys = [...dictionary.keys()].sort();

		this.stemToCanonicals = new Map();
		for (const [irregular, canonical] of dictionary) {
			for (const stem of this.baseStem(irregular)) {
				const canonicals = this.stemToCanonicals.get(stem);
				if (!canonicals) {
					this.stemToCanonicals.set(stem, new Set([canonical]));
					continue;
				}
				canonicals.add(canonical);
			}
		}
	}

	stem(word: string): string[] {
		const wordStems = this.baseStem(word);
		const stems = new Set<string>(wordStems);
		for (const canonical of this.resolveCanonicals(word)) {
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
		for (const canonical of this.resolveCanonicalsByPrefix(prefix)) {
			for (const canonicalStem of this.baseStem(canonical)) {
				stems.add(canonicalStem);
			}
		}
		if (this.options.extraPrefixCanonicalResolver) {
			for (const canonical of this.options.extraPrefixCanonicalResolver(
				prefix,
				(innerPrefix) => this.resolveCanonicalsByPrefix(innerPrefix),
			)) {
				for (const canonicalStem of this.baseStem(canonical)) {
					stems.add(canonicalStem);
				}
			}
		}
		return [...stems];
	}

	private resolveCanonicals(word: string, seen = new Set<string>()): Set<string> {
		const canonicals = this.resolveCanonicalsFromDictionary(word);
		if (!this.options.extraCanonicalResolver || seen.has(word)) {
			return canonicals;
		}

		seen.add(word);
		for (const canonical of this.options.extraCanonicalResolver(
			word,
			(innerWord) => this.resolveCanonicals(innerWord, seen),
		)) {
			if (canonical !== word) {
				canonicals.add(canonical);
			}
		}
		seen.delete(word);
		return canonicals;
	}

	private resolveCanonicalsFromDictionary(word: string): Set<string> {
		const canonicals = new Set<string>();
		for (const wordStem of this.baseStem(word)) {
			const stemCanonicals = this.stemToCanonicals.get(wordStem);
			if (!stemCanonicals) {
				continue;
			}
			for (const canonical of stemCanonicals) {
				canonicals.add(canonical);
			}
		}
		return canonicals;
	}

	private resolveCanonicalsByPrefix(prefix: string): ReadonlySet<string> {
		const cached = this.prefixCanonicalCache.get(prefix);
		if (cached) return cached;

		const canonicals = new Set<string>();
		const keys = this.sortedKeys;

		let lo = 0;
		let hi = keys.length;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (keys[mid]! < prefix) lo = mid + 1;
			else hi = mid;
		}
		while (lo < keys.length && keys[lo]!.startsWith(prefix)) {
			const key = keys[lo]!;
			if (key !== prefix) {
				const canonical = this.keyToCanonical.get(key);
				if (canonical !== undefined) {
					canonicals.add(canonical);
				}
			}
			lo++;
		}

		if (this.prefixCanonicalCache.size >= MAX_PREFIX_CACHE_SIZE) {
			const first = this.prefixCanonicalCache.keys().next();
			if (!first.done) {
				this.prefixCanonicalCache.delete(first.value);
			}
		}
		this.prefixCanonicalCache.set(prefix, canonicals);
		return canonicals;
	}
}
