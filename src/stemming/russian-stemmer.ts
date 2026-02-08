import { Stemmer } from "../types";
import snowballFactory from "snowball-stemmers";

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

export class RussianStemmer implements Stemmer {
	stem(word: string): string[] {
		return [snowball.stem(normalizeYo(word))];
	}
}
