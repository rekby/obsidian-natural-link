import { describe, it, expect } from "vitest";
import { NotesIndex } from "../../src/search/notes-index";
import { NoteInfo, Stemmer } from "../../src/types";
import { RussianStemmer } from "../../src/stemming/russian-stemmer";
import { EnglishStemmer } from "../../src/stemming/english-stemmer";
import { MultiStemmer } from "../../src/stemming/multi-stemmer";

function makeNote(title: string, aliases: string[] = []): NoteInfo {
	return { path: `${title}.md`, title, aliases };
}

const stemmer = new MultiStemmer([new RussianStemmer(), new EnglishStemmer()]);

describe("NotesIndex", () => {
	describe("exact match", () => {
		it("finds note by exact title", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("Деревянная коробка");
			expect(results.length).toBe(1);
			expect(results[0]!.note.title).toBe("Деревянная коробка");
		});

		it("finds note by exact title case-insensitive", () => {
			const index = new NotesIndex([makeNote("Hello World")], stemmer);
			const results = index.search("hello world");
			expect(results.length).toBe(1);
			expect(results[0]!.note.title).toBe("Hello World");
		});
	});

	describe("word form matching (stemming)", () => {
		it("finds note when query uses different word forms", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("деревянную коробку");
			expect(results.length).toBe(1);
			expect(results[0]!.note.title).toBe("Деревянная коробка");
		});

		it("finds note by a single word in different form", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("коробку");
			expect(results.length).toBe(1);
		});

		it("finds English notes by word forms", () => {
			const index = new NotesIndex([makeNote("Running shoes")], stemmer);
			const results = index.search("run shoe");
			expect(results.length).toBe(1);
		});
	});

	describe("alias matching", () => {
		it("finds note by alias", () => {
			const index = new NotesIndex(
				[makeNote("Main title", ["Альтернативное название"])],
				stemmer,
			);
			const results = index.search("альтернативное название");
			expect(results.length).toBe(1);
			expect(results[0]!.note.title).toBe("Main title");
			expect(results[0]!.matchedAlias).toBe("Альтернативное название");
		});

		it("finds note by alias with different word form", () => {
			const index = new NotesIndex(
				[makeNote("Main title", ["Деревянная коробка"])],
				stemmer,
			);
			const results = index.search("деревянную коробку");
			expect(results.length).toBe(1);
			expect(results[0]!.matchedAlias).toBe("Деревянная коробка");
		});

		it("does not set matchedAlias when matched by title", () => {
			const index = new NotesIndex(
				[makeNote("Деревянная коробка", ["Alias"])],
				stemmer,
			);
			const results = index.search("деревянную коробку");
			expect(results.length).toBe(1);
			expect(results[0]!.matchedAlias).toBeUndefined();
		});
	});

	describe("prefix search (last word incomplete)", () => {
		it("finds note when last word is a prefix", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("деревянную кор");
			expect(results.length).toBe(1);
		});

		it("finds note with a single prefix", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("кор");
			expect(results.length).toBe(1);
		});

		it("finds note with English prefix", () => {
			const index = new NotesIndex([makeNote("Running shoes")], stemmer);
			const results = index.search("run sho");
			expect(results.length).toBe(1);
		});

		it("does not match when prefix does not match any word", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("металл");
			expect(results.length).toBe(0);
		});
	});

	describe("no matches", () => {
		it("returns empty array when no notes match", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("металлический стул");
			expect(results.length).toBe(0);
		});

		it("returns empty array for empty query", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("");
			expect(results.length).toBe(0);
		});

		it("returns empty array for whitespace query", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("   ");
			expect(results.length).toBe(0);
		});
	});

	describe("multiple results", () => {
		it("returns all matching notes", () => {
			const index = new NotesIndex(
				[
					makeNote("Деревянная коробка"),
					makeNote("Картонная коробка"),
					makeNote("Деревянный стул"),
				],
				stemmer,
			);
			const results = index.search("коробку");
			expect(results.length).toBe(2);
			const titles = results.map((r) => r.note.title);
			expect(titles).toContain("Деревянная коробка");
			expect(titles).toContain("Картонная коробка");
		});
	});

	describe("ranking", () => {
		it("ranks full match higher than partial match", () => {
			const index = new NotesIndex(
				[
					makeNote("Деревянная коробка"),
					makeNote("Коробка"),
				],
				stemmer,
			);
			const results = index.search("деревянную коробку");
			expect(results.length).toBe(2);
			// "Деревянная коробка" matches both words — should be first
			expect(results[0]!.note.title).toBe("Деревянная коробка");
		});

		it("ranks title match higher than alias match", () => {
			const index = new NotesIndex(
				[
					makeNote("Другое название", ["Деревянная коробка"]),
					makeNote("Деревянная коробка"),
				],
				stemmer,
			);
			const results = index.search("деревянную коробку");
			expect(results.length).toBe(2);
			// Direct title match should rank higher
			expect(results[0]!.note.title).toBe("Деревянная коробка");
		});
	});

	describe("word order independence", () => {
		it("finds note regardless of word order in query", () => {
			const index = new NotesIndex([makeNote("Деревянная коробка")], stemmer);
			const results = index.search("коробку деревянную");
			expect(results.length).toBe(1);
		});
	});
});
