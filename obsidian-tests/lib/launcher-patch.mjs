/**
 * Force the service's vault copy to land on a stable path.
 *
 * `wdio-obsidian-service` copies the source vault into a tmpdir with a random
 * suffix (e.g. `demo-vault-0CQYIH`) and Obsidian shows that directory name as
 * the vault name. Patching the launcher means Obsidian renders the stable name
 * from the very first painted frame — no flash of a random name before the
 * specs get a chance to rewrite it in the DOM.
 *
 * Safe with maxInstances=1: each spec is one session, the service removes the
 * tmpDir on session end, and this wrapper recreates it for the next session.
 *
 * Must be called from the wdio config (module scope), before the session starts.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ObsidianLauncher from 'obsidian-launcher';
import { STABLE_VAULT_NAME } from './constants.mjs';

export function patchLauncherForStableVault(vaultName = STABLE_VAULT_NAME) {
	if (ObsidianLauncher.prototype.__demoSetupVaultPatched) return;

	const stableVaultDir = path.join(os.tmpdir(), vaultName);
	const origSetupVault = ObsidianLauncher.prototype.setupVault;

	ObsidianLauncher.prototype.setupVault = async function patchedSetupVault(params) {
		if (!params.copy) return origSetupVault.call(this, params);
		await fs.rm(stableVaultDir, { recursive: true, force: true });
		// preserveTimestamps keeps mtimes stable across runs too.
		await fs.cp(params.vault, stableVaultDir, { recursive: true, preserveTimestamps: true });
		return origSetupVault.call(this, { ...params, vault: stableVaultDir, copy: false });
	};

	ObsidianLauncher.prototype.__demoSetupVaultPatched = true;
}
