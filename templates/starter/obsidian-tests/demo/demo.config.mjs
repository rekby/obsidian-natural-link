/**
 * Everything demo capture needs to know about *this* plugin.
 *
 * The capture machinery itself lives in `obsidian-tests/lib/` and is owned by
 * the template — keep plugin-specific selectors, ids and strings here so a
 * template sync never conflicts.
 */
export const PLUGIN_ID = '{{PLUGIN_ID}}';

/** Prefix for DOM ids the harness injects, to avoid clashing with the plugin. */
export const STYLE_ID = '{{PLUGIN_ID}}-demo-style';
export const OVERLAY_ID = '{{PLUGIN_ID}}-demo-key-overlay';

/** Locales to generate assets for. Output goes to docs/demo/<dir>/. */
export const LOCALES = [
	{ code: 'en', outDir: '.', vault: './obsidian-tests/demo-vault' },
	{ code: 'ru', outDir: 'ru', vault: './obsidian-tests/demo-vault-ru' },
];

/**
 * Settings pinned for every demo. Anything that affects rendering must be here,
 * otherwise a leftover value from a previous scenario changes the pixels.
 */
export const DEMO_SETTINGS = {
	greeting: 'Hello from {{PLUGIN_NAME}}',
};
