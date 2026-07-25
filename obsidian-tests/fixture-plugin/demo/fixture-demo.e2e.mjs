/* global describe, it, before */

/**
 * Demo capture for the fixture plugin — the template's own proof that the
 * determinism pipeline produces identical bytes on re-run.
 *
 * It doubles as the worked example a plugin's own demo specs should follow:
 * freeze the environment, open a known file, assert the state you intend to
 * show, then capture.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { browser } from '@wdio/globals';
import { obsidianPage } from 'wdio-obsidian-service';
import {
	DEMO_OUTPUT_ROOT,
	DemoRecorder,
	HUMAN_PAUSE_MS,
	captureKeyPress,
	configureDemoEnvironment,
	normalizeEditorState,
	saveAppScreenshot,
	waitForPlugin,
} from '../../lib/index.mjs';

const PLUGIN_ID = 'template-fixture';
const START_FILE = 'Welcome.md';

async function openStartFile() {
	await obsidianPage.openFile(START_FILE);
	await normalizeEditorState();
}

describe('fixture demo assets', () => {
	before(async () => {
		await waitForPlugin(PLUGIN_ID);
		await configureDemoEnvironment({
			pluginId: PLUGIN_ID,
			locale: 'en',
			styleId: `${PLUGIN_ID}-demo-style`,
		});
	});

	it('captures the README screenshot', async () => {
		await openStartFile();

		// Assert the state before capturing: a screenshot taken mid-transition is
		// the classic source of "identical run, different bytes".
		const activePath = await browser.executeObsidian(
			({ app }) => app.workspace.getActiveFile()?.path,
		);
		assert.equal(activePath, START_FILE);

		await saveAppScreenshot(path.join(DEMO_OUTPUT_ROOT, 'welcome.png'));
	});

	it('records a short GIF', async () => {
		await openStartFile();

		const recorder = new DemoRecorder('welcome');
		await recorder.init();

		await recorder.capture(HUMAN_PAUSE_MS);
		await captureKeyPress(recorder, 'Ctrl+P', HUMAN_PAUSE_MS, {
			overlayId: `${PLUGIN_ID}-demo-key-overlay`,
		});
		await recorder.capture(HUMAN_PAUSE_MS);

		await recorder.finalize({ locale: 'en' });
	});
});
