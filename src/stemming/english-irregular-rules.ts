const ENGLISH_ALPHA_WORD_RE = /^[a-z]+$/;

export const ENGLISH_COMPOSABLE_PREFIXES = [
	"counter",
	"under",
	"inter",
	"super",
	"cross",
	"fore",
	"over",
	"back",
	"with",
	"out",
	"mis",
	"sub",
	"for",
	"un",
	"up",
	"re",
	"be",
] as const;

function isEnglishAlphaWord(word: string): boolean {
	return ENGLISH_ALPHA_WORD_RE.test(word);
}

function normalizeEnglishWord(word: string): string {
	return word.trim().toLowerCase();
}

export function collectEnglishPostRuleCanonicals(word: string): string[] {
	const normalized = normalizeEnglishWord(word);
	if (!isEnglishAlphaWord(normalized)) {
		return [];
	}

	const canonicals = new Set<string>();

	if (normalized.length > 4 && normalized.endsWith("ier")) {
		canonicals.add(`${normalized.slice(0, -3)}y`);
	}
	if (normalized.length > 5 && normalized.endsWith("iest")) {
		canonicals.add(`${normalized.slice(0, -4)}y`);
	}
	if (normalized.length > 4 && normalized.endsWith("men")) {
		canonicals.add(`${normalized.slice(0, -3)}man`);
	}
	if (normalized.length > 4 && normalized.endsWith("ves")) {
		canonicals.add(`${normalized.slice(0, -3)}f`);
		canonicals.add(`${normalized.slice(0, -3)}fe`);
	}
	if (normalized.length > 4 && normalized.endsWith("ices")) {
		canonicals.add(`${normalized.slice(0, -4)}ex`);
		canonicals.add(`${normalized.slice(0, -4)}ix`);
	}
	if (normalized.length > 4 && normalized.endsWith("ses")) {
		canonicals.add(`${normalized.slice(0, -2)}is`);
	}
	if (normalized.length > 3 && normalized.endsWith("ae")) {
		canonicals.add(`${normalized.slice(0, -1)}`);
	}
	if (normalized.length > 4 && normalized.endsWith("i")) {
		canonicals.add(`${normalized.slice(0, -1)}us`);
	}
	if (normalized.length > 4 && normalized.endsWith("a")) {
		canonicals.add(`${normalized.slice(0, -1)}um`);
		canonicals.add(`${normalized.slice(0, -1)}on`);
	}

	canonicals.delete(normalized);
	return [...canonicals];
}

export function isCoveredByEnglishPostRules(form: string, canonical: string): boolean {
	const normalizedCanonical = normalizeEnglishWord(canonical);
	return collectEnglishPostRuleCanonicals(form).includes(normalizedCanonical);
}

export function collectEnglishPrefixedCompositionCanonicals(
	word: string,
	resolveCanonicals: (word: string) => Iterable<string>,
): string[] {
	const normalized = normalizeEnglishWord(word);
	if (!isEnglishAlphaWord(normalized)) {
		return [];
	}

	const canonicals = new Set<string>();
	for (const prefix of ENGLISH_COMPOSABLE_PREFIXES) {
		if (!normalized.startsWith(prefix)) {
			continue;
		}
		const remainder = normalized.slice(prefix.length);
		if (remainder.length < 2) {
			continue;
		}
		for (const remainderCanonical of resolveCanonicals(remainder)) {
			if (!isEnglishAlphaWord(remainderCanonical)) {
				continue;
			}
			const composed = `${prefix}${remainderCanonical}`;
			if (composed !== normalized) {
				canonicals.add(composed);
			}
		}
	}

	return [...canonicals];
}

export function collectEnglishPrefixedCompositionPrefixCanonicals(
	prefix: string,
	resolveCanonicalsByPrefix: (prefix: string) => Iterable<string>,
): string[] {
	const normalized = normalizeEnglishWord(prefix);
	if (!isEnglishAlphaWord(normalized)) {
		return [];
	}

	const canonicals = new Set<string>();
	for (const composablePrefix of ENGLISH_COMPOSABLE_PREFIXES) {
		if (!normalized.startsWith(composablePrefix)) {
			continue;
		}
		const remainderPrefix = normalized.slice(composablePrefix.length);
		if (remainderPrefix.length < 3) {
			continue;
		}
		for (const remainderCanonical of resolveCanonicalsByPrefix(remainderPrefix)) {
			if (!isEnglishAlphaWord(remainderCanonical)) {
				continue;
			}
			canonicals.add(`${composablePrefix}${remainderCanonical}`);
		}
	}

	return [...canonicals];
}

export function isCoveredByEnglishPrefixedComposition(
	form: string,
	canonical: string,
	hasPair: (form: string, canonical: string) => boolean,
): boolean {
	const normalizedForm = normalizeEnglishWord(form);
	const normalizedCanonical = normalizeEnglishWord(canonical);
	if (!isEnglishAlphaWord(normalizedForm) || !isEnglishAlphaWord(normalizedCanonical)) {
		return false;
	}

	for (const prefix of ENGLISH_COMPOSABLE_PREFIXES) {
		if (!normalizedForm.startsWith(prefix) || !normalizedCanonical.startsWith(prefix)) {
			continue;
		}
		const remainderForm = normalizedForm.slice(prefix.length);
		const remainderCanonical = normalizedCanonical.slice(prefix.length);
		if (remainderForm.length < 2 || remainderCanonical.length < 2) {
			continue;
		}
		if (
			hasPair(remainderForm, remainderCanonical) ||
			isCoveredByEnglishPostRules(remainderForm, remainderCanonical)
		) {
			return true;
		}
	}

	return false;
}
