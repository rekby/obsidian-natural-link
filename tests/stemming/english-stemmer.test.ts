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

	it("connects irregular plural to canonical singular", () => {
		const miceStems = new Set(stemmer.stem("mice"));
		const mouseStems = stemmer.stem("mouse");
		expect(mouseStems.some((s) => miceStems.has(s))).toBe(true);
	});

	it("connects irregular noun forms from WordNet", () => {
		const childrenStems = new Set(stemmer.stem("children"));
		const childStems = stemmer.stem("child");
		expect(childStems.some((s) => childrenStems.has(s))).toBe(true);
	});

	it("connects irregular verb forms from WordNet", () => {
		const wentStems = new Set(stemmer.stem("went"));
		const goStems = stemmer.stem("go");
		expect(goStems.some((s) => wentStems.has(s))).toBe(true);
	});

	it("connects irregular adjective forms from WordNet", () => {
		const betterStems = new Set(stemmer.stem("better"));
		const goodStems = stemmer.stem("good");
		const wellStems = stemmer.stem("well");
		const overlapsGood = goodStems.some((s) => betterStems.has(s));
		const overlapsWell = wellStems.some((s) => betterStems.has(s));
		expect(overlapsGood || overlapsWell).toBe(true);
	});

	it("connects productive -ier/-iest forms through post rules", () => {
		const happierStems = new Set(stemmer.stem("happier"));
		const happiestStems = new Set(stemmer.stem("happiest"));
		const happyStems = stemmer.stem("happy");
		expect(happyStems.some((s) => happierStems.has(s))).toBe(true);
		expect(happyStems.some((s) => happiestStems.has(s))).toBe(true);
	});

	it("connects productive latin-style plural forms through post rules", () => {
		const cactiStems = new Set(stemmer.stem("cacti"));
		const cactusStems = stemmer.stem("cactus");
		expect(cactusStems.some((s) => cactiStems.has(s))).toBe(true);

		const analysesStems = new Set(stemmer.stem("analyses"));
		const analysisStems = stemmer.stem("analysis");
		expect(analysisStems.some((s) => analysesStems.has(s))).toBe(true);
	});

	it("composes prefixed irregular forms from base irregulars", () => {
		const outwentStems = new Set(stemmer.stem("outwent"));
		const outgoStems = stemmer.stem("outgo");
		expect(outgoStems.some((s) => outwentStems.has(s))).toBe(true);
	});

	it("returns canonical stems for irregular prefixes", () => {
		const prefixStems = new Set(stemmer.stemPrefix("mic"));
		const mouseStems = stemmer.stem("mouse");
		expect(mouseStems.some((s) => prefixStems.has(s))).toBe(true);
	});

	it("returns canonical stems for WordNet irregular prefixes", () => {
		const prefixStems = new Set(stemmer.stemPrefix("wen"));
		const goStems = stemmer.stem("go");
		expect(goStems.some((s) => prefixStems.has(s))).toBe(true);
	});

	it("returns canonical stems for prefixed irregular prefixes", () => {
		const prefixStems = new Set(stemmer.stemPrefix("outwen"));
		const outgoStems = stemmer.stem("outgo");
		expect(outgoStems.some((s) => prefixStems.has(s))).toBe(true);
	});

	it("returns no prefix stems for short prefixes", () => {
		expect(stemmer.stemPrefix("xy")).toEqual([]);
	});
});
