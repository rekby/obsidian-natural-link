import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { normalizeYo } from "../../src/stemming/russian-base-stem";
import { createOpenCorporaLemmaGroupParser } from "./opencorpora-source";
import { type LemmaGroup, type LemmaGroupSourceParser } from "./types";

const FILTERED_GRAMMEMES = new Set(["Surn", "Patr", "Name", "Orgn"]);
const MIN_STEM_LENGTH = 3;
const MIN_SUFFIX_COUNT = 5;

type SuffixRule = { suffix: string; minStem: number };

type SuffixBuildStats = {
	lemmasRead: number;
	lemmasFiltered: number;
	lemmasSuppletive: number;
	lemmasProcessed: number;
	rawSuffixCount: number;
	prunedSuffixCount: number;
	finalRuleCount: number;
};

function normalizeWord(word: string): string {
	return normalizeYo(word.trim().toLowerCase());
}

export function computeMinLCP(forms: string[]): number {
	if (forms.length === 0) return 0;
	if (forms.length === 1) return forms[0]!.length;

	let minLen = Infinity;
	for (const f of forms) {
		if (f.length < minLen) minLen = f.length;
	}

	const first = forms[0]!;
	let lcp = 0;
	for (let i = 0; i < minLen; i++) {
		const ch = first[i];
		let allMatch = true;
		for (let j = 1; j < forms.length; j++) {
			if (forms[j]![i] !== ch) {
				allMatch = false;
				break;
			}
		}
		if (!allMatch) break;
		lcp++;
	}
	return lcp;
}

type BuildOptions = {
	parseLemmaGroups: LemmaGroupSourceParser;
};

export async function buildSuffixRules({
	parseLemmaGroups,
}: BuildOptions): Promise<{ rules: SuffixRule[]; stats: SuffixBuildStats }> {
	const suffixCounts = new Map<string, { count: number; minStem: number }>();

	const stats: SuffixBuildStats = {
		lemmasRead: 0,
		lemmasFiltered: 0,
		lemmasSuppletive: 0,
		lemmasProcessed: 0,
		rawSuffixCount: 0,
		prunedSuffixCount: 0,
		finalRuleCount: 0,
	};

	const parserStats = await parseLemmaGroups((group: LemmaGroup) => {
		stats.lemmasRead++;

		for (const g of group.grammemes) {
			if (FILTERED_GRAMMEMES.has(g)) {
				stats.lemmasFiltered++;
				return;
			}
		}

		const allForms = [group.lemma, ...group.forms].map(normalizeWord);
		const minLCP = computeMinLCP(allForms);

		if (minLCP < MIN_STEM_LENGTH) {
			stats.lemmasSuppletive++;
			return;
		}

		stats.lemmasProcessed++;

		for (const form of allForms) {
			const suffix = form.slice(minLCP);
			const existing = suffixCounts.get(suffix);
			if (existing) {
				existing.count++;
				if (minLCP < existing.minStem) {
					existing.minStem = minLCP;
				}
			} else {
				suffixCounts.set(suffix, { count: 1, minStem: minLCP });
			}
		}
	});

	stats.lemmasRead = parserStats.lemmas;
	stats.rawSuffixCount = suffixCounts.size;

	const rules: SuffixRule[] = [];
	for (const [suffix, { count, minStem }] of suffixCounts) {
		if (count < MIN_SUFFIX_COUNT) {
			stats.prunedSuffixCount++;
			continue;
		}
		rules.push({ suffix, minStem });
	}

	rules.sort((a, b) => b.suffix.length - a.suffix.length || a.suffix.localeCompare(b.suffix));
	stats.finalRuleCount = rules.length;

	return { rules, stats };
}

function escapeString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function emitSuffixRulesTs(
	targetPath: string,
	rules: SuffixRule[],
): Promise<void> {
	const lines = rules.map(
		(r) => `\t{ suffix: "${escapeString(r.suffix)}", minStem: ${r.minStem} },`,
	);
	const output = [
		"// Generated from OpenCorpora dictionary export via npm run dict:ru:suffix. Do not edit manually.",
		"export const RUSSIAN_SUFFIX_RULES: readonly { suffix: string; minStem: number }[] = [",
		...lines,
		"];",
		"",
	].join("\n");

	await mkdir(path.dirname(targetPath), { recursive: true });
	await writeFile(targetPath, output, "utf8");
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
		if (!next) continue;
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

export async function runSuffixRulesBuild(argv = process.argv.slice(2)): Promise<void> {
	const options = parseCliOptions(argv);
	const parseLemmaGroups = createOpenCorporaLemmaGroupParser({
		archivePath: options.archivePath,
		cacheDir: options.cacheDir,
		forceDownload: options.forceDownload,
	});

	const { rules, stats } = await buildSuffixRules({ parseLemmaGroups });

	const outputPath =
		options.outputPath ??
		path.join(process.cwd(), "src/stemming/russian-suffix-rules.ts");

	await emitSuffixRulesTs(outputPath, rules);

	console.info("Suffix rules build complete.");
	console.info(JSON.stringify({ outputPath, ...stats }, null, 2));
}

function isMainModule(): boolean {
	const entry = process.argv[1];
	if (!entry) return false;
	return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
	runSuffixRulesBuild().catch((error: unknown) => {
		console.error(error);
		process.exit(1);
	});
}
