import { describe, expect, it } from "vitest";
import {
	buildEnglishIrregularPairs,
	isCoveredByPostRules,
} from "../../scripts/dictionaries/build-english-irregular-forms";
import { type SourceParser } from "../../scripts/dictionaries/types";

describe("isCoveredByPostRules", () => {
	it("detects productive english irregular suffix patterns", () => {
		expect(isCoveredByPostRules("happier", "happy")).toBe(true);
		expect(isCoveredByPostRules("happiest", "happy")).toBe(true);
		expect(isCoveredByPostRules("cacti", "cactus")).toBe(true);
		expect(isCoveredByPostRules("analyses", "analysis")).toBe(true);
		expect(isCoveredByPostRules("went", "go")).toBe(false);
	});
});

describe("buildEnglishIrregularPairs", () => {
	it("filters post-rule and prefixed-composition-covered pairs", async () => {
		const parseSource: SourceParser = async (sink) => {
			const pairs: Array<[string, string]> = [
				["happier", "happy"],
				["happiest", "happy"],
				["cacti", "cactus"],
				["went", "go"],
				["outwent", "outgo"],
				["mice", "mouse"],
			];
			for (const pair of pairs) {
				await sink(pair);
			}
			return {
				lemmas: pairs.length,
				pairs: pairs.length,
			};
		};

		const { pairs, stats } = await buildEnglishIrregularPairs({
			parseSource,
			baseStem: (word) => [word],
		});

		expect(pairs).toEqual([
			["mice", "mouse"],
			["went", "go"],
		]);
		expect(stats.skippedCoveredByPostRules).toBe(3);
		expect(stats.skippedCoveredByPrefixComposition).toBe(1);
	});

	it("filters all hyphenated forms and canonicals", async () => {
		const parseSource: SourceParser = async (sink) => {
			const pairs: Array<[string, string]> = [
				["co-opted", "coopt"],
				["outwent", "out-go"],
				["went", "go"],
			];
			for (const pair of pairs) {
				await sink(pair);
			}
			return {
				lemmas: pairs.length,
				pairs: pairs.length,
			};
		};

		const { pairs, stats } = await buildEnglishIrregularPairs({
			parseSource,
			baseStem: (word) => [word],
		});

		expect(pairs).toEqual([["went", "go"]]);
		expect(stats.skippedNonEnglishWord).toBe(2);
	});
});
