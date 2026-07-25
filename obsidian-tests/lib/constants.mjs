import path from 'node:path';

/** Element captured in screenshots. Never the OS desktop — that would include window chrome. */
export const APP_SELECTOR = '.app-container';

/** Target inner viewport for demo capture. PNGs and GIFs share this resolution. */
export const DEMO_VIEWPORT_WIDTH = 800;
export const DEMO_VIEWPORT_HEIGHT = 600;

/** Fixed width of the left sidebar (file explorer) so its layout cannot jitter. */
export const LEFT_SPLIT_WIDTH = 200;

/**
 * Vault name shown in demo screenshots, and the tmp directory the vault is
 * copied to. See `launcher-patch.mjs`.
 */
export const STABLE_VAULT_NAME = 'plugin-demo-vault';

/** Committed demo assets (PNG/GIF) and their checksum manifest. */
export const DEMO_OUTPUT_ROOT = path.resolve('docs/demo');
export const CHECKSUMS_FILE = path.join(DEMO_OUTPUT_ROOT, 'CHECKSUMS.txt');

/** Raw captured frames + per-scenario manifests. Gitignored. */
export const DEMO_ARTIFACTS_ROOT = path.resolve('obsidian-tests/demo-artifacts');

/** Human-ish pacing for demo scenarios. */
export const HUMAN_PAUSE_MS = 800;
export const HUMAN_KEY_DELAY_MS = 200;

/**
 * DOM locations where Obsidian renders the vault name: the vault switcher at the
 * bottom of the file explorer, and the root folder header at the top.
 */
export const VAULT_NAME_SELECTORS = [
	'.workspace-drawer-vault-name',
	'.nav-folder.mod-root > .nav-folder-title .nav-folder-title-content',
].join(', ');
