import { RUSSIAN_SUFFIX_RULES } from "./russian-suffix-rules";
import { normalizeYo, normalizeConsonantAlternations } from "./russian-base-stem";

export function russianSuffixStem(word: string): string[] {
	const normalized = normalizeYo(word.toLowerCase());
	const stems = new Set<string>();

	for (const rule of RUSSIAN_SUFFIX_RULES) {
		if (!normalized.endsWith(rule.suffix)) continue;
		const stem = rule.suffix.length > 0
			? normalized.slice(0, -rule.suffix.length)
			: normalized;
		if (stem.length < rule.minStem) continue;
		stems.add(normalizeConsonantAlternations(stem));
	}

	stems.add(normalizeConsonantAlternations(normalized));

	if (normalized.startsWith("по") && normalized.length > 5) {
		for (const altStem of russianSuffixStem(normalized.slice(2))) {
			stems.add(altStem);
		}
	}

	return [...stems];
}
