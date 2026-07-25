import fs from 'node:fs/promises';
import path from 'node:path';
import { browser } from '@wdio/globals';
import { VAULT_NAME_SELECTORS } from './constants.mjs';

/** Read every top-level `.md` file of a vault directory into `{ path: content }`. */
export async function readVaultDir(vaultPath) {
	const resolved = path.resolve(vaultPath);
	const entries = await fs.readdir(resolved);
	const snapshot = {};
	for (const entry of entries) {
		if (!entry.endsWith('.md')) continue;
		snapshot[entry] = await fs.readFile(path.join(resolved, entry), 'utf-8');
	}
	return snapshot;
}

/**
 * Reconcile the live vault with an on-disk snapshot: delete unknown notes,
 * rewrite changed ones, create missing ones. Returns whether anything changed.
 *
 * Used instead of restarting Obsidian between scenarios — a restart costs ~10s
 * per scenario and is not needed once file contents are back to a known state.
 */
export async function syncVaultFiles(snapshot) {
	return browser.executeObsidian(async ({ app, obsidian }, files) => {
		let changed = false;
		const knownPaths = new Set(Object.keys(files));

		for (const file of app.vault.getMarkdownFiles()) {
			if (!knownPaths.has(file.path)) {
				await app.vault.delete(file);
				changed = true;
			}
		}

		for (const [filePath, content] of Object.entries(files)) {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof obsidian.TFile) {
				const current = await app.vault.read(file);
				if (current !== content) {
					await app.vault.modify(file, content);
					changed = true;
				}
			} else {
				await app.vault.create(filePath, content);
				changed = true;
			}
		}
		return changed;
	}, snapshot);
}

/**
 * Wait for the metadata cache to settle after vault edits, capped so a vault
 * that never fires `resolved` cannot hang the suite.
 */
export async function waitForMetadataResolved(timeoutMs = 2000) {
	await browser.executeObsidian(({ app }, timeout) =>
		new Promise((resolve) => {
			if (!app.metadataCache.initialized) {
				resolve();
				return;
			}
			const ref = app.metadataCache.on('resolved', () => {
				app.metadataCache.offref(ref);
				resolve();
			});
			setTimeout(() => {
				app.metadataCache.offref(ref);
				resolve();
			}, timeout);
		}),
	timeoutMs);
}

/**
 * Replace every on-screen rendering of the vault name with a stable string.
 *
 * Patches `app.vault.getName` so future re-renders use the stable name, then
 * overwrites the DOM in case Obsidian already rendered the original. The
 * launcher patch makes the directory name stable too — this is the belt to its
 * braces, and also covers the case where the patch is not installed.
 */
export async function stabilizeVaultName(name) {
	await browser.executeObsidian(({ app }, payload) => {
		const vault = app.vault;
		if (!vault.__demoOriginalGetName) {
			vault.__demoOriginalGetName = vault.getName.bind(vault);
		}
		vault.getName = () => payload.name;
		document.querySelectorAll(payload.selectors).forEach((el) => {
			el.textContent = payload.name;
		});
	}, { name, selectors: VAULT_NAME_SELECTORS });
}
