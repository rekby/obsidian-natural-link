import fs from 'node:fs/promises';
import path from 'node:path';
import { browser } from '@wdio/globals';

/**
 * Run an in-app async call against a time budget and report how it ended.
 *
 * Why not just await it: an Obsidian API that hangs would otherwise burn the
 * whole mocha timeout (180s) before failing, and the failure would say
 * "timeout" without telling you which call hung. This returns one of
 * `"ok"` / `"error:<message>"` / `"timeout"`, all of which are assertable — and
 * "the plugin did not crash" is often exactly what an edge-case test wants.
 *
 * The race runs on the Node side, so a call that never settles leaves its
 * WebDriver command outstanding. That is fine for the "did it hang?" assertion
 * this helper exists for, but do not use it in a loop.
 *
 * @param {(ctx: object, arg: unknown) => Promise<unknown>} fn  Runs in the renderer.
 * @param {unknown} arg  Serializable argument passed to `fn`.
 * @param {number} budgetMs
 * @returns {Promise<'ok' | 'timeout' | `error:${string}`>}
 */
export async function runBounded(fn, arg, budgetMs = 1000) {
	let status = 'pending';

	const call = browser.executeObsidian(fn, arg).then(
		() => { if (status === 'pending') status = 'ok'; },
		(e) => { status = `error:${(e && e.message) || String(e)}`; },
	);
	const timeout = new Promise((resolve) => setTimeout(resolve, budgetMs));

	await Promise.race([call, timeout]);
	return status === 'pending' ? 'timeout' : status;
}

/**
 * Hardlink a fixture file inside the vault copy instead of duplicating it.
 *
 * Fixtures must be written into the service's temp copy of the vault (see
 * `obsidianPage.getVaultPath()`), not into the repo. Hardlinking keeps large
 * binary fixtures (video, images) from being copied once per test.
 */
export async function ensureHardlink(vaultRoot, sourceAbsPath, vaultRelPath) {
	const target = path.join(vaultRoot, vaultRelPath);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.rm(target, { force: true });
	await fs.link(sourceAbsPath, target);
}

export async function writeVaultNote(vaultRoot, vaultRelPath, content) {
	const target = path.join(vaultRoot, vaultRelPath);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.writeFile(target, content, 'utf8');
}
