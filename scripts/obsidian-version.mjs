/**
 * Shared resolution of "which plugin do we test, and against which Obsidian".
 *
 * The template itself has no root manifest.json (that file is plugin-owned), so
 * it falls back to the bundled fixture plugin. In a real plugin the root
 * manifest wins and the fixture is never looked at.
 *
 * Also usable as a CLI so CI can key its Obsidian cache on the resolved version:
 *   node scripts/obsidian-version.mjs app        -> e.g. 1.5.8
 *   node scripts/obsidian-version.mjs installer  -> e.g. 1.5.8
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIXTURE_PLUGIN = 'obsidian-tests/fixture-plugin';

/** Repo-relative dir holding the manifest.json of the plugin under test. */
export function resolvePluginRoot() {
	return fs.existsSync(path.join(repoRoot, 'manifest.json')) ? '.' : FIXTURE_PLUGIN;
}

export function readManifest() {
	const manifestPath = path.join(repoRoot, resolvePluginRoot(), 'manifest.json');
	return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

/**
 * Which Obsidian to test against.
 *
 * Defaults to "latest", because that is what users actually run and what an e2e
 * suite should catch regressions on. Pinning to `manifest.minAppVersion` sounds
 * appealing for reproducibility but is impractical: a plugin that still claims
 * `0.15.0` would download a years-old build nobody uses.
 *
 * Demo assets stay byte-identical within one Obsidian version. If you need them
 * stable across Obsidian releases too, pin the version explicitly:
 *
 *   OBSIDIAN_TEST_VERSION=1.12.4 OBSIDIAN_INSTALLER_VERSION=1.12.4 npm run demo
 *
 * An Obsidian upgrade then shows up as a deliberate CHECKSUMS.txt change rather
 * than as silent drift.
 */
export function resolveObsidianVersions() {
	return {
		obsidianVersion: process.env.OBSIDIAN_TEST_VERSION ?? 'latest',
		installerVersion: process.env.OBSIDIAN_INSTALLER_VERSION ?? 'latest',
	};
}

/**
 * First existing candidate, repo-relative. Lets the template fall back to its
 * fixture while real plugins use their own paths — and, importantly, stops the
 * fixture's specs and demos from also running inside every plugin.
 */
export function resolveVault(...candidates) {
	for (const candidate of candidates) {
		if (fs.existsSync(path.join(repoRoot, candidate))) return candidate;
	}
	return candidates.at(-1);
}

/** Same idea for spec globs: the plugin's own directory wins when it exists. */
export function resolveSpecs(pluginDir, pluginGlob, fixtureGlob) {
	return fs.existsSync(path.join(repoRoot, pluginDir)) ? [pluginGlob] : [fixtureGlob];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const versions = resolveObsidianVersions();
	const which = process.argv[2] ?? 'app';
	process.stdout.write(
		(which === 'installer' ? versions.installerVersion : versions.obsidianVersion) + '\n',
	);
}
