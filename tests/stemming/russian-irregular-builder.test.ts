import { describe, expect, it } from "vitest";
import {
	buildRussianIrregularPairs,
	buildRussianIrregularPairsFromGroups,
	isCoveredByBaseStem,
} from "../../scripts/dictionaries/build-russian-irregular-forms";
import { russianSnowballStem } from "../../src/stemming/russian-base-stem";
import { type LemmaGroupSourceParser, type SourceParser } from "../../scripts/dictionaries/types";
import { russianSuffixStem } from "../../src/stemming/russian-suffix-stem";

describe("buildRussianIrregularPairs (legacy pair-based)", () => {
	it("keeps only forms not covered by the base stemmer", async () => {
		const parseSource: SourceParser = async (sink) => {
			const pairs: Array<[string, string]> = [
				["людей", "человек"],
				["людям", "человек"],
				["люди", "человек"],
				["руки", "рука"],
				["костылём", "костыль"],
				["ходил", "ходить"],
				["человек", "человек"],
				["people", "человек"],
			];
			for (const pair of pairs) {
				await sink(pair);
			}
			return {
				lemmas: 4,
				pairs: pairs.length,
			};
		};

		const { pairs, stats } = await buildRussianIrregularPairs({ parseSource });

		expect(pairs).toEqual([["люди", "человек"]]);
		expect(stats.pairsRead).toBe(8);
		expect(stats.skippedCoveredByBaseStem).toBeGreaterThan(0);
		expect(stats.skippedNonRussianWord).toBe(1);
		expect(stats.skippedSameForm).toBe(1);
		expect(stats.dedupedByStemBucket).toBe(2);
	});
});

describe("buildRussianIrregularPairsFromGroups", () => {
	it("filters proper nouns by grammemes", async () => {
		const parseLemmaGroups: LemmaGroupSourceParser = async (sink) => {
			await sink({
				lemma: "человек",
				forms: ["люди", "людей", "людям"],
				grammemes: new Set(["NOUN", "anim"]),
			});
			await sink({
				lemma: "Иванов",
				forms: ["Иванова", "Иванову"],
				grammemes: new Set(["NOUN", "Surn"]),
			});
			return { lemmas: 2 };
		};

		const { stats } = await buildRussianIrregularPairsFromGroups({
			parseLemmaGroups,
			baseStem: russianSuffixStem,
		});

		expect(stats.lemmasFiltered).toBe(1);
	});

	it("only includes suppletive lemmas (min-LCP < 3)", async () => {
		const parseLemmaGroups: LemmaGroupSourceParser = async (sink) => {
			// suppletive: человек / люди have LCP < 3
			await sink({
				lemma: "человек",
				forms: ["люди", "людей"],
				grammemes: new Set(["NOUN"]),
			});
			// regular: коробка / коробки have long LCP
			await sink({
				lemma: "коробка",
				forms: ["коробки", "коробке"],
				grammemes: new Set(["NOUN"]),
			});
			return { lemmas: 2 };
		};

		const { pairs, stats } = await buildRussianIrregularPairsFromGroups({
			parseLemmaGroups,
			baseStem: russianSuffixStem,
		});

		expect(stats.lemmasRegular).toBe(1);
		expect(stats.lemmasSuppletive).toBe(1);
		expect(pairs.length).toBeGreaterThan(0);
		for (const [, canonical] of pairs) {
			expect(canonical).toBe("человек");
		}
	});
});

describe("isCoveredByBaseStem (snowball)", () => {
	it("detects forms covered by yo normalization and alternation-aware stemming", () => {
		expect(isCoveredByBaseStem("костылём", "костыль", russianSnowballStem)).toBe(true);
		expect(isCoveredByBaseStem("дружить", "друг", russianSnowballStem)).toBe(true);
		expect(isCoveredByBaseStem("людей", "человек", russianSnowballStem)).toBe(false);
	});
});

describe("isCoveredByBaseStem (with suffix stemmer)", () => {
	it("suffix stemmer covers regular inflections", () => {
		expect(isCoveredByBaseStem("коробки", "коробка", russianSuffixStem)).toBe(true);
		expect(isCoveredByBaseStem("ходил", "ходить", russianSuffixStem)).toBe(true);
	});

	it("suffix stemmer does not cover suppletive forms", () => {
		expect(isCoveredByBaseStem("людей", "человек", russianSuffixStem)).toBe(false);
	});
});
