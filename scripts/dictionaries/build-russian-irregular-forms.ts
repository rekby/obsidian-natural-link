import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeYo, russianSnowballStem } from "../../src/stemming/russian-base-stem";
import { russianSuffixStem } from "../../src/stemming/russian-suffix-stem";
import { type BaseStemFn } from "../../src/stemming/irregular-forms";
import { emitReadonlyMapTs } from "./emit-ts-map";
import { createOpenCorporaLemmaGroupParser } from "./opencorpora-source";
import {
	type LemmaGroup,
	type LemmaGroupSourceParser,
	type SourceParser,
	type WordPair,
} from "./types";
import { computeMinLCP } from "./build-russian-suffix-rules";

const RUSSIAN_WORD_RE = /^[а-яё-]+$/i;
const RUSSIAN_MAP_CONST_NAME = "RUSSIAN_IRREGULAR_FORMS";
const FILTERED_GRAMMEMES = new Set(["Surn", "Patr", "Name", "Orgn"]);
const MIN_STEM_LENGTH = 3;

type BuildOptions = {
	parseSource: SourceParser;
};

type LemmaGroupBuildOptions = {
	parseLemmaGroups: LemmaGroupSourceParser;
	baseStem: BaseStemFn;
};

export type RussianBuildStats = {
	lemmasRead: number;
	pairsRead: number;
	skippedEmpty: number;
	skippedSameForm: number;
	skippedNonRussianWord: number;
	skippedCoveredByBaseStem: number;
	dedupedByStemBucket: number;
	stemBuckets: number;
	finalPairs: number;
};

export type RussianLemmaGroupBuildStats = {
	lemmasRead: number;
	lemmasFiltered: number;
	lemmasRegular: number;
	lemmasSuppletive: number;
	pairsGenerated: number;
	skippedEmpty: number;
	skippedSameForm: number;
	skippedNonRussianWord: number;
	skippedCoveredByBaseStem: number;
	dedupedByStemBucket: number;
	stemBuckets: number;
	finalPairs: number;
};

export function normalizeDictionaryWord(word: string): string {
	return normalizeYo(word.trim().toLowerCase());
}

export function isRussianDictionaryWord(word: string): boolean {
	return RUSSIAN_WORD_RE.test(word);
}

export function isCoveredByBaseStem(form: string, canonical: string, baseStem: BaseStemFn): boolean {
	const formStems = new Set(baseStem(form));
	for (const stem of baseStem(canonical)) {
		if (formStems.has(stem)) return true;
	}
	return false;
}

/** @deprecated Use isCoveredByBaseStem with explicit baseStem. Kept for test compat. */
export function isCoveredByRussianBaseStem(form: string, canonical: string): boolean {
	return isCoveredByBaseStem(form, canonical, russianSnowballStem);
}

function choosePreferredForm(current: string, candidate: string): string {
	if (candidate.length !== current.length) {
		return candidate.length < current.length ? candidate : current;
	}
	return candidate < current ? candidate : current;
}

/**
 * Legacy pair-based builder. Uses Snowball for filtering.
 * Kept for backward compatibility with existing tests.
 */
export async function buildRussianIrregularPairs({
	parseSource,
}: BuildOptions): Promise<{ pairs: WordPair[]; stats: RussianBuildStats }> {
	const buckets = new Map<string, WordPair>();
	const stats: RussianBuildStats = {
		lemmasRead: 0,
		pairsRead: 0,
		skippedEmpty: 0,
		skippedSameForm: 0,
		skippedNonRussianWord: 0,
		skippedCoveredByBaseStem: 0,
		dedupedByStemBucket: 0,
		stemBuckets: 0,
		finalPairs: 0,
	};

	const sourceStats = await parseSource(([rawForm, rawCanonical]) => {
		stats.pairsRead++;

		const form = normalizeDictionaryWord(rawForm);
		const canonical = normalizeDictionaryWord(rawCanonical);
		if (!form || !canonical) {
			stats.skippedEmpty++;
			return;
		}
		if (!isRussianDictionaryWord(form) || !isRussianDictionaryWord(canonical)) {
			stats.skippedNonRussianWord++;
			return;
		}
		if (form === canonical) {
			stats.skippedSameForm++;
			return;
		}
		if (isCoveredByBaseStem(form, canonical, russianSnowballStem)) {
			stats.skippedCoveredByBaseStem++;
			return;
		}

		for (const stem of russianSnowballStem(form)) {
			const bucketKey = `${canonical}\u0000${stem}`;
			const existing = buckets.get(bucketKey);
			if (!existing) {
				buckets.set(bucketKey, [form, canonical]);
				continue;
			}

			const [existingForm] = existing;
			const preferredForm = choosePreferredForm(existingForm, form);
			if (preferredForm !== existingForm) {
				buckets.set(bucketKey, [preferredForm, canonical]);
			}
			stats.dedupedByStemBucket++;
		}
	});

	stats.lemmasRead = sourceStats.lemmas;
	stats.stemBuckets = buckets.size;

	const uniquePairsByKey = new Map<string, WordPair>();
	for (const [form, canonical] of buckets.values()) {
		uniquePairsByKey.set(`${form}\u0000${canonical}`, [form, canonical]);
	}

	const pairs = [...uniquePairsByKey.values()].sort(([leftForm], [rightForm]) =>
		leftForm.localeCompare(rightForm, "ru"),
	);
	stats.finalPairs = pairs.length;

	return { pairs, stats };
}

/**
 * Lemma-group-based builder. Filters by grammemes (Surn/Patr/Name/Orgn),
 * only includes suppletive lemmas (min-LCP < MIN_STEM_LENGTH), and uses
 * the provided baseStem (typically suffix-based) for coverage filtering.
 */
export async function buildRussianIrregularPairsFromGroups({
	parseLemmaGroups,
	baseStem,
}: LemmaGroupBuildOptions): Promise<{ pairs: WordPair[]; stats: RussianLemmaGroupBuildStats }> {
	const buckets = new Map<string, WordPair>();
	const stats: RussianLemmaGroupBuildStats = {
		lemmasRead: 0,
		lemmasFiltered: 0,
		lemmasRegular: 0,
		lemmasSuppletive: 0,
		pairsGenerated: 0,
		skippedEmpty: 0,
		skippedSameForm: 0,
		skippedNonRussianWord: 0,
		skippedCoveredByBaseStem: 0,
		dedupedByStemBucket: 0,
		stemBuckets: 0,
		finalPairs: 0,
	};

	const parserStats = await parseLemmaGroups((group: LemmaGroup) => {
		stats.lemmasRead++;

		for (const g of group.grammemes) {
			if (FILTERED_GRAMMEMES.has(g)) {
				stats.lemmasFiltered++;
				return;
			}
		}

		const allForms = [group.lemma, ...group.forms].map((w) => normalizeDictionaryWord(w));
		const minLCP = computeMinLCP(allForms);

		if (minLCP >= MIN_STEM_LENGTH) {
			stats.lemmasRegular++;
			return;
		}

		stats.lemmasSuppletive++;
		const canonical = normalizeDictionaryWord(group.lemma);

		for (const rawForm of group.forms) {
			const form = normalizeDictionaryWord(rawForm);
			stats.pairsGenerated++;

			if (!form || !canonical) {
				stats.skippedEmpty++;
				continue;
			}
			if (!isRussianDictionaryWord(form) || !isRussianDictionaryWord(canonical)) {
				stats.skippedNonRussianWord++;
				continue;
			}
			if (form === canonical) {
				stats.skippedSameForm++;
				continue;
			}
			if (isCoveredByBaseStem(form, canonical, baseStem)) {
				stats.skippedCoveredByBaseStem++;
				continue;
			}

			for (const stem of baseStem(form)) {
				const bucketKey = `${canonical}\u0000${stem}`;
				const existing = buckets.get(bucketKey);
				if (!existing) {
					buckets.set(bucketKey, [form, canonical]);
					continue;
				}

				const [existingForm] = existing;
				const preferredForm = choosePreferredForm(existingForm, form);
				if (preferredForm !== existingForm) {
					buckets.set(bucketKey, [preferredForm, canonical]);
				}
				stats.dedupedByStemBucket++;
			}
		}
	});

	stats.lemmasRead = parserStats.lemmas;
	stats.stemBuckets = buckets.size;

	const uniquePairsByKey = new Map<string, WordPair>();
	for (const [form, canonical] of buckets.values()) {
		uniquePairsByKey.set(`${form}\u0000${canonical}`, [form, canonical]);
	}

	const pairs = [...uniquePairsByKey.values()].sort(([leftForm], [rightForm]) =>
		leftForm.localeCompare(rightForm, "ru"),
	);
	stats.finalPairs = pairs.length;

	return { pairs, stats };
}

type CliOptions = {
	cacheDir?: string;
	archivePath?: string;
	outputPath?: string;
	forceDownload: boolean;
};

function parseCliOptions(argv: string[]): CliOptions {
	const options: CliOptions = { forceDownload: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--force-download") {
			options.forceDownload = true;
			continue;
		}
		const next = argv[i + 1];
		if (!next) {
			continue;
		}
		if (arg === "--cache-dir") {
			options.cacheDir = next;
			i++;
			continue;
		}
		if (arg === "--archive-path") {
			options.archivePath = next;
			i++;
			continue;
		}
		if (arg === "--output") {
			options.outputPath = next;
			i++;
		}
	}
	return options;
}

export async function runRussianOpenCorporaBuild(argv = process.argv.slice(2)): Promise<void> {
	const options = parseCliOptions(argv);
	const parseLemmaGroups = createOpenCorporaLemmaGroupParser({
		archivePath: options.archivePath,
		cacheDir: options.cacheDir,
		forceDownload: options.forceDownload,
	});

	const { pairs, stats } = await buildRussianIrregularPairsFromGroups({
		parseLemmaGroups,
		baseStem: russianSuffixStem,
	});

	const outputPath =
		options.outputPath ??
		path.join(process.cwd(), "src/stemming/russian-irregular-forms.ts");

	await emitReadonlyMapTs({
		targetPath: outputPath,
		constName: RUSSIAN_MAP_CONST_NAME,
		pairs,
		locale: "ru",
		headerComment:
			"Generated from OpenCorpora dictionary export via npm run dict:ru:build. Do not edit manually.",
	});

	console.info("OpenCorpora dictionary build complete.");
	console.info(
		JSON.stringify(
			{
				outputPath,
				...stats,
			},
			null,
			2,
		),
	);
}

function isMainModule(): boolean {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}
	return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
	runRussianOpenCorporaBuild().catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
}
