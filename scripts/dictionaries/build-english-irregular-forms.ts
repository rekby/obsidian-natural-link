import path from "node:path";
import { pathToFileURL } from "node:url";
import * as snowballFactory from "snowball-stemmers";
import {
	isCoveredByEnglishPostRules,
	isCoveredByEnglishPrefixedComposition,
} from "../../src/stemming/english-irregular-rules";
import { type BaseStemFn } from "../../src/stemming/irregular-forms";
import { emitReadonlyMapTs } from "./emit-ts-map";
import { isCoveredByBaseStem } from "./build-russian-irregular-forms";
import { createWordNetSourceParser } from "./wordnet-source";
import { type SourceParser, type WordPair } from "./types";

const ENGLISH_WORD_RE = /^[a-z]+$/;
const ENGLISH_MAP_CONST_NAME = "ENGLISH_IRREGULAR_FORMS";
type SnowballStemmer = { stem(word: string): string };
const englishSnowball = snowballFactory.newStemmer("english") as SnowballStemmer;

type BuildOptions = {
	parseSource: SourceParser;
	baseStem: BaseStemFn;
};

export type EnglishBuildStats = {
	lemmasRead: number;
	pairsRead: number;
	skippedEmpty: number;
	skippedSameForm: number;
	skippedNonEnglishWord: number;
	skippedCoveredByBaseStem: number;
	skippedCoveredByPostRules: number;
	skippedCoveredByPrefixComposition: number;
	dedupedByStemBucket: number;
	stemBuckets: number;
	finalPairs: number;
};

type CliOptions = {
	cacheDir?: string;
	archivePath?: string;
	outputPath?: string;
	forceDownload: boolean;
};

export function normalizeEnglishDictionaryWord(word: string): string {
	return word.trim().toLowerCase();
}

export function isEnglishDictionaryWord(word: string): boolean {
	return ENGLISH_WORD_RE.test(word);
}

export function isCoveredByPostRules(form: string, canonical: string): boolean {
	return isCoveredByEnglishPostRules(form, canonical);
}

function stemWithEnglishSnowball(word: string): string[] {
	return [englishSnowball.stem(word)];
}

function choosePreferredForm(current: string, candidate: string): string {
	if (candidate.length !== current.length) {
		return candidate.length < current.length ? candidate : current;
	}
	return candidate < current ? candidate : current;
}

export async function buildEnglishIrregularPairs({
	parseSource,
	baseStem,
}: BuildOptions): Promise<{ pairs: WordPair[]; stats: EnglishBuildStats }> {
	const buckets = new Map<string, WordPair>();
	const stats: EnglishBuildStats = {
		lemmasRead: 0,
		pairsRead: 0,
		skippedEmpty: 0,
		skippedSameForm: 0,
		skippedNonEnglishWord: 0,
		skippedCoveredByBaseStem: 0,
		skippedCoveredByPostRules: 0,
		skippedCoveredByPrefixComposition: 0,
		dedupedByStemBucket: 0,
		stemBuckets: 0,
		finalPairs: 0,
	};

	const sourceStats = await parseSource(([rawForm, rawCanonical]) => {
		stats.pairsRead++;

		const form = normalizeEnglishDictionaryWord(rawForm);
		const canonical = normalizeEnglishDictionaryWord(rawCanonical);
		if (!form || !canonical) {
			stats.skippedEmpty++;
			return;
		}
		if (!isEnglishDictionaryWord(form) || !isEnglishDictionaryWord(canonical)) {
			stats.skippedNonEnglishWord++;
			return;
		}
		if (form === canonical) {
			stats.skippedSameForm++;
			return;
		}
		if (isCoveredByBaseStem(form, canonical, baseStem)) {
			stats.skippedCoveredByBaseStem++;
			return;
		}
		if (isCoveredByPostRules(form, canonical)) {
			stats.skippedCoveredByPostRules++;
			return;
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
	});

	stats.lemmasRead = sourceStats.lemmas;
	stats.stemBuckets = buckets.size;

	const uniquePairsByKey = new Map<string, WordPair>();
	for (const [form, canonical] of buckets.values()) {
		uniquePairsByKey.set(`${form}\u0000${canonical}`, [form, canonical]);
	}

	const filteredPairs = [...uniquePairsByKey.values()];
	const pairSet = new Set(filteredPairs.map(([form, canonical]) => `${form}\u0000${canonical}`));
	const pairsAfterPrefixFilter: WordPair[] = [];
	for (const [form, canonical] of filteredPairs) {
		const coveredByPrefixComposition = isCoveredByEnglishPrefixedComposition(
			form,
			canonical,
			(innerForm, innerCanonical) => {
				if (innerForm === form && innerCanonical === canonical) {
					return false;
				}
				return pairSet.has(`${innerForm}\u0000${innerCanonical}`);
			},
		);
		if (coveredByPrefixComposition) {
			stats.skippedCoveredByPrefixComposition++;
			continue;
		}
		pairsAfterPrefixFilter.push([form, canonical]);
	}

	const pairs = pairsAfterPrefixFilter.sort(([leftForm], [rightForm]) =>
		leftForm.localeCompare(rightForm, "en"),
	);
	stats.finalPairs = pairs.length;

	return { pairs, stats };
}

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

export async function runEnglishWordNetBuild(argv = process.argv.slice(2)): Promise<void> {
	const options = parseCliOptions(argv);
	const parseSource = createWordNetSourceParser({
		archivePath: options.archivePath,
		cacheDir: options.cacheDir,
		forceDownload: options.forceDownload,
	});

	const { pairs, stats } = await buildEnglishIrregularPairs({
		parseSource,
		baseStem: stemWithEnglishSnowball,
	});

	const outputPath =
		options.outputPath ??
		path.join(process.cwd(), "src/stemming/english-irregular-forms.ts");

	await emitReadonlyMapTs({
		targetPath: outputPath,
		constName: ENGLISH_MAP_CONST_NAME,
		pairs,
		locale: "en",
		headerComment:
			"Generated from WordNet 3.1 exception lists via npm run dict:en:build. Do not edit manually.",
	});

	console.info("WordNet dictionary build complete.");
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
	runEnglishWordNetBuild().catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
}
