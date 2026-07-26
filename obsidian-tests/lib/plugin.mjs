import { browser } from '@wdio/globals';

/**
 * Wait until the plugin under test is loaded and enabled.
 *
 * The service enables the plugin during startup, but Obsidian loads plugins
 * asynchronously — specs that touch plugin state before this resolves are flaky.
 */
export async function waitForPlugin(pluginId, timeout = 30000) {
	await browser.waitUntil(
		async () => browser.executeObsidian(
			({ app }, id) => Boolean(app.plugins?.plugins?.[id]),
			pluginId,
		),
		{ timeout, timeoutMsg: `Plugin "${pluginId}" did not load in time` },
	);
}

/**
 * Overwrite plugin settings and persist them.
 *
 * Demos must pin every setting that affects rendering — a setting left at
 * whatever the previous scenario set produces different pixels on re-run.
 * Requires the plugin to expose `settings` and `saveSettings()`, which is the
 * convention in `templates/starter/src/main.ts`.
 */
export async function setPluginSettings(pluginId, patch) {
	await browser.executeObsidian(async ({ app }, { id, values }) => {
		const plugin = app.plugins?.plugins?.[id];
		if (!plugin) throw new Error(`Plugin "${id}" is not loaded`);
		Object.assign(plugin.settings, values);
		await plugin.saveSettings();
	}, { id: pluginId, values: patch });
}
