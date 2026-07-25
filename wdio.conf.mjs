/**
 * Functional end-to-end tests against a real Obsidian desktop app.
 *
 * Kept separate from `wdio.demo.conf.mjs`: this config optimizes for catching
 * regressions (fast timeouts, no visual freezing), the demo one optimizes for
 * byte-reproducible screenshots.
 */
import path from 'node:path';
import { resolveObsidianVersions, resolvePluginRoot, resolveVault } from './scripts/obsidian-version.mjs';

const cacheDir = path.resolve('.obsidian-cache');
const { obsidianVersion, installerVersion } = resolveObsidianVersions();

export const config = {
	runner: 'local',
	framework: 'mocha',
	specs: ['./obsidian-tests/specs/**/*.e2e.mjs'],
	maxInstances: 1,
	capabilities: [
		{
			browserName: 'obsidian',
			browserVersion: obsidianVersion,
			'wdio:obsidianOptions': {
				installerVersion,
				plugins: [resolvePluginRoot()],
				vault: resolveVault('./obsidian-tests/vault', './obsidian-tests/fixture-plugin/vault'),
			},
		},
	],
	services: ['obsidian'],
	reporters: ['obsidian'],
	mochaOpts: {
		ui: 'bdd',
		timeout: 180000,
	},
	// Tight polling: functional specs assert on state that should already be
	// there, so a slow timeout only delays the failure report.
	waitforInterval: 100,
	waitforTimeout: 1000,
	logLevel: 'info',
	injectGlobals: false,
	cacheDir,
};
