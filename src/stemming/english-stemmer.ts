import { Stemmer } from "../types";
import snowballFactory from "snowball-stemmers";
import { ENGLISH_IRREGULAR_FORMS } from "./english-irregular-forms";
import {
	collectEnglishPostRuleCanonicals,
	collectEnglishPrefixedCompositionCanonicals,
	collectEnglishPrefixedCompositionPrefixCanonicals,
} from "./english-irregular-rules";
import { IrregularFormsLookup } from "./irregular-forms";

const snowball = snowballFactory.newStemmer("english");

export class EnglishStemmer implements Stemmer {
	private readonly irregularLookup = new IrregularFormsLookup(
		ENGLISH_IRREGULAR_FORMS,
		(word) => [snowball.stem(word)],
		{
			extraCanonicalResolver: (word, resolveCanonicals) => {
				const canonicals = new Set<string>(collectEnglishPostRuleCanonicals(word));
				for (const canonical of collectEnglishPrefixedCompositionCanonicals(
					word,
					(innerWord) => resolveCanonicals(innerWord),
				)) {
					canonicals.add(canonical);
				}
				return canonicals;
			},
			extraPrefixCanonicalResolver: (prefix, resolveCanonicalsByPrefix) =>
				collectEnglishPrefixedCompositionPrefixCanonicals(
					prefix,
					(innerPrefix) => resolveCanonicalsByPrefix(innerPrefix),
				),
		},
	);

	stem(word: string): string[] {
		return this.irregularLookup.stem(word);
	}

	stemPrefix(prefix: string): string[] {
		return this.irregularLookup.stemPrefix(prefix);
	}
}
