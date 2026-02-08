import { describe, it, expect } from "vitest";
import { EnglishStemmer } from "../../src/stemming/english-stemmer";

describe("EnglishStemmer", () => {
	const stemmer = new EnglishStemmer();

	it("stems English word forms to the same base", () => {
		const stems = [
			stemmer.stem("running"),
			stemmer.stem("runs"),
			stemmer.stem("run"),
		];
		const unique = new Set(stems.map((s) => s[0]));
		expect(unique.size).toBe(1);
	});

	it("stems plural and singular to the same base", () => {
		const stem1 = stemmer.stem("boxes")[0];
		const stem2 = stemmer.stem("box")[0];
		expect(stem1).toBe(stem2);
	});

	it("returns an array with a single stem", () => {
		const result = stemmer.stem("connection");
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1);
		expect(typeof result[0]).toBe("string");
		expect(result[0]!.length).toBeGreaterThan(0);
	});

	it("produces different stems for different words", () => {
		const stem1 = stemmer.stem("house")[0];
		const stem2 = stemmer.stem("tree")[0];
		expect(stem1).not.toBe(stem2);
	});

	it("handles single-character words", () => {
		const result = stemmer.stem("a");
		expect(result.length).toBe(1);
		expect(typeof result[0]).toBe("string");
	});
});
