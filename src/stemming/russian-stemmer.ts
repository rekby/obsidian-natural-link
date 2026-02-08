import { Stemmer } from "../types";
import snowballFactory from "snowball-stemmers";

const snowball = snowballFactory.newStemmer("russian");

export class RussianStemmer implements Stemmer {
	stem(word: string): string[] {
		return [snowball.stem(word)];
	}
}
