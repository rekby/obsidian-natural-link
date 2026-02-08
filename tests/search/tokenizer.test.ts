import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/search/tokenizer";

describe("tokenize", () => {
	it("splits text into lowercase words", () => {
		expect(tokenize("Hello World")).toEqual(["hello", "world"]);
	});

	it("handles Russian text", () => {
		expect(tokenize("Деревянная коробка")).toEqual(["деревянная", "коробка"]);
	});

	it("removes punctuation", () => {
		expect(tokenize("hello, world! How are you?")).toEqual([
			"hello",
			"world",
			"how",
			"are",
			"you",
		]);
	});

	it("handles multiple spaces and tabs", () => {
		expect(tokenize("  hello   world  ")).toEqual(["hello", "world"]);
	});

	it("returns empty array for empty string", () => {
		expect(tokenize("")).toEqual([]);
	});

	it("returns empty array for whitespace-only string", () => {
		expect(tokenize("   ")).toEqual([]);
	});

	it("handles mixed language text", () => {
		expect(tokenize("Hello мир")).toEqual(["hello", "мир"]);
	});

	it("handles hyphens as word separators", () => {
		expect(tokenize("dark-blue box")).toEqual(["dark", "blue", "box"]);
	});

	it("handles numbers within words", () => {
		expect(tokenize("test123 note")).toEqual(["test123", "note"]);
	});

	it("handles apostrophes", () => {
		const result = tokenize("it's a note");
		expect(result).toContain("a");
		expect(result).toContain("note");
	});
});
