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
 * Pin Obsidian to the oldest version the plugin claims to support. A floating
 * "latest" would change rendering — and therefore screenshot bytes — whenever
 * Obsidian ships a release.
 */
export function resolveObsidianVersions() {
	const { minAppVersion } = readManifest();
	return {
		obsidianVersion: process.env.OBSIDIAN_TEST_VERSION ?? minAppVersion,
		installerVersion: process.env.OBSIDIAN_INSTALLER_VERSION ?? minAppVersion,
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
