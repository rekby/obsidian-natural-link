import { $, $$, browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

export const COMMAND_ID = "natural-link:insert-link";
export const INPUT_SELECTOR = ".modal-container .prompt-input";
export const SELECTED_SUGGESTION_SELECTOR = ".suggestion-item.is-selected";
export const SUGGESTION_ITEM_SELECTOR = ".suggestion-item";
export const SCRATCH_FILE = "Scratch.md";
export const TEST_VAULT = "./obsidian-tests/vault";

/**
 * Map of filePath → original content, captured once in initVaultSnapshot().
 * Used by resetVault() to restore every file to its pristine state.
 */
let vaultSnapshot = null;

export async function waitForPlugin() {
	await browser.waitUntil(
		async () =>
			browser.executeObsidian(
				({ plugins }) => Boolean(plugins.naturalLink),
			),
		{
			timeout: 30000,
			timeoutMsg: "Natural link plugin did not load in time",
		},
	);
}

export async function updatePluginSettings(settings) {
	await browser.executeObsidian(
		async ({ plugins }, nextSettings) => {
			const plugin = plugins.naturalLink;
			if (!plugin) {
				throw new Error("Natural link plugin is not available");
			}

			Object.assign(plugin.settings, nextSettings);
			await plugin.saveSettings();
		},
		settings,
	);
}

export async function getPluginSetting(key) {
	return browser.executeObsidian(
		({ plugins }, settingKey) => {
			const plugin = plugins.naturalLink;
			if (!plugin) {
				throw new Error("Natural link plugin is not available");
			}
			return plugin.settings[settingKey];
		},
		key,
	);
}

export async function openScratchFile() {
	await obsidianPage.openFile(SCRATCH_FILE);
	await browser.waitUntil(
		async () => (await getEditorText()) !== null,
		{
			timeoutMsg: "Editor did not become available",
		},
	);
	await setEditorText("");
}

export async function readFile(filePath) {
	return browser.executeObsidian(
		async ({ app, obsidian }, path) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof obsidian.TFile)) {
				throw new Error(`No file ${path} exists`);
			}
			return app.vault.read(file);
		},
		filePath,
	);
}

export async function restoreFile(filePath, content) {
	await browser.executeObsidian(
		async ({ app, obsidian }, path, data) => {
			const file = app.vault.getAbstractFileByPath(path);
			if (!(file instanceof obsidian.TFile)) {
				throw new Error(`No file ${path} exists`);
			}
			await app.vault.modify(file, data);
		},
		filePath,
		content,
	);
}

export async function resetToScratchFile() {
	await browser.executeObsidian(
		async ({ app, obsidian }, filePath) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof obsidian.TFile)) {
				throw new Error(`No file ${filePath} exists`);
			}
			await app.vault.modify(file, "");
			const leaf =
				app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf();
			await leaf.openFile(file);
		},
		SCRATCH_FILE,
	);
	await browser.waitUntil(
		async () => (await getEditorText()) === "",
		{
			timeoutMsg: "Editor was not cleared to empty",
		},
	);
	await focusEditor();
}

export async function setEditorText(text) {
	await browser.executeObsidian(
		({ app, obsidian }, value) => {
			const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			if (!view) {
				throw new Error("No active markdown view");
			}

			view.editor.setValue(value);
			view.editor.setCursor({ line: 0, ch: value.length });
			view.editor.focus();
		},
		text,
	);
}

export async function getEditorText() {
	return browser.executeObsidian(({ app, obsidian }) => {
		const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
		return view?.editor?.getValue() ?? null;
	});
}

export async function focusEditor() {
	await browser.executeObsidian(({ app, obsidian }) => {
		const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
		if (!view) {
			throw new Error("No active markdown view");
		}

		view.editor.focus();
	});
}

export async function setCursorPosition(line, ch) {
	await browser.executeObsidian(
		({ app, obsidian }, l, c) => {
			const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			if (!view) {
				throw new Error("No active markdown view");
			}
			view.editor.setCursor({ line: l, ch: c });
			view.editor.focus();
		},
		line,
		ch,
	);
}

export async function openModal() {
	await browser.executeObsidianCommand(COMMAND_ID);
	const input = await $(INPUT_SELECTOR);
	await input.waitForDisplayed();
	await input.click();
	return input;
}

export async function expectSelectedSuggestionText(text) {
	const regex = new RegExp(text);
	await browser.waitUntil(
		async () => {
			const suggestion = await $(SELECTED_SUGGESTION_SELECTOR);
			const isDisplayed = await suggestion.isDisplayed().catch(() => false);
			if (!isDisplayed) return false;
			return regex.test(await suggestion.getText());
		},
		{ timeoutMsg: `Expected selected suggestion to match /${text}/` },
	);
}

export async function waitForSuggestions() {
	await browser.waitUntil(
		async () => {
			const items = await $$(SUGGESTION_ITEM_SELECTOR);
			return items.length > 0;
		},
		{ timeoutMsg: "Expected at least one suggestion to appear" },
	);
}

export async function getSuggestionCount() {
	const items = await $$(SUGGESTION_ITEM_SELECTOR);
	return items.length;
}

export async function getSuggestionTexts() {
	const items = await $$(SUGGESTION_ITEM_SELECTOR);
	const texts = [];
	for (const item of items) {
		texts.push(await item.getText());
	}
	return texts;
}

export async function waitForNoSuggestion() {
	const empty = await $(".suggestion-empty");
	await empty.waitForDisplayed({ timeout: 10000 });
}

export async function expectHeadingBadge() {
	const badge = await $(`${SELECTED_SUGGESTION_SELECTOR} .natural-link-heading-badge`);
	await badge.waitForDisplayed();
}

export async function expectBlockBadge() {
	const badge = await $(`${SELECTED_SUGGESTION_SELECTOR} .natural-link-block-badge`);
	await badge.waitForDisplayed();
}

export async function waitForEditorText(expectedText) {
	await browser.waitUntil(async () => (await getEditorText()) === expectedText, {
		timeoutMsg: `Expected editor text to become:\n${expectedText}\n\nActual:\n(see waitUntil timeout)`,
	});
}

export async function waitForBlockId(filePath, lineFragment) {
	let matchedId = null;
	await browser.waitUntil(
		async () => {
			const content = await readFile(filePath);
			const line = content
				.split("\n")
				.find((candidate) => candidate.includes(lineFragment));
			if (!line) return false;

			const match = line.match(/\^([0-9a-f]{6})$/);
			if (!match) return false;
			matchedId = match[1];
			return true;
		},
		{
			timeout: 15000,
			timeoutMsg: `Expected block ID to be written to ${filePath} on line containing "${lineFragment}"`,
		},
	);
	return matchedId;
}

export async function isModalOpen() {
	const modal = await $(".modal-container");
	return modal.isDisplayed();
}

export async function waitForModalClosed() {
	await browser.waitUntil(
		async () => !(await isModalOpen()),
		{ timeoutMsg: "Expected modal to be closed" },
	);
}

export async function dismissModalIfOpen() {
	if (await isModalOpen()) {
		await browser.keys("Escape");
		await waitForModalClosed();
	}
}

// =========================================================================
// Full vault reset — call once in before() + every beforeEach()
// =========================================================================

/**
 * Capture a snapshot of every markdown file in the vault.
 * Must be called once in before() after reloadObsidian, before any test
 * mutates files.
 */
export async function initVaultSnapshot() {
	vaultSnapshot = await browser.executeObsidian(({ app }) => {
		const snapshot = {};
		for (const file of app.vault.getMarkdownFiles()) {
			snapshot[file.path] = null;
		}
		return snapshot;
	});
	for (const path of Object.keys(vaultSnapshot)) {
		vaultSnapshot[path] = await readFile(path);
	}
}

/**
 * Bring the entire Obsidian instance to a pristine state between tests:
 *
 *  1. Dismiss inline suggestions and open modals (Escape)
 *  2. Restore every known vault file to its snapshot content
 *  3. Delete any files that were created during a test
 *  4. Wait for metadataCache to re-index the restored files
 *  5. Reset plugin settings and clear runtime state (recentNotes)
 *  6. Close extra editor tabs, open Scratch.md with empty content
 *  7. Wait until the editor is ready and focused
 */
export async function resetVault(defaultSettings) {
	if (!vaultSnapshot) {
		throw new Error("initVaultSnapshot() was not called in before()");
	}

	// 1. Close any open popups — Escape closes inline suggest,
	//    then dismissModalIfOpen handles modals.
	await browser.keys("Escape");
	await dismissModalIfOpen();

	// 2-3. Restore / delete files in a single executeObsidian call,
	//      and return whether any files were actually changed.
	const filesChanged = await browser.executeObsidian(
		async ({ app, obsidian }, snapshot) => {
			let changed = false;
			const knownPaths = new Set(Object.keys(snapshot));

			for (const file of app.vault.getMarkdownFiles()) {
				if (!knownPaths.has(file.path)) {
					await app.vault.delete(file);
					changed = true;
				}
			}

			for (const [path, content] of Object.entries(snapshot)) {
				const file = app.vault.getAbstractFileByPath(path);
				if (file instanceof obsidian.TFile) {
					const current = await app.vault.read(file);
					if (current !== content) {
						await app.vault.modify(file, content);
						changed = true;
					}
				} else {
					await app.vault.create(path, content);
					changed = true;
				}
			}
			return changed;
		},
		vaultSnapshot,
	);

	// 4. Wait for metadataCache to finish processing changed files.
	if (filesChanged) {
		await browser.executeObsidian(({ app }) =>
			new Promise((resolve) => {
				if (app.metadataCache.initialized) {
					const ref = app.metadataCache.on("resolved", () => {
						app.metadataCache.offref(ref);
						resolve();
					});
					setTimeout(() => {
						app.metadataCache.offref(ref);
						resolve();
					}, 2000);
				} else {
					resolve();
				}
			}),
		);
	}

	// 5. Reset plugin settings and clear runtime state.
	await browser.executeObsidian(
		async ({ app, plugins }, nextSettings) => {
			const plugin = plugins.naturalLink;
			if (!plugin) return;

			Object.assign(plugin.settings, nextSettings);
			await plugin.saveSettings();

			plugin.recentNotes = new (plugin.recentNotes.constructor)();
			app.saveLocalStorage("natural-link-recentNotes", null);
		},
		defaultSettings,
	);

	// 6. Close extra leaves, open Scratch.md with empty content.
	await browser.executeObsidian(({ app, obsidian }) => {
		const scratchFile = app.vault.getAbstractFileByPath("Scratch.md");
		if (!scratchFile || !(scratchFile instanceof obsidian.TFile)) {
			throw new Error("Scratch.md missing after restore");
		}

		const leaves = app.workspace.getLeavesOfType("markdown");
		for (let i = 1; i < leaves.length; i++) {
			leaves[i].detach();
		}

		const leaf =
			app.workspace.getMostRecentLeaf() ?? app.workspace.getLeaf();
		leaf.openFile(scratchFile);
	});

	// 7. Wait for editor to show empty Scratch.md, then focus.
	await browser.waitUntil(
		async () => (await getEditorText()) !== null,
		{ timeoutMsg: "Editor did not become available after vault reset" },
	);
	await setEditorText("");
	await browser.waitUntil(
		async () => (await getEditorText()) === "",
		{ timeoutMsg: "Editor was not cleared after vault reset" },
	);
	await focusEditor();
}
