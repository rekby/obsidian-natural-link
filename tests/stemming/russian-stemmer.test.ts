import { describe, it, expect } from "vitest";
import { RussianStemmer } from "../../src/stemming/russian-stemmer";

describe("RussianStemmer", () => {
	const stemmer = new RussianStemmer();

	it("stems Russian nouns to the same base across cases", () => {
		const stems = [
			stemmer.stem("коробка"),
			stemmer.stem("коробки"),
			stemmer.stem("коробке"),
			stemmer.stem("коробку"),
			stemmer.stem("коробкой"),
		];
		// All case forms should produce the same single stem
		const unique = new Set(stems.map((s) => s[0]));
		expect(unique.size).toBe(1);
	});

	it("stems Russian adjectives to the same base across forms", () => {
		const stems = [
			stemmer.stem("деревянная"),
			stemmer.stem("деревянной"),
			stemmer.stem("деревянную"),
			stemmer.stem("деревянным"),
		];
		const unique = new Set(stems.map((s) => s[0]));
		expect(unique.size).toBe(1);
	});

	it("normalizes group 1 consonant alternations to one stem", () => {
		// г ↔ ж
		expect(stemmer.stem("друг")[0]).toBe(stemmer.stem("дружить")[0]);
		// к ↔ ч
		expect(stemmer.stem("крик")[0]).toBe(stemmer.stem("кричу")[0]);
		// х ↔ ш
		expect(stemmer.stem("сухой")[0]).toBe(stemmer.stem("сушить")[0]);
		// ст ↔ щ
		expect(stemmer.stem("простить")[0]).toBe(stemmer.stem("прощу")[0]);
		// б ↔ бл
		expect(stemmer.stem("любить")[0]).toBe(stemmer.stem("люблю")[0]);
	});

	it("normalizes group 2 consonant alternations to one stem", () => {
		// д ↔ ж
		expect(stemmer.stem("ходить")[0]).toBe(stemmer.stem("хожу")[0]);
		// з ↔ ж
		expect(stemmer.stem("возить")[0]).toBe(stemmer.stem("вожу")[0]);
		// т ↔ ч
		expect(stemmer.stem("платить")[0]).toBe(stemmer.stem("плачу")[0]);
		// с ↔ ш
		expect(stemmer.stem("носить")[0]).toBe(stemmer.stem("ношу")[0]);
	});

	it("returns an array with a single stem", () => {
		const result = stemmer.stem("коробка");
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
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
		expect(result.length).toBe(1);
		expect(typeof result[0]).toBe("string");
	});

	it("normalizes ё to е so that ё-forms match е-forms", () => {
		// костылём (with ё) must produce the same stem as костылем (with е)
		expect(stemmer.stem("костылём")[0]).toBe(stemmer.stem("костылем")[0]);
		// and the same stem as the base form
		expect(stemmer.stem("костылём")[0]).toBe(stemmer.stem("костыль")[0]);
	});

	it("stems ё-words consistently across noun cases", () => {
		const stems = [
			stemmer.stem("ёлка"),
			stemmer.stem("елка"),
			stemmer.stem("ёлки"),
			stemmer.stem("елки"),
			stemmer.stem("ёлке"),
			stemmer.stem("ёлкой"),
		];
		const unique = new Set(stems.map((s) => s[0]));
		expect(unique.size).toBe(1);
	});
});
