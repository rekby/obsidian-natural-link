import { describe, it, expect } from "vitest";
import { parseQuery } from "../../src/ui/query-parser";

describe("parseQuery", () => {
	it("returns notePart only for a plain query", () => {
		expect(parseQuery("my note")).toEqual({ notePart: "my note" });
	});

	it("returns empty notePart for empty string", () => {
		expect(parseQuery("")).toEqual({ notePart: "" });
	});

	// ----- Pipe (|) -----

	it("splits on | into notePart and displayPart", () => {
		expect(parseQuery("note|display text")).toEqual({
			notePart: "note",
			displayPart: "display text",
		});
	});

	it("handles | at the end (empty displayPart)", () => {
		expect(parseQuery("note|")).toEqual({
			notePart: "note",
			displayPart: "",
		});
	});

	it("handles | at the start (empty notePart)", () => {
		expect(parseQuery("|display")).toEqual({
			notePart: "",
			displayPart: "display",
		});
	});

	it("uses only the first | as delimiter", () => {
		expect(parseQuery("note|display|extra")).toEqual({
			notePart: "note",
			displayPart: "display|extra",
		});
	});

	// ----- Hash (#) -----

	it("splits on # into notePart and headingPart", () => {
		expect(parseQuery("note#heading")).toEqual({
			notePart: "note",
			headingPart: "heading",
		});
	});

	it("handles # at the end (empty headingPart)", () => {
		expect(parseQuery("note#")).toEqual({
			notePart: "note",
			headingPart: "",
		});
	});

	it("handles # at the start (empty notePart)", () => {
		expect(parseQuery("#heading")).toEqual({
			notePart: "",
			headingPart: "heading",
		});
	});

	it("uses only the first # as delimiter", () => {
		expect(parseQuery("note#first#second")).toEqual({
			notePart: "note",
			headingPart: "first#second",
		});
	});

	// ----- Caret (^) -----

	it("splits on ^ into notePart and blockPart", () => {
		expect(parseQuery("note^blockid")).toEqual({
			notePart: "note",
			blockPart: "blockid",
		});
	});

	it("handles ^ at the end (empty blockPart)", () => {
		expect(parseQuery("note^")).toEqual({
			notePart: "note",
			blockPart: "",
		});
	});

	// ----- # vs ^ priority -----

	it("uses # when it appears before ^", () => {
		expect(parseQuery("note#heading^block")).toEqual({
			notePart: "note",
			headingPart: "heading^block",
		});
	});

	it("uses ^ when it appears before #", () => {
		expect(parseQuery("note^block#heading")).toEqual({
			notePart: "note",
			blockPart: "block#heading",
		});
	});

	// ----- Combined | with # or ^ -----

	it("splits | first, then # within the link target", () => {
		expect(parseQuery("note#heading|display")).toEqual({
			notePart: "note",
			headingPart: "heading",
			displayPart: "display",
		});
	});

	it("splits | first, then ^ within the link target", () => {
		expect(parseQuery("note^block|display")).toEqual({
			notePart: "note",
			blockPart: "block",
			displayPart: "display",
		});
	});

	it("ignores # and ^ in the display part (after |)", () => {
		expect(parseQuery("note|#not-a-heading")).toEqual({
			notePart: "note",
			displayPart: "#not-a-heading",
		});
	});
});
