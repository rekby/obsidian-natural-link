import { describe, expect, it } from "vitest";
import {
	computeMinLCP,
	buildSuffixRules,
} from "../../scripts/dictionaries/build-russian-suffix-rules";
import { type LemmaGroupSourceParser } from "../../scripts/dictionaries/types";

describe("computeMinLCP", () => {
	it("returns 0 for empty array", () => {
		expect(computeMinLCP([])).toBe(0);
	});

	it("returns full length for single-element array", () => {
		expect(computeMinLCP(["коробка"])).toBe(7);
	});

	it("computes LCP for regular noun forms", () => {
		expect(computeMinLCP(["коробка", "коробки", "коробке", "коробку"])).toBe(6);
	});

	it("computes small LCP for suppletive forms", () => {
		expect(computeMinLCP(["человек", "люди", "людей"])).toBe(0);
	});

	it("handles identical strings", () => {
		expect(computeMinLCP(["abc", "abc", "abc"])).toBe(3);
	});
});

describe("buildSuffixRules", () => {
	it("extracts suffix rules from lemma groups", async () => {
		const parseLemmaGroups: LemmaGroupSourceParser = async (sink) => {
			for (let i = 0; i < 10; i++) {
				await sink({
					lemma: `тест${i}ка`,
					forms: [`тест${i}ки`, `тест${i}ке`, `тест${i}ку`, `тест${i}кой`],
					grammemes: new Set(["NOUN"]),
				});
			}
			return { lemmas: 10 };
		};

		const { rules, stats } = await buildSuffixRules({ parseLemmaGroups });

		expect(stats.lemmasProcessed).toBe(10);
		expect(stats.lemmasSuppletive).toBe(0);
		expect(stats.finalRuleCount).toBeGreaterThan(0);

		const suffixes = new Set(rules.map((r) => r.suffix));
		expect(suffixes.has("а")).toBe(true);
		expect(suffixes.has("и")).toBe(true);
		expect(suffixes.has("е")).toBe(true);
		expect(suffixes.has("у")).toBe(true);
		expect(suffixes.has("ой")).toBe(true);
	});

	it("filters proper nouns by grammemes", async () => {
		const parseLemmaGroups: LemmaGroupSourceParser = async (sink) => {
			for (let i = 0; i < 10; i++) {
				await sink({
					lemma: `Иванов${i}`,
					forms: [`Иванов${i}а`, `Иванов${i}у`],
					grammemes: new Set(["NOUN", "Surn"]),
				});
			}
			return { lemmas: 10 };
		};

		const { stats } = await buildSuffixRules({ parseLemmaGroups });

		expect(stats.lemmasFiltered).toBe(10);
		expect(stats.lemmasProcessed).toBe(0);
	});

	it("marks suppletive lemmas (min-LCP < 3)", async () => {
		const parseLemmaGroups: LemmaGroupSourceParser = async (sink) => {
			for (let i = 0; i < 10; i++) {
				await sink({
					lemma: "человек",
					forms: ["люди", "людей"],
					grammemes: new Set(["NOUN"]),
				});
			}
			return { lemmas: 10 };
		};

		const { stats } = await buildSuffixRules({ parseLemmaGroups });

		expect(stats.lemmasSuppletive).toBe(10);
		expect(stats.lemmasProcessed).toBe(0);
	});

	it("rules are sorted by suffix length descending", async () => {
		const parseLemmaGroups: LemmaGroupSourceParser = async (sink) => {
			for (let i = 0; i < 10; i++) {
				await sink({
					lemma: `слов${i}о`,
					forms: [`слов${i}а`, `слов${i}ам`, `слов${i}ами`],
					grammemes: new Set(["NOUN"]),
				});
			}
			return { lemmas: 10 };
		};

		const { rules } = await buildSuffixRules({ parseLemmaGroups });

		for (let i = 1; i < rules.length; i++) {
			expect(rules[i]!.suffix.length).toBeLessThanOrEqual(rules[i - 1]!.suffix.length);
		}
	});
});
