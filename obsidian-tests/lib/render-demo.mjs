/**
 * Turn captured frames into committed demo assets, byte-reproducibly.
 *
 * Pipeline: frame manifests -> ffmpeg concat -> GIF -> oxipng over the PNGs ->
 * self-check -> CHECKSUMS.txt.
 *
 * Determinism relies on:
 *  - pinned binaries from npm (ffmpeg-static, oxipng-bin) rather than whatever
 *    is on PATH, since encoder versions change output;
 *  - `-fflags/-flags:v +bitexact`, which strips ffmpeg's version and encoder
 *    metadata from the container;
 *  - ordered `dither=bayer` instead of the default error-diffusion dither,
 *    which is stateful;
 *  - no scale filter, so no dependency on the swscale build;
 *  - `oxipng --strip all`, which removes tIME/iCCP/tEXt chunks the browser
 *    embeds, and `--threads 1`, because parallel deflate block splitting is not
 *    guaranteed to be reproducible.
 *
 * `DEMO_VERIFY=0` skips the self-check while iterating locally.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { DEMO_ARTIFACTS_ROOT, DEMO_OUTPUT_ROOT } from './constants.mjs';
import { sha256OfFile, writeChecksumsFile } from './checksums.mjs';

const require = createRequire(import.meta.url);

const FFMPEG_BIN = process.env.FFMPEG_BIN ?? require('ffmpeg-static');
const OXIPNG_BIN = process.env.OXIPNG_BIN ?? require('oxipng-bin').default;
const SKIP_VERIFY = process.env.DEMO_VERIFY === '0';

async function main() {
	await ensureBinary(FFMPEG_BIN, ['-version'],
		'ffmpeg is required to render demo GIFs. Set FFMPEG_BIN to override the bundled binary.');
	await ensureBinary(OXIPNG_BIN, ['--version'],
		'oxipng is required to strip non-pixel metadata from PNGs. Set OXIPNG_BIN to override.');

	const manifests = await findManifests(DEMO_ARTIFACTS_ROOT);
	const rendered = [];
	for (const manifestPath of manifests) {
		const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
		const outputPath = path.resolve(manifest.output);
		await renderManifest(manifestPath, manifest, outputPath);
		rendered.push({ manifestPath, manifest, outputPath });
	}
	if (rendered.length > 0) {
		process.stdout.write(`rendered ${rendered.length} GIF(s)\n`);
	}

	await optimizePngs(DEMO_OUTPUT_ROOT);

	if (!SKIP_VERIFY) {
		await selfCheckGifDeterminism(rendered);
	}

	const count = await writeChecksumsFile();
	process.stdout.write(`wrote ${count} checksum(s)\n`);
}

/**
 * Re-render each GIF from the same frames into a tmpfile and compare sha256.
 * Catches non-determinism in the encoder itself — e.g. an ffmpeg-static bump
 * that quietly drops bit-exact output.
 *
 * Note this proves same-machine reproducibility only.
 */
async function selfCheckGifDeterminism(rendered) {
	if (rendered.length === 0) return;

	const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-verify-'));
	try {
		for (const { manifestPath, manifest, outputPath } of rendered) {
			const originalHash = await sha256OfFile(outputPath);
			const tmpOutput = path.join(tmpRoot, path.basename(outputPath));
			await renderManifest(manifestPath, manifest, tmpOutput);
			const reRenderedHash = await sha256OfFile(tmpOutput);
			if (originalHash !== reRenderedHash) {
				throw new Error(
					`GIF re-render produced different bytes for ${outputPath}\n`
					+ `  original=${originalHash}\n`
					+ `  re-render=${reRenderedHash}`,
				);
			}
		}
	} finally {
		await fs.rm(tmpRoot, { recursive: true, force: true });
	}
}

async function optimizePngs(rootDir) {
	const pngs = [];
	await collectPngs(rootDir, pngs);
	if (pngs.length === 0) return;

	await runCommand(OXIPNG_BIN, [
		'--opt', 'max',
		'--strip', 'all',
		'--alpha',
		'--quiet',
		'--threads', '1',
		...pngs,
	], `oxipng failed while optimizing PNGs in ${rootDir}`);
	process.stdout.write(`optimized ${pngs.length} PNG(s)\n`);
}

async function collectPngs(dir, out) {
	const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isDirectory()) await collectPngs(entryPath, out);
		else if (entry.isFile() && entry.name.endsWith('.png')) out.push(entryPath);
	}
}

async function renderManifest(manifestPath, manifest, outputPath) {
	if (!Array.isArray(manifest.frames) || manifest.frames.length === 0) {
		throw new Error(`Manifest ${manifestPath} does not contain frames.`);
	}
	if (typeof manifest.output !== 'string' || manifest.output.length === 0) {
		throw new Error(`Manifest ${manifestPath} does not define an output path.`);
	}

	const manifestDir = path.dirname(manifestPath);
	await fs.mkdir(path.dirname(outputPath), { recursive: true });

	const concatPath = path.join(manifestDir, 'ffmpeg-input.txt');
	await fs.writeFile(concatPath, buildConcatFile(manifestDir, manifest.frames));

	// No scaling: GIFs are produced at the frames' source size, so PNGs and GIFs
	// share one resolution and no resampler is involved.
	const filter =
		'fps=12,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5';

	await runCommand(FFMPEG_BIN, [
		'-y',
		'-nostdin',
		'-hide_banner',
		'-loglevel', 'error',
		'-fflags', '+bitexact',
		'-flags:v', '+bitexact',
		'-f', 'concat',
		'-safe', '0',
		'-i', concatPath,
		'-filter_complex', filter,
		outputPath,
	], `ffmpeg failed while rendering ${outputPath}`);
}

function buildConcatFile(manifestDir, frames) {
	const lines = [];
	for (const frame of frames) {
		lines.push(`file '${escapeForConcat(path.join(manifestDir, frame.file))}'`);
		lines.push(`duration ${(frame.durationMs / 1000).toFixed(3)}`);
	}
	// The concat demuxer ignores the last entry's duration unless the frame is
	// repeated, which would otherwise cut the final beat short.
	lines.push(`file '${escapeForConcat(path.join(manifestDir, frames.at(-1).file))}'`);
	return `${lines.join('\n')}\n`;
}

function escapeForConcat(value) {
	return value.replace(/'/g, "'\\''");
}

async function findManifests(rootDir) {
	const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
	const manifests = [];
	for (const entry of entries) {
		const entryPath = path.join(rootDir, entry.name);
		if (entry.isDirectory()) manifests.push(...await findManifests(entryPath));
		else if (entry.isFile() && entry.name === 'manifest.json') manifests.push(entryPath);
	}
	return manifests.sort();
}

async function ensureBinary(command, args, friendlyError) {
	await runCommand(command, args, friendlyError);
}

async function runCommand(command, args, friendlyError) {
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: 'ignore' });
		child.on('error', (error) => reject(new Error(`${friendlyError}\n${error.message}`)));
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${friendlyError} (exit code ${code ?? 'unknown'})`));
		});
	});
}

main().catch((error) => {
	process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
	process.exitCode = 1;
});
