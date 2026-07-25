/**
 * Checksum manifest for committed demo assets.
 *
 * The point is reviewability: a "regenerate demos" commit that touches only
 * CHECKSUMS.txt lines you expect is trustworthy, while an unexpected hash change
 * means the pixels moved. Run as a CLI to verify without regenerating:
 *   node obsidian-tests/lib/checksums.mjs verify
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { CHECKSUMS_FILE, DEMO_OUTPUT_ROOT } from './constants.mjs';

export async function sha256OfFile(filePath) {
	const data = await fs.readFile(filePath);
	return crypto.createHash('sha256').update(data).digest('hex');
}

async function collectAssets(dir, out) {
	const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			await collectAssets(entryPath, out);
		} else if (entry.isFile() && entry.name !== path.basename(CHECKSUMS_FILE)) {
			out.push(entryPath);
		}
	}
}

/** `sha256sum`-compatible lines, sorted, with POSIX-relative paths. */
export async function computeChecksums() {
	const files = [];
	await collectAssets(DEMO_OUTPUT_ROOT, files);
	files.sort();

	const lines = [];
	for (const file of files) {
		const rel = path.relative(DEMO_OUTPUT_ROOT, file).split(path.sep).join('/');
		lines.push(`${await sha256OfFile(file)}  ${rel}`);
	}
	return lines;
}

export async function writeChecksumsFile() {
	const lines = await computeChecksums();
	await fs.mkdir(DEMO_OUTPUT_ROOT, { recursive: true });
	await fs.writeFile(CHECKSUMS_FILE, lines.join('\n') + '\n');
	return lines.length;
}

/** @returns {Promise<{ ok: boolean, differences: string[] }>} */
export async function verifyChecksums() {
	const expected = await fs.readFile(CHECKSUMS_FILE, 'utf8').catch(() => null);
	if (expected === null) {
		return { ok: false, differences: [`${CHECKSUMS_FILE} does not exist`] };
	}

	const actualLines = await computeChecksums();
	const expectedLines = expected.split('\n').filter(Boolean);

	const parse = (lines) => new Map(lines.map((line) => {
		const [hash, name] = line.split('  ');
		return [name, hash];
	}));
	const expectedMap = parse(expectedLines);
	const actualMap = parse(actualLines);

	const differences = [];
	for (const [name, hash] of expectedMap) {
		if (!actualMap.has(name)) differences.push(`missing: ${name}`);
		else if (actualMap.get(name) !== hash) differences.push(`changed: ${name}`);
	}
	for (const name of actualMap.keys()) {
		if (!expectedMap.has(name)) differences.push(`unexpected: ${name}`);
	}

	return { ok: differences.length === 0, differences };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const command = process.argv[2] ?? 'verify';
	if (command === 'write') {
		const count = await writeChecksumsFile();
		process.stdout.write(`wrote ${count} checksums to ${CHECKSUMS_FILE}\n`);
	} else {
		const { ok, differences } = await verifyChecksums();
		if (ok) {
			process.stdout.write('demo assets match CHECKSUMS.txt\n');
		} else {
			process.stderr.write(`demo assets differ from CHECKSUMS.txt:\n  ${differences.join('\n  ')}\n`);
			process.exitCode = 1;
		}
	}
}
