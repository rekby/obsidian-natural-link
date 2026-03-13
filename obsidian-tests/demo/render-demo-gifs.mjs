import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const ARTIFACTS_ROOT = path.resolve("obsidian-tests/demo-artifacts");
const FFMPEG_BIN = process.env.FFMPEG_BIN ?? "ffmpeg";

async function main() {
	await ensureFfmpeg();
	const manifests = await findManifests(ARTIFACTS_ROOT);
	if (manifests.length === 0) {
		throw new Error(
			"No demo manifests found in obsidian-tests/demo-artifacts. Run `npm run demo:capture` first.",
		);
	}

	for (const manifestPath of manifests) {
		const raw = await fs.readFile(manifestPath, "utf8");
		const manifest = JSON.parse(raw);
		await renderManifest(manifestPath, manifest);
	}
}

async function ensureFfmpeg() {
	await runCommand(FFMPEG_BIN, ["-version"], {
		friendlyError:
			`ffmpeg is required to render demo GIFs. Install ffmpeg or set FFMPEG_BIN to a valid executable path.`,
	});
}

async function renderManifest(manifestPath, manifest) {
	if (!Array.isArray(manifest.frames) || manifest.frames.length === 0) {
		throw new Error(`Manifest ${manifestPath} does not contain frames.`);
	}
	if (typeof manifest.output !== "string" || manifest.output.length === 0) {
		throw new Error(`Manifest ${manifestPath} does not define an output path.`);
	}

	const manifestDir = path.dirname(manifestPath);
	const outputPath = path.resolve(manifest.output);
	await fs.mkdir(path.dirname(outputPath), { recursive: true });

	const concatPath = path.join(manifestDir, "ffmpeg-input.txt");
	const concatContent = buildConcatFile(manifestDir, manifest.frames);
	await fs.writeFile(concatPath, concatContent);

	const filter =
		"fps=12,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5";

	await runCommand(FFMPEG_BIN, [
		"-y",
		"-f",
		"concat",
		"-safe",
		"0",
		"-i",
		concatPath,
		"-filter_complex",
		filter,
		outputPath,
	], {
		friendlyError: `ffmpeg failed while rendering ${outputPath}`,
	});
}

function buildConcatFile(manifestDir, frames) {
	const lines = [];
	for (const frame of frames) {
		const framePath = path.join(manifestDir, frame.file);
		lines.push(`file '${escapeForConcat(framePath)}'`);
		lines.push(`duration ${(frame.durationMs / 1000).toFixed(3)}`);
	}

	const lastFramePath = path.join(manifestDir, frames.at(-1).file);
	lines.push(`file '${escapeForConcat(lastFramePath)}'`);
	return `${lines.join("\n")}\n`;
}

function escapeForConcat(value) {
	return value.replace(/'/g, "'\\''");
}

async function findManifests(rootDir) {
	const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => []);
	const manifests = [];

	for (const entry of entries) {
		const entryPath = path.join(rootDir, entry.name);
		if (entry.isDirectory()) {
			manifests.push(...await findManifests(entryPath));
		} else if (entry.isFile() && entry.name === "manifest.json") {
			manifests.push(entryPath);
		}
	}

	return manifests.sort();
}

async function runCommand(command, args, { friendlyError }) {
	await new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: "ignore" });
		child.on("error", (error) => {
			reject(new Error(`${friendlyError}\n${error.message}`));
		});
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${friendlyError} (exit code ${code ?? "unknown"})`));
		});
	});
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
