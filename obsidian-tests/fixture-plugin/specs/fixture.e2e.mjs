/* global describe, it, before */

/**
 * Functional e2e for the template's fixture plugin.
 *
 * Its job is to prove the harness works — plugin installation, command
 * registration, `runBounded`, vault access — so a breakage in
 * `obsidian-tests/lib/` fails here rather than in five downstream plugins.
 */
import assert from 'node:assert/strict';
import { browser } from '@wdio/globals';
import { runBounded, waitForPlugin } from '../../lib/index.mjs';

const PLUGIN_ID = 'template-fixture';

describe('template fixture plugin', () => {
	before(async () => {
		await waitForPlugin(PLUGIN_ID);
	});

	it('is installed and enabled', async () => {
		const loaded = await browser.executeObsidian(
			({ app }, id) => Boolean(app.plugins.plugins[id]),
			PLUGIN_ID,
		);
		assert.equal(loaded, true);
	});

	it('registers its command', async () => {
		const found = await browser.executeObsidian(
			({ app }, id) => Boolean(app.commands.findCommand(`${id}:say-hello`)),
			PLUGIN_ID,
		);
		assert.equal(found, true, 'command "say-hello" is not registered');
	});

	it('runs the command within its time budget and stays alive', async () => {
		const status = await runBounded(
			({ app }, id) => app.commands.executeCommandById(`${id}:say-hello`),
			PLUGIN_ID,
		);
		assert.equal(status, 'ok', `command did not complete cleanly: ${status}`);

		const greeting = await browser.executeObsidian(
			({ app }, id) => app.plugins.plugins[id].lastGreeting,
			PLUGIN_ID,
		);
		assert.equal(greeting, 'Hello, Obsidian!');
	});

	it('sees the fixture vault', async () => {
		const files = await browser.executeObsidian(
			({ app }) => app.vault.getMarkdownFiles().map((f) => f.path).sort(),
		);
		assert.deepEqual(files, ['Welcome.md']);
	});
});
