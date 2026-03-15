import { Stemmer } from "../types";
import snowballFactory from "snowball-stemmers";
import { ENGLISH_IRREGULAR_FORMS } from "./english-irregular-forms";
import { IrregularFormsLookup } from "./irregular-forms";

const snowball = snowballFactory.newStemmer("english");

export class EnglishStemmer implements Stemmer {
	private readonly irregularLookup = new IrregularFormsLookup(
		ENGLISH_IRREGULAR_FORMS,
		(word) => [snowball.stem(word)],
	);

	stem(word: string): string[] {
		return this.irregularLookup.stem(word);
	}

	stemPrefix(prefix: string): string[] {
		return this.irregularLookup.stemPrefix(prefix);
	}
}
