import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { StringDecoder } from "node:string_decoder";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { SaxesParser, type SaxesTag } from "saxes";
import unbzip2Stream from "unbzip2-stream";
import {
	type LemmaGroupParserStats,
	type LemmaGroupSink,
	type LemmaGroupSourceParser,
	type PairSink,
	type SourceParser,
	type SourceParserStats,
} from "./types";

export const OPENCORPORA_DICT_BZ2_URL =
	"https://opencorpora.org/files/export/dict/dict.opcorpora.xml.bz2";

const DEFAULT_CACHE_DIR = ".cache/dictionaries/opencorpora";
const DEFAULT_ARCHIVE_FILENAME = "dict.opcorpora.xml.bz2";

type DownloadOptions = {
	url?: string;
	targetPath: string;
};

type OpenCorporaSourceOptions = {
	archivePath?: string;
	cacheDir?: string;
	forceDownload?: boolean;
	url?: string;
};

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		Symbol.asyncIterator in value &&
		typeof (value as AsyncIterable<T>)[Symbol.asyncIterator] === "function"
	);
}

async function* streamToAsyncIterable(
	stream: NodeJS.ReadableStream,
): AsyncGenerator<unknown> {
	const queue: unknown[] = [];
	let ended = false;
	let error: Error | null = null;
	let notify: (() => void) | null = null;

	const wake = (): void => {
		if (!notify) {
			return;
		}
		notify();
		notify = null;
	};

	const onData = (chunk: unknown): void => {
		queue.push(chunk);
		wake();
	};
	const onEnd = (): void => {
		ended = true;
		wake();
	};
	const onError = (err: Error): void => {
		error = err;
		ended = true;
		wake();
	};

	stream.on("data", onData);
	stream.on("end", onEnd);
	stream.on("error", onError);

	try {
		while (!ended || queue.length > 0) {
			if (error) {
				throw error;
			}
			if (queue.length === 0) {
				await new Promise<void>((resolve) => {
					notify = resolve;
				});
				continue;
			}
			const chunk = queue.shift();
			if (chunk !== undefined) {
				yield chunk;
			}
		}
	} finally {
		stream.off("data", onData);
		stream.off("end", onEnd);
		stream.off("error", onError);
	}
}

function getTagTextAttribute(tag: SaxesTag): string | null {
	const maybe = tag.attributes.t;
	if (typeof maybe === "string") {
		return maybe;
	}
	if (maybe && typeof maybe === "object" && "value" in maybe) {
		const { value } = maybe;
		return typeof value === "string" ? value : null;
	}
	return null;
}

function getTagValueAttribute(tag: SaxesTag): string | null {
	const maybe = tag.attributes.v;
	if (typeof maybe === "string") {
		return maybe;
	}
	if (maybe && typeof maybe === "object" && "value" in maybe) {
		const { value } = maybe;
		return typeof value === "string" ? value : null;
	}
	return null;
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function downloadOpenCorporaArchive({
	url = OPENCORPORA_DICT_BZ2_URL,
	targetPath,
}: DownloadOptions): Promise<string> {
	await mkdir(path.dirname(targetPath), { recursive: true });

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`OpenCorpora download failed: ${response.status} ${response.statusText}`);
	}
	if (!response.body) {
		throw new Error("OpenCorpora download failed: response has no body");
	}

	const nodeStream = Readable.fromWeb(
		response.body as unknown as globalThis.ReadableStream<Uint8Array>,
	);
	await pipeline(nodeStream, createWriteStream(targetPath));
	return targetPath;
}

export async function parseOpenCorporaXmlStream(
	xmlStream: NodeJS.ReadableStream | AsyncIterable<unknown>,
	sink: PairSink,
): Promise<SourceParserStats> {
	const parser = new SaxesParser({ xmlns: false });
	const decoder = new StringDecoder("utf8");

	let inLemma = false;
	let lemma: string | null = null;
	let forms = new Set<string>();
	let lemmasCount = 0;
	let producedPairs = 0;
	let parseError: Error | null = null;
	const pendingPairs: Array<readonly [string, string]> = [];

	async function flushPendingPairs(): Promise<void> {
		while (pendingPairs.length > 0) {
			// Shift keeps insertion order and preserves deterministic output.
			const pair = pendingPairs.shift();
			if (!pair) {
				continue;
			}
			await sink(pair);
			producedPairs++;
		}
	}

	parser.on("error", (err: Error) => {
		parseError = err;
	});

	parser.on("opentag", (tag: SaxesTag) => {
		if (tag.name === "lemma") {
			inLemma = true;
			lemma = null;
			forms = new Set<string>();
			return;
		}
		if (!inLemma) {
			return;
		}
		if (tag.name !== "l" && tag.name !== "f") {
			return;
		}

		const value = getTagTextAttribute(tag);
		if (!value) {
			return;
		}

		if (tag.name === "l") {
			lemma = value;
			return;
		}

		forms.add(value);
	});

	parser.on("closetag", (tag: SaxesTag) => {
		const tagName = tag.name;
		if (tagName !== "lemma") {
			return;
		}

		lemmasCount++;
		if (lemma) {
			for (const form of forms) {
				pendingPairs.push([form, lemma]);
			}
		}

		inLemma = false;
		lemma = null;
		forms = new Set<string>();
	});

	const chunks = isAsyncIterable(xmlStream)
		? xmlStream
		: streamToAsyncIterable(xmlStream);
	for await (const chunk of chunks) {
		if (parseError) {
			throw parseError;
		}
		const asBuffer =
			typeof chunk === "string"
				? Buffer.from(chunk, "utf8")
				: Buffer.isBuffer(chunk)
					? chunk
					: chunk instanceof Uint8Array
						? Buffer.from(chunk)
						: Buffer.from(String(chunk), "utf8");
		parser.write(decoder.write(asBuffer));
		await flushPendingPairs();
	}

	parser.write(decoder.end());
	parser.close();
	await flushPendingPairs();

	if (parseError) {
		throw parseError;
	}

	return {
		lemmas: lemmasCount,
		pairs: producedPairs,
	};
}

export async function parseOpenCorporaLemmaGroups(
	xmlStream: NodeJS.ReadableStream | AsyncIterable<unknown>,
	sink: LemmaGroupSink,
): Promise<LemmaGroupParserStats> {
	const parser = new SaxesParser({ xmlns: false });
	const decoder = new StringDecoder("utf8");

	let inLemma = false;
	let insideLTag = false;
	let lemma: string | null = null;
	let forms: string[] = [];
	let lemmaGrammemes = new Set<string>();
	let lemmasCount = 0;
	let parseError: Error | null = null;
	const pendingGroups: Array<{ lemma: string; forms: string[]; grammemes: Set<string> }> = [];

	async function flushPendingGroups(): Promise<void> {
		while (pendingGroups.length > 0) {
			const group = pendingGroups.shift();
			if (!group) continue;
			await sink({
				lemma: group.lemma,
				forms: group.forms,
				grammemes: group.grammemes,
			});
		}
	}

	parser.on("error", (err: Error) => {
		parseError = err;
	});

	parser.on("opentag", (tag: SaxesTag) => {
		if (tag.name === "lemma") {
			inLemma = true;
			insideLTag = false;
			lemma = null;
			forms = [];
			lemmaGrammemes = new Set<string>();
			return;
		}
		if (!inLemma) return;

		if (tag.name === "l") {
			const value = getTagTextAttribute(tag);
			if (value) lemma = value;
			insideLTag = true;
			return;
		}

		if (tag.name === "f") {
			const value = getTagTextAttribute(tag);
			if (value) forms.push(value);
			return;
		}

		if (tag.name === "g" && insideLTag) {
			const value = getTagValueAttribute(tag);
			if (value) lemmaGrammemes.add(value);
		}
	});

	parser.on("closetag", (tag: SaxesTag) => {
		if (tag.name === "l") {
			insideLTag = false;
			return;
		}
		if (tag.name !== "lemma") return;

		lemmasCount++;
		if (lemma) {
			pendingGroups.push({
				lemma,
				forms: [...forms],
				grammemes: new Set(lemmaGrammemes),
			});
		}

		inLemma = false;
		insideLTag = false;
		lemma = null;
		forms = [];
		lemmaGrammemes = new Set<string>();
	});

	const chunks = isAsyncIterable(xmlStream)
		? xmlStream
		: streamToAsyncIterable(xmlStream);
	for await (const chunk of chunks) {
		if (parseError) throw parseError;
		const asBuffer =
			typeof chunk === "string"
				? Buffer.from(chunk, "utf8")
				: Buffer.isBuffer(chunk)
					? chunk
					: chunk instanceof Uint8Array
						? Buffer.from(chunk)
						: Buffer.from(String(chunk), "utf8");
		parser.write(decoder.write(asBuffer));
		await flushPendingGroups();
	}

	parser.write(decoder.end());
	parser.close();
	await flushPendingGroups();

	if (parseError) throw parseError;

	return { lemmas: lemmasCount };
}

export async function parseOpenCorporaBz2Archive(
	archivePath: string,
	sink: PairSink,
): Promise<SourceParserStats> {
	const archiveStream = createReadStream(archivePath);
	const xmlStream = archiveStream.pipe(unbzip2Stream());
	return parseOpenCorporaXmlStream(xmlStream, sink);
}

export function createOpenCorporaSourceParser(
	options: OpenCorporaSourceOptions = {},
): SourceParser {
	return async (sink) => {
		const archivePath =
			options.archivePath ??
			path.join(options.cacheDir ?? DEFAULT_CACHE_DIR, DEFAULT_ARCHIVE_FILENAME);

		const shouldDownload =
			options.forceDownload || !(await fileExists(archivePath));
		if (shouldDownload) {
			await downloadOpenCorporaArchive({
				url: options.url ?? OPENCORPORA_DICT_BZ2_URL,
				targetPath: archivePath,
			});
		}

		return parseOpenCorporaBz2Archive(archivePath, sink);
	};
}

export async function parseOpenCorporaBz2LemmaGroups(
	archivePath: string,
	sink: LemmaGroupSink,
): Promise<LemmaGroupParserStats> {
	const archiveStream = createReadStream(archivePath);
	const xmlStream = archiveStream.pipe(unbzip2Stream());
	return parseOpenCorporaLemmaGroups(xmlStream, sink);
}

export function createOpenCorporaLemmaGroupParser(
	options: OpenCorporaSourceOptions = {},
): LemmaGroupSourceParser {
	return async (sink) => {
		const archivePath =
			options.archivePath ??
			path.join(options.cacheDir ?? DEFAULT_CACHE_DIR, DEFAULT_ARCHIVE_FILENAME);

		const shouldDownload =
			options.forceDownload || !(await fileExists(archivePath));
		if (shouldDownload) {
			await downloadOpenCorporaArchive({
				url: options.url ?? OPENCORPORA_DICT_BZ2_URL,
				targetPath: archivePath,
			});
		}

		return parseOpenCorporaBz2LemmaGroups(archivePath, sink);
	};
}
