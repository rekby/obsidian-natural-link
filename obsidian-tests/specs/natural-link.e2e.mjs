/* global beforeEach, describe, it */

import assert from "node:assert/strict";
import { $, browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const COMMAND_ID = "natural-link:insert-link";
const INPUT_SELECTOR = ".modal-container .prompt-input";
const SELECTED_SUGGESTION_SELECTOR = ".suggestion-item.is-selected";
const SCRATCH_FILE = "Scratch.md";

async function waitForPlugin() {
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

async function updatePluginSettings(settings) {
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

async function openScratchFile() {
	await obsidianPage.openFile(SCRATCH_FILE);
	await browser.waitUntil(
		async () => (await getEditorText()) !== null,
		{
			timeoutMsg: "Editor did not become available",
		},
	);
	await setEditorText("");
}

async function setEditorText(text) {
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

async function getEditorText() {
	return browser.executeObsidian(({ app, obsidian }) => {
		const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
		return view?.editor?.getValue() ?? null;
	});
}

async function focusEditor() {
	await browser.executeObsidian(({ app, obsidian }) => {
		const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
		if (!view) {
			throw new Error("No active markdown view");
		}

		view.editor.focus();
	});
}

async function expectSelectedSuggestionText(text) {
	const suggestion = await $(SELECTED_SUGGESTION_SELECTOR);
	await suggestion.waitForDisplayed();
	assert.match(await suggestion.getText(), new RegExp(text));
}

describe("Natural link real Obsidian flows", function () {
	beforeEach(async function () {
		await browser.reloadObsidian({ vault: "./obsidian-tests/vault" });
		await waitForPlugin();
		await updatePluginSettings({
			searchNonExistingNotes: true,
			showBoostReasonHint: false,
			swapEnterAndTab: false,
			inlineLinkSuggest: false,
		});
		await openScratchFile();
	});

	it("inserts a modal suggestion with Enter without display text", async function () {
		await browser.executeObsidianCommand(COMMAND_ID);

		const input = await $(INPUT_SELECTOR);
		await input.waitForDisplayed();
		await input.click();
		await browser.keys("wooden boxes");

		await expectSelectedSuggestionText("Wooden box");
		await browser.keys("Enter");

		assert.equal(await getEditorText(), "[[Wooden box]]");
	});

	it("inserts a modal suggestion with Tab with display text", async function () {
		await browser.executeObsidianCommand(COMMAND_ID);

		const input = await $(INPUT_SELECTOR);
		await input.waitForDisplayed();
		await input.click();
		await browser.keys("wooden boxes");

		await expectSelectedSuggestionText("Wooden box");
		await browser.keys("Tab");

		assert.equal(await getEditorText(), "[[Wooden box|wooden boxes]]");
	});

	it("replaces an inline wikilink query with Enter without display text", async function () {
		await updatePluginSettings({ inlineLinkSuggest: true });
		await focusEditor();
		await browser.keys("[[wooden boxes");

		await expectSelectedSuggestionText("Wooden box");
		await browser.keys("Enter");

		assert.equal(await getEditorText(), "[[Wooden box]]");
	});
});
