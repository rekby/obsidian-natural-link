import { createReadStream } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import tar from "tar-stream";
import { type PairSink, type SourceParser, type SourceParserStats } from "./types";

export const WORDNET_DICT_TAR_GZ_URL = "https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz";

const DEFAULT_CACHE_DIR = ".cache/dictionaries/wordnet";
const DEFAULT_ARCHIVE_FILENAME = "wn3.1.dict.tar.gz";
const EXCEPTION_FILE_NAMES = new Set(["adj.exc", "adv.exc", "noun.exc", "verb.exc"]);

type DownloadOptions = {
	url?: string;
	targetPath: string;
};

type WordNetSourceOptions = {
	archivePath?: string;
	cacheDir?: string;
	forceDownload?: boolean;
	url?: string;
};

function toError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}
	if (typeof error === "string") {
		return new Error(error);
	}
	return new Error("Unknown parsing error");
}

function isWordNetExceptionFile(entryName: string): boolean {
	const normalized = entryName.replace(/\\/g, "/");
	const fileName = path.posix.basename(normalized);
	return EXCEPTION_FILE_NAMES.has(fileName);
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function downloadWordNetArchive({
	url = WORDNET_DICT_TAR_GZ_URL,
	targetPath,
}: DownloadOptions): Promise<string> {
	await mkdir(path.dirname(targetPath), { recursive: true });

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`WordNet download failed: ${response.status} ${response.statusText}`);
	}
	if (!response.body) {
		throw new Error("WordNet download failed: response has no body");
	}

	const data = await response.arrayBuffer();
	await writeFile(targetPath, Buffer.from(data));
	return targetPath;
}

async function parseWordNetExceptionText(
	content: string,
	sink: PairSink,
): Promise<SourceParserStats> {
	let lemmas = 0;
	let pairs = 0;

	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		const columns = trimmed.split(/\s+/);
		if (columns.length < 2) {
			continue;
		}

		const [rawForm, ...rawCanonicals] = columns;
		if (!rawForm) {
			continue;
		}

		lemmas++;
		if (rawForm.includes("_")) {
			continue;
		}

		for (const rawCanonical of rawCanonicals) {
			if (!rawCanonical || rawCanonical.includes("_")) {
				continue;
			}
			await sink([rawForm, rawCanonical]);
			pairs++;
		}
	}

	return { lemmas, pairs };
}

export async function parseWordNetExcFiles(
	archivePath: string,
	sink: PairSink,
): Promise<SourceParserStats> {
	const extract = tar.extract();
	const archiveStream = createReadStream(archivePath);
	const gunzip = createGunzip();

	let parsedLemmas = 0;
	let parsedPairs = 0;
	let settled = false;
	let pending = Promise.resolve();

	return new Promise<SourceParserStats>((resolve, reject) => {
		const rejectOnce = (error: unknown): void => {
			if (settled) {
				return;
			}
			settled = true;
			reject(toError(error));
		};

		const resolveOnce = (): void => {
			if (settled) {
				return;
			}
			settled = true;
			resolve({ lemmas: parsedLemmas, pairs: parsedPairs });
		};

		archiveStream.on("error", rejectOnce);
		gunzip.on("error", rejectOnce);
		extract.on("error", rejectOnce);

		extract.on("entry", (header, entryStream, next) => {
			const entryName = header.name ?? "";
			if (!isWordNetExceptionFile(entryName)) {
				entryStream.resume();
				entryStream.once("end", next);
				return;
			}

			const chunks: Buffer[] = [];
			entryStream.on("data", (chunk: Buffer | string) => {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			});
			entryStream.once("error", rejectOnce);
			entryStream.once("end", () => {
				const content = Buffer.concat(chunks).toString("utf8");
				pending = pending
					.then(async () => {
						const stats = await parseWordNetExceptionText(content, sink);
						parsedLemmas += stats.lemmas;
						parsedPairs += stats.pairs;
					})
					.then(() => next());
				pending.catch(rejectOnce);
			});
		});

		extract.once("finish", () => {
			pending.then(resolveOnce).catch(rejectOnce);
		});

		archiveStream.pipe(gunzip).pipe(extract);
	});
}

export function createWordNetSourceParser(options: WordNetSourceOptions = {}): SourceParser {
	return async (sink) => {
		const archivePath =
			options.archivePath ??
			path.join(options.cacheDir ?? DEFAULT_CACHE_DIR, DEFAULT_ARCHIVE_FILENAME);

		const shouldDownload = options.forceDownload || !(await fileExists(archivePath));
		if (shouldDownload) {
			await downloadWordNetArchive({
				url: options.url ?? WORDNET_DICT_TAR_GZ_URL,
				targetPath: archivePath,
			});
		}

		return parseWordNetExcFiles(archivePath, sink);
	};
}
