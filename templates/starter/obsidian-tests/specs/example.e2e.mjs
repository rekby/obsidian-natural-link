/* global describe, it, before */

/**
 * Functional e2e smoke test: the plugin loads and its command runs.
 *
 * Extend this file (or add siblings) with the edge cases that actually break:
 * duplicate file names, malformed links, several views open at once. Use
 * `runBounded` for anything that might hang.
 */
import assert from 'node:assert/strict';
import { browser } from '@wdio/globals';
import { PLUGIN_ID } from '../demo/demo.config.mjs';
import { runBounded, waitForPlugin } from '../lib/index.mjs';

describe('{{PLUGIN_NAME}}', () => {
	before(async () => {
		await waitForPlugin(PLUGIN_ID);
	});

	it('registers its command', async () => {
		const found = await browser.executeObsidian(
			({ app }, id) => Boolean(app.commands.findCommand(`${id}:say-hello`)),
			PLUGIN_ID,
		);
		assert.equal(found, true, 'command "say-hello" is not registered');
	});

	it('runs the command without hanging or crashing', async () => {
		const status = await runBounded(
			({ app }, id) => app.commands.executeCommandById(`${id}:say-hello`),
			PLUGIN_ID,
		);
		assert.equal(status, 'ok', `command did not complete cleanly: ${status}`);

		const alive = await browser.executeObsidian(
			({ app }, id) => Boolean(app.plugins.plugins[id]),
			PLUGIN_ID,
		);
		assert.equal(alive, true, 'plugin died while running the command');
	});
});
