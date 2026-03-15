import { Stemmer } from "../types";
import snowballFactory from "snowball-stemmers";
import { IrregularFormsLookup } from "./irregular-forms";
import { RUSSIAN_IRREGULAR_FORMS } from "./russian-irregular-forms";

const snowball = snowballFactory.newStemmer("russian");

/**
 * Normalize ё → е (and Ё → Е).
 * The Snowball Russian stemmer does not recognize ё, so words like
 * "костылём" are left unstemmed. Replacing ё with е before stemming
 * fixes this and is standard practice for Russian text processing.
 */
function normalizeYo(word: string): string {
	return word.replace(/ё/g, "е").replace(/Ё/g, "Е");
}

type AlternationRule = {
	endings: string[];
	canonical: string;
};

const CONSONANT_ALTERNATION_RULES: AlternationRule[] = [
	// Multi-letter endings first.
	{ endings: ["бл", "б"], canonical: "б" },
	{ endings: ["пл", "п"], canonical: "п" },
	{ endings: ["вл", "в"], canonical: "в" },
	{ endings: ["мл", "м"], canonical: "м" },
	{ endings: ["фл", "ф"], canonical: "ф" },
	{ endings: ["ст", "ск", "щ"], canonical: "щ" },

	// Group 1 + group 2 (single-letter).
	{ endings: ["г", "д", "з", "ж"], canonical: "ж" },
	{ endings: ["к", "т", "ц", "ч"], canonical: "ч" },
	{ endings: ["х", "с", "ш"], canonical: "ш" },
];

function normalizeConsonantAlternations(stem: string): string {
	for (const rule of CONSONANT_ALTERNATION_RULES) {
		for (const ending of rule.endings) {
			if (!stem.endsWith(ending)) {
				continue;
			}
			return stem.slice(0, stem.length - ending.length) + rule.canonical;
		}
	}
	return stem;
}

function baseStem(word: string): string[] {
	const snowballStem = snowball.stem(normalizeYo(word));
	return [normalizeConsonantAlternations(snowballStem)];
}

export class RussianStemmer implements Stemmer {
	private readonly irregularLookup = new IrregularFormsLookup(
		RUSSIAN_IRREGULAR_FORMS,
		baseStem,
	);

	stem(word: string): string[] {
		return this.irregularLookup.stem(word);
	}

	stemPrefix(prefix: string): string[] {
		return this.irregularLookup.stemPrefix(prefix);
	}
}
