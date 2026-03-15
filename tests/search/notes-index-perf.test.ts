import { describe, it, expect } from "vitest";
import { NotesIndex } from "../../src/search/notes-index";
import { NoteInfo, Stemmer } from "../../src/types";
import { RussianStemmer } from "../../src/stemming/russian-stemmer";
import { EnglishStemmer } from "../../src/stemming/english-stemmer";
import { MultiStemmer } from "../../src/stemming/multi-stemmer";
import { russianSnowballStem } from "../../src/stemming/russian-base-stem";
import { russianSuffixStem } from "../../src/stemming/russian-suffix-stem";

function combinedBaseStem(word: string): string[] {
	return [...new Set([...russianSuffixStem(word), ...russianSnowballStem(word)])];
}

const RUSSIAN_WORDS = [
	"проект", "заметка", "документ", "работа", "задача",
	"список", "отчёт", "встреча", "план", "идея",
	"решение", "вопрос", "ответ", "система", "процесс",
	"результат", "анализ", "разработка", "тестирование", "обзор",
	"бюджет", "контракт", "клиент", "команда", "ресурс",
	"график", "событие", "запись", "файл", "папка",
];

const ENGLISH_WORDS = [
	"project", "meeting", "document", "report", "review",
	"analysis", "planning", "research", "design", "testing",
	"budget", "contract", "client", "resource", "schedule",
	"feature", "component", "module", "service", "database",
	"network", "security", "update", "release", "version",
	"backup", "archive", "template", "workflow", "dashboard",
];

const ADJECTIVES_RU = [
	"новый", "важный", "текущий", "основной", "дополнительный",
	"финальный", "промежуточный", "первый", "второй", "третий",
];

const ADJECTIVES_EN = [
	"new", "important", "current", "main", "additional",
	"final", "quarterly", "first", "second", "weekly",
];

function generateNotes(count: number): NoteInfo[] {
	const notes: NoteInfo[] = [];
	const allWords = [...RUSSIAN_WORDS, ...ENGLISH_WORDS];
	const allAdj = [...ADJECTIVES_RU, ...ADJECTIVES_EN];

	for (let i = 0; i < count; i++) {
		const adj = allAdj[i % allAdj.length]!;
		const noun = allWords[i % allWords.length]!;
		const suffix = Math.floor(i / allWords.length);
		const title = suffix > 0 ? `${adj} ${noun} ${suffix}` : `${adj} ${noun}`;
		const aliases = i % 3 === 0
			? [`${noun} ${adj}`]
			: [];
		notes.push({ path: `${title}.md`, title, aliases });
	}
	return notes;
}

function buildStemmer(): Stemmer {
	return new MultiStemmer([
		new RussianStemmer(combinedBaseStem),
		new EnglishStemmer(),
	]);
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? sorted[mid]!
		: (sorted[mid - 1]! + sorted[mid]!) / 2;
}

describe("NotesIndex performance", () => {
	const NOTE_COUNT = 10_000;
	const notes = generateNotes(NOTE_COUNT);
	const stemmer = buildStemmer();

	const queries = [
		"прое",
		"проект",
		"новый проект",
		"важный документ",
		"meet",
		"meeting",
		"new project",
		"quarterly report",
		"тестирован",
		"обзор результат",
	];

	it(`search latency stays under 50ms for ${NOTE_COUNT} notes`, () => {
		const index = new NotesIndex(notes, stemmer);

		const WARMUP_RUNS = 3;
		const MEASURED_RUNS = 10;

		for (let w = 0; w < WARMUP_RUNS; w++) {
			for (const q of queries) index.search(q);
		}

		const timings: number[] = [];
		for (let r = 0; r < MEASURED_RUNS; r++) {
			for (const q of queries) {
				const start = performance.now();
				index.search(q);
				timings.push(performance.now() - start);
			}
		}

		const p50 = median(timings);
		const sorted = [...timings].sort((a, b) => a - b);
		const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
		const max = sorted[sorted.length - 1]!;

		console.debug(
			`Search perf (${NOTE_COUNT} notes, ${queries.length} queries × ${MEASURED_RUNS} runs): ` +
			`p50=${p50.toFixed(2)}ms  p95=${p95.toFixed(2)}ms  max=${max.toFixed(2)}ms`,
		);

		expect(p95).toBeLessThan(50);
	});

	it("index construction completes in reasonable time", () => {
		const RUNS = 3;
		const timings: number[] = [];

		for (let r = 0; r < RUNS; r++) {
			const start = performance.now();
			new NotesIndex(notes, stemmer);
			timings.push(performance.now() - start);
		}

		const best = Math.min(...timings);
		console.debug(
			`Index construction (${NOTE_COUNT} notes): ` +
			`best=${best.toFixed(0)}ms  median=${median(timings).toFixed(0)}ms`,
		);

		expect(best).toBeLessThan(5000);
	});
});
