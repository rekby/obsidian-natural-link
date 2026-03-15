import { describe, it, expect } from "vitest";
import { RussianStemmer } from "../../src/stemming/russian-stemmer";
import { russianSnowballStem } from "../../src/stemming/russian-base-stem";
import { russianSuffixStem } from "../../src/stemming/russian-suffix-stem";
import { BaseStemFn } from "../../src/stemming/irregular-forms";

function shareStem(stemmer: RussianStemmer, a: string, b: string): boolean {
	const setA = new Set(stemmer.stem(a));
	return stemmer.stem(b).some((s) => setA.has(s));
}

function combinedBaseStem(word: string): string[] {
	return [...new Set([...russianSuffixStem(word), ...russianSnowballStem(word)])];
}

describe.each<{ label: string; baseStem: BaseStemFn }>([
	{ label: "snowball", baseStem: russianSnowballStem },
	{ label: "suffix", baseStem: russianSuffixStem },
	{ label: "both", baseStem: combinedBaseStem },
])("RussianStemmer ($label)", ({ baseStem }) => {
	const stemmer = new RussianStemmer(baseStem);

	it("stems Russian nouns to the same base across cases", () => {
		const stems = [
			stemmer.stem("коробка"),
			stemmer.stem("коробки"),
			stemmer.stem("коробке"),
			stemmer.stem("коробку"),
			stemmer.stem("коробкой"),
		];
		const unique = new Set(stems.map((s) => s[0]));
		expect(unique.size).toBe(1);
	});

	it("stems Russian adjectives to the same base across forms", () => {
		expect(shareStem(stemmer, "деревянная", "деревянной")).toBe(true);
		expect(shareStem(stemmer, "деревянная", "деревянную")).toBe(true);
		expect(shareStem(stemmer, "деревянная", "деревянным")).toBe(true);
	});

	it("returns a non-empty unique stem array", () => {
		const result = stemmer.stem("коробка");
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBeGreaterThan(0);
		expect(new Set(result).size).toBe(result.length);
		expect(typeof result[0]).toBe("string");
		expect(result[0]!.length).toBeGreaterThan(0);
	});

	it("produces different stems for different words", () => {
		const stem1 = stemmer.stem("коробка")[0];
		const stem2 = stemmer.stem("дерево")[0];
		expect(stem1).not.toBe(stem2);
	});

	it("handles single-character words", () => {
		const result = stemmer.stem("я");
		expect(result.length).toBeGreaterThan(0);
		expect(typeof result[0]).toBe("string");
	});

	it("normalizes ё to е so that ё-forms match е-forms", () => {
		expect(shareStem(stemmer, "костылём", "костылем")).toBe(true);
		expect(shareStem(stemmer, "костылём", "костыль")).toBe(true);
	});

	it("stems ё-words consistently across noun cases", () => {
		expect(shareStem(stemmer, "ёлка", "елка")).toBe(true);
		expect(shareStem(stemmer, "ёлки", "елки")).toBe(true);
		expect(shareStem(stemmer, "ёлке", "ёлкой")).toBe(true);
	});

	it("connects suppletive form 'людей' to canonical 'человек'", () => {
		expect(shareStem(stemmer, "людей", "человек")).toBe(true);
	});

	it("connects another case form 'людям' to canonical 'человек'", () => {
		expect(shareStem(stemmer, "людям", "человек")).toBe(true);
	});

	it("returns canonical stems for russian irregular prefixes", () => {
		const prefixStems = new Set(stemmer.stemPrefix("люд"));
		const canonical = stemmer.stem("человек");
		expect(canonical.some((s) => prefixStems.has(s))).toBe(true);
	});
});

describe.each<{ label: string; baseStem: BaseStemFn }>([
	{ label: "snowball", baseStem: russianSnowballStem },
	{ label: "both", baseStem: combinedBaseStem },
])("RussianStemmer ($label) consonant alternations", ({ baseStem }) => {
	const stemmer = new RussianStemmer(baseStem);

	it("normalizes group 1 consonant alternations to one stem", () => {
		expect(shareStem(stemmer, "друг", "дружить")).toBe(true);
		expect(shareStem(stemmer, "крик", "кричу")).toBe(true);
		expect(shareStem(stemmer, "сухой", "сушить")).toBe(true);
		expect(shareStem(stemmer, "простить", "прощу")).toBe(true);
		expect(shareStem(stemmer, "любить", "люблю")).toBe(true);
	});

	it("normalizes group 2 consonant alternations to one stem", () => {
		expect(shareStem(stemmer, "ходить", "хожу")).toBe(true);
		expect(shareStem(stemmer, "возить", "вожу")).toBe(true);
		expect(shareStem(stemmer, "платить", "плачу")).toBe(true);
		expect(shareStem(stemmer, "носить", "ношу")).toBe(true);
	});
});

describe("RussianStemmer (suffix) covers morphological patterns", () => {
	const stemmer = new RussianStemmer(russianSuffixStem);

	it("-ну- verbs: ахнул / ахнет share a stem", () => {
		expect(shareStem(stemmer, "ахнул", "ахнет")).toBe(true);
	});

	it("short adj: довольна / доволен share a stem", () => {
		expect(shareStem(stemmer, "довольна", "доволен")).toBe(true);
	});

	it("reflexive: бракуюсь / браковался share a stem", () => {
		expect(shareStem(stemmer, "бракуюсь", "браковался")).toBe(true);
	});

	it("по- comparative: поабажурнее / абажурнее share a stem", () => {
		expect(shareStem(stemmer, "поабажурнее", "абажурнее")).toBe(true);
	});
});
