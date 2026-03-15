import { Stemmer } from "../types";
import { BaseStemFn, IrregularFormsLookup } from "./irregular-forms";
import { RUSSIAN_IRREGULAR_FORMS } from "./russian-irregular-forms";

export class RussianStemmer implements Stemmer {
	private readonly irregularLookup: IrregularFormsLookup;

	constructor(baseStem: BaseStemFn) {
		this.irregularLookup = new IrregularFormsLookup(
			RUSSIAN_IRREGULAR_FORMS,
			baseStem,
		);
	}

	stem(word: string): string[] {
		return this.irregularLookup.stem(word);
	}

	stemPrefix(prefix: string): string[] {
		return this.irregularLookup.stemPrefix(prefix);
	}
}
