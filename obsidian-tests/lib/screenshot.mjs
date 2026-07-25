import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { $, browser } from '@wdio/globals';
import { APP_SELECTOR, DEMO_ARTIFACTS_ROOT, DEMO_OUTPUT_ROOT } from './constants.mjs';
import { prepareForScreenshot } from './editor.mjs';

/** Capture `.app-container` to a PNG. Element-scoped, so no OS window chrome. */
export async function saveAppScreenshot(outputPath, selector = APP_SELECTOR) {
	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	const target = await $(selector);
	await target.waitForDisplayed();
	await prepareForScreenshot();
	await target.saveScreenshot(outputPath);
}

/**
 * Records GIF frames plus a manifest describing how long each frame should be
 * shown.
 *
 * The key idea: playback timing lives in the manifest, not in wall-clock capture
 * time. Frames are captured at semantically meaningful moments and each carries
 * its own duration, so a slow machine produces exactly the same GIF as a fast
 * one.
 */
export class DemoRecorder {
	/**
	 * @param {string} scenarioName  Also the output filename and artifact dir name.
	 * @param {{ outputRoot?: string, artifactsRoot?: string }} [options]
	 */
	constructor(scenarioName, options = {}) {
		const outputRoot = options.outputRoot ?? DEMO_OUTPUT_ROOT;
		const artifactsRoot = options.artifactsRoot ?? DEMO_ARTIFACTS_ROOT;

		this.scenarioName = scenarioName;
		this.frames = [];
		this.frameIndex = 0;
		this.outputPath = path.join(outputRoot, `${scenarioName}.gif`);
		this.scenarioDir = path.join(artifactsRoot, scenarioName);
	}

	/** Start from a clean artifact dir so stale frames cannot leak into a render. */
	async init() {
		await fs.rm(this.scenarioDir, { recursive: true, force: true });
		await fs.mkdir(this.scenarioDir, { recursive: true });
	}

	async capture(durationMs, selector = APP_SELECTOR) {
		const target = await $(selector);
		await target.waitForDisplayed();
		await prepareForScreenshot();

		// Zero-padded so lexical order equals temporal order.
		const filename = `${String(this.frameIndex).padStart(4, '0')}.png`;
		await target.saveScreenshot(path.join(this.scenarioDir, filename));

		this.frames.push({ file: filename, durationMs });
		this.frameIndex += 1;
	}

	/** Capture, then let the app advance for the same duration. */
	async captureAndPause(durationMs, selector = APP_SELECTOR) {
		await this.capture(durationMs, selector);
		await browser.pause(durationMs);
	}

	async finalize(extra = {}) {
		assert.ok(this.frames.length > 0, 'demo recorder must capture at least one frame');

		const manifest = {
			scenario: this.scenarioName,
			output: path.relative(process.cwd(), this.outputPath),
			frames: this.frames,
			...extra,
		};
		await fs.writeFile(
			path.join(this.scenarioDir, 'manifest.json'),
			JSON.stringify(manifest, null, '\t'),
		);
	}
}
