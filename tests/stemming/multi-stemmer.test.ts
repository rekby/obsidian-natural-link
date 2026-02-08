import { describe, it, expect } from "vitest";
import { MultiStemmer } from "../../src/stemming/multi-stemmer";
import { Stemmer } from "../../src/types";

describe("MultiStemmer", () => {
	// Simple mock stemmers for testing composition logic
	const mockStemmerA: Stemmer = {
		stem: (word: string) => [word + "_a"],
	};
	const mockStemmerB: Stemmer = {
		stem: (word: string) => [word + "_b"],
	};

	it("combines stems from all registered stemmers", () => {
		const multi = new MultiStemmer([mockStemmerA, mockStemmerB]);
		const result = multi.stem("test");
		expect(result).toContain("test_a");
		expect(result).toContain("test_b");
		expect(result.length).toBe(2);
	});

	it("deduplicates identical stems", () => {
		const sameStemmer: Stemmer = {
			stem: (word: string) => [word],
		};
		const multi = new MultiStemmer([sameStemmer, sameStemmer]);
		const result = multi.stem("hello");
		expect(result).toEqual(["hello"]);
	});

	it("works with a single stemmer", () => {
		const multi = new MultiStemmer([mockStemmerA]);
		const result = multi.stem("word");
		expect(result).toEqual(["word_a"]);
	});

	it("handles stemmers that return multiple stems", () => {
		const multiResultStemmer: Stemmer = {
			stem: () => ["stem1", "stem2"],
		};
		const multi = new MultiStemmer([multiResultStemmer, mockStemmerA]);
		const result = multi.stem("word");
		expect(result).toContain("stem1");
		expect(result).toContain("stem2");
		expect(result).toContain("word_a");
	});

	it("returns empty array when no stemmers provided", () => {
		const multi = new MultiStemmer([]);
		const result = multi.stem("word");
		expect(result).toEqual([]);
	});
});
