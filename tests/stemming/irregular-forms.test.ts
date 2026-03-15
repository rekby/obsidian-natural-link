import { describe, expect, it } from "vitest";
import { IrregularFormsLookup } from "../../src/stemming/irregular-forms";

const STEM_MAP: Record<string, string[]> = {
	mice: ["mice"],
	mouse: ["mous"],
	people: ["peopl"],
	person: ["person"],
	люди: ["люд"],
	людей: ["люд"],
	людям: ["люд"],
	людьми: ["люд"],
	людях: ["люд"],
	человек: ["человек"],
};

function mockBaseStem(word: string): string[] {
	return STEM_MAP[word] ?? [word];
}

describe("IrregularFormsLookup", () => {
	it("adds canonical stems when stem-level dictionary mapping exists", () => {
		const lookup = new IrregularFormsLookup(
			new Map([["mice", "mouse"]]),
			mockBaseStem,
		);
		expect(new Set(lookup.stem("mice"))).toEqual(new Set(["mice", "mous"]));
	});

	it("matches inflected forms through shared stems of irregular keys", () => {
		const lookup = new IrregularFormsLookup(
			new Map([["люди", "человек"]]),
			mockBaseStem,
		);
		expect(new Set(lookup.stem("людей"))).toEqual(new Set(["люд", "человек"]));
	});

	it("returns only base stems when no irregular mapping is found", () => {
		const lookup = new IrregularFormsLookup(
			new Map([["mice", "mouse"]]),
			mockBaseStem,
		);
		expect(lookup.stem("house")).toEqual(["house"]);
	});

	it("returns canonical stems for prefix matches", () => {
		const lookup = new IrregularFormsLookup(
			new Map([
				["mice", "mouse"],
				["people", "person"],
			]),
			mockBaseStem,
		);
		expect(new Set(lookup.stemPrefix("mic"))).toEqual(new Set(["mous"]));
		expect(new Set(lookup.stemPrefix("peo"))).toEqual(new Set(["person"]));
	});

	it("ignores short prefixes, exact matches, and unknown prefixes", () => {
		const lookup = new IrregularFormsLookup(
			new Map([["mice", "mouse"]]),
			mockBaseStem,
		);
		expect(lookup.stemPrefix("mi")).toEqual([]);
		expect(lookup.stemPrefix("mice")).toEqual([]);
		expect(lookup.stemPrefix("xyz")).toEqual([]);
	});

	it("keeps canonical stems for all colliding dictionary canonicals", () => {
		const collisionStem = (word: string): string[] => {
			if (word === "best" || word === "better") {
				return ["be+cmp"];
			}
			return [word];
		};
		const lookup = new IrregularFormsLookup(
			new Map([
				["best", "good"],
				["better", "well"],
			]),
			collisionStem,
		);
		expect(new Set(lookup.stem("best"))).toEqual(new Set(["be+cmp", "good", "well"]));
	});

	it("adds stems from extra canonical resolver", () => {
		const lookup = new IrregularFormsLookup(
			new Map(),
			mockBaseStem,
			{
				extraCanonicalResolver: () => ["mouse"],
			},
		);
		expect(new Set(lookup.stem("mice"))).toEqual(new Set(["mice", "mous"]));
	});
});
