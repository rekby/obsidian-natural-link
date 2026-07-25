/**
 * Demo capture: README screenshots and GIF frames, byte-reproducible.
 *
 * Separate from `wdio.conf.mjs` because everything here trades speed for
 * determinism — pinned Obsidian version, fixed rendering flags, stable vault
 * path. See `agents/template/demo-workflow.md` for the full methodology.
 */
import path from 'node:path';
import { DETERMINISTIC_CHROME_OPTIONS } from './obsidian-tests/lib/chrome-options.mjs';
import { patchLauncherForStableVault } from './obsidian-tests/lib/launcher-patch.mjs';
import {
	resolveObsidianVersions,
	resolvePluginRoot,
	resolveSpecs,
	resolveVault,
} from './scripts/obsidian-version.mjs';

patchLauncherForStableVault();

const cacheDir = path.resolve('.obsidian-cache');
const { obsidianVersion, installerVersion } = resolveObsidianVersions();

export const config = {
	runner: 'local',
	framework: 'mocha',
	specs: resolveSpecs(
		'obsidian-tests/demo',
		'./obsidian-tests/demo/**/*.e2e.mjs',
		'./obsidian-tests/fixture-plugin/demo/**/*.e2e.mjs',
	),
	maxInstances: 1,
	capabilities: [
		{
			browserName: 'obsidian',
			browserVersion: obsidianVersion,
			'wdio:obsidianOptions': {
				installerVersion,
				plugins: [resolvePluginRoot()],
				// Plugins name their demo vault differently; the first one that
				// exists wins. Multi-locale suites usually override the vault
				// per spec via `browser.reloadObsidian({ vault })` anyway.
				vault: resolveVault(
					'./obsidian-tests/demo-vault',
					'./obsidian-tests/demo-vaults/en',
					'./obsidian-tests/fixture-plugin/vault',
				),
			},
			'goog:chromeOptions': DETERMINISTIC_CHROME_OPTIONS,
		},
	],
	services: ['obsidian'],
	reporters: ['obsidian'],
	mochaOpts: {
		ui: 'bdd',
		timeout: 180000,
	},
	waitforInterval: 50,
	waitforTimeout: 1000,
	logLevel: 'info',
	injectGlobals: false,
	cacheDir,
};
