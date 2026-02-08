import { Stemmer } from "../types";
import snowballFactory from "snowball-stemmers";

const snowball = snowballFactory.newStemmer("english");

export class EnglishStemmer implements Stemmer {
	stem(word: string): string[] {
		return [snowball.stem(word)];
	}
}
