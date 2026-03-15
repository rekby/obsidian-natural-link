/* global beforeEach, describe, it */

import assert from "node:assert/strict";
import { $, browser } from "@wdio/globals";
import {
	SELECTED_SUGGESTION_SELECTOR,
	TEST_VAULT,
	waitForPlugin,
	updatePluginSettings,
	getPluginSetting,
	openScratchFile,
	setEditorText,
	getEditorText,
	focusEditor,
	openModal,
	expectSelectedSuggestionText,
	waitForSuggestions,
	getSuggestionCount,
	getSuggestionTexts,
	waitForNoSuggestion,
	expectHeadingBadge,
	expectBlockBadge,
	waitForEditorText,
	waitForBlockId,
	waitForModalClosed,
} from "./helpers.mjs";

const DEFAULT_SETTINGS = {
	searchNonExistingNotes: true,
	showBoostReasonHint: false,
	swapEnterAndTab: false,
	inlineLinkSuggest: false,
};

describe("Natural link real Obsidian flows", function () {
	beforeEach(async function () {
		await browser.reloadObsidian({ vault: TEST_VAULT });
		await waitForPlugin();
		await updatePluginSettings(DEFAULT_SETTINGS);
		await openScratchFile();
	});

	// =========================================================================
	// Modal — basic insertion
	// =========================================================================
	describe("Modal — basic insertion", function () {
		it("inserts a modal suggestion with Enter without display text", async function () {
			await openModal();
			await browser.keys("wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Wooden box]]");
		});

		it("inserts a modal suggestion with Tab with display text", async function () {
			await openModal();
			await browser.keys("wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Tab");

			assert.equal(await getEditorText(), "[[Wooden box|wooden boxes]]");
		});

		it("inserts raw link with Shift+Enter", async function () {
			await openModal();
			await browser.keys("wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys(["Shift", "Enter"]);

			await waitForModalClosed();
			assert.equal(await getEditorText(), "[[wooden boxes|wooden boxes]]");
		});

		it("swapEnterAndTab: Enter inserts with display, Tab without", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, swapEnterAndTab: true });
			await openModal();
			await browser.keys("wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Wooden box|wooden boxes]]");
		});

		it("swapEnterAndTab: Tab inserts without display text", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, swapEnterAndTab: true });
			await openModal();
			await browser.keys("wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Tab");

			assert.equal(await getEditorText(), "[[Wooden box]]");
		});
	});

	// =========================================================================
	// Modal — heading sub-link (#)
	// =========================================================================
	describe("Modal — heading sub-link", function () {
		it("note# shows headings of best matching note", async function () {
			await openModal();
			await browser.keys("Istanbul trip#");

			await waitForSuggestions();
			await expectHeadingBadge();
			const texts = await getSuggestionTexts();
			const hasPackingList = texts.some((t) => t.includes("Packing list"));
			const hasCafes = texts.some((t) => t.includes("Cafes"));
			assert.ok(hasPackingList, "Should show 'Packing list' heading");
			assert.ok(hasCafes, "Should show 'Cafes to revisit' heading");
		});

		it("note#prefix filters headings by prefix", async function () {
			await openModal();
			await browser.keys("Istanbul trip#pack");

			await waitForSuggestions();
			await expectSelectedSuggestionText("Packing list");
			await expectHeadingBadge();
		});

		it("Tab inserts heading link with display text", async function () {
			await openModal();
			await browser.keys("Istanbul trip#pack");

			await expectSelectedSuggestionText("Packing list");
			await browser.keys("Tab");

			assert.equal(
				await getEditorText(),
				"[[Trip to Istanbul#Packing list|Istanbul trip]]",
			);
		});

		it("Enter inserts heading link without display text", async function () {
			await openModal();
			await browser.keys("Istanbul trip#pack");

			await expectSelectedSuggestionText("Packing list");
			await browser.keys("Enter");

			assert.equal(
				await getEditorText(),
				"[[Trip to Istanbul#Packing list]]",
			);
		});
	});

	// =========================================================================
	// Modal — block sub-link (^)
	// =========================================================================
	describe("Modal — block sub-link", function () {
		it("note^ shows blocks of best matching note", async function () {
			await openModal();
			await browser.keys("starter^");

			await waitForSuggestions();
			await expectBlockBadge();
			const count = await getSuggestionCount();
			assert.ok(count >= 2, `Expected at least 2 block suggestions, got ${count}`);
		});

		it("note^prefix filters blocks by text", async function () {
			await openModal();
			await browser.keys("starter^feed");

			await waitForSuggestions();
			await expectSelectedSuggestionText("Feed the starter");
			await expectBlockBadge();
		});

		it("Enter inserts block link and writes block ID to target file", async function () {
			await openModal();
			await browser.keys("starter^feed");

			await expectSelectedSuggestionText("Feed the starter");
			await browser.keys("Enter");

			const blockId = await waitForBlockId(
				"Sourdough starter.md",
				"Feed the starter after breakfast",
			);

			await waitForEditorText(`[[Sourdough starter#^${blockId}]]`);
		});

		it("Tab inserts block link with display text and writes block ID", async function () {
			await openModal();
			await browser.keys("starter^feed");

			await expectSelectedSuggestionText("Feed the starter");
			await browser.keys("Tab");

			const blockId = await waitForBlockId(
				"Sourdough starter.md",
				"Feed the starter after breakfast",
			);

			await waitForEditorText(`[[Sourdough starter#^${blockId}|starter]]`);
		});
	});

	// =========================================================================
	// Modal — empty query and no results
	// =========================================================================
	describe("Modal — empty query and no results", function () {
		it("empty query shows suggestions (not empty list)", async function () {
			await openModal();

			// Don't type anything — just wait for suggestions to appear
			await waitForSuggestions();
			const count = await getSuggestionCount();
			assert.ok(count > 0, "Empty query should show contextual suggestions");
		});

		it("query with no match shows 'no results' message", async function () {
			await openModal();
			await browser.keys("zzzzxxxxxnonexistent");

			await waitForNoSuggestion();
		});
	});

	// =========================================================================
	// Modal — navigation
	// =========================================================================
	describe("Modal — navigation", function () {
		it("Arrow Down selects second suggestion and Enter inserts it", async function () {
			await openModal();
			await browser.keys("o");

			await waitForSuggestions();
			const countBefore = await getSuggestionCount();
			if (countBefore < 2) {
				// Not enough suggestions to test navigation; skip gracefully
				await browser.keys("Escape");
				return;
			}

			// Get text of first and second suggestions
			const textsBefore = await getSuggestionTexts();
			const secondText = textsBefore[1];

			await browser.keys("ArrowDown");

			// The second item should now be selected
			await expectSelectedSuggestionText(secondText.split("\n")[0]);
			await browser.keys("Enter");

			const editorText = await getEditorText();
			assert.ok(editorText.startsWith("[["), "Should have inserted a link");
			assert.ok(editorText.endsWith("]]"), "Should have inserted a link");
		});

		it("Esc dismisses the modal without inserting", async function () {
			await openModal();
			await browser.keys("wooden");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Escape");

			await waitForModalClosed();
			assert.equal(await getEditorText(), "");
		});
	});

	// =========================================================================
	// Inline suggest — basic insertion
	// =========================================================================
	describe("Inline suggest — basic insertion", function () {
		it("replaces inline wikilink with Enter without display text", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });
			await focusEditor();
			await browser.keys("[[wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Wooden box]]");
		});

		it("replaces inline wikilink with Tab with display text", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });
			await focusEditor();
			await browser.keys("[[wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Tab");

			assert.equal(await getEditorText(), "[[Wooden box|wooden boxes]]");
		});

		it("replaces inline wikilink with Shift+Enter as raw link", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });
			await focusEditor();
			await browser.keys("[[wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys(["Shift", "Enter"]);

			await waitForEditorText("[[wooden boxes|wooden boxes]]");
		});

		it("swapEnterAndTab: Enter inserts with display, Tab without (inline)", async function () {
			await updatePluginSettings({
				...DEFAULT_SETTINGS,
				inlineLinkSuggest: true,
				swapEnterAndTab: true,
			});
			await focusEditor();
			await browser.keys("[[wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Wooden box|wooden boxes]]");
		});

		it("swapEnterAndTab: Tab inserts without display (inline)", async function () {
			await updatePluginSettings({
				...DEFAULT_SETTINGS,
				inlineLinkSuggest: true,
				swapEnterAndTab: true,
			});
			await focusEditor();
			await browser.keys("[[wooden boxes");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Tab");

			assert.equal(await getEditorText(), "[[Wooden box]]");
		});

		it("does NOT trigger plugin suggest when inlineLinkSuggest is false", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: false });
			await focusEditor();

			// Use a morphology-only query: "wooden boxes" (plural) is NOT a
			// prefix/substring of "Wooden box", so native suggest won't match.
			// Only the plugin's morphological search would find it.
			await browser.keys("[[wooden boxes");

			await browser.pause(1500);

			const selected = await $(SELECTED_SUGGESTION_SELECTOR);
			const isDisplayed = await selected.isDisplayed().catch(() => false);
			if (isDisplayed) {
				const suggestionText = await selected.getText();
				assert.ok(
					!suggestionText.includes("Wooden box"),
					"Plugin morphological suggest should not be active when disabled",
				);
			}
		});
	});

	// =========================================================================
	// Inline suggest — heading/block sub-links
	// =========================================================================
	describe("Inline suggest — heading/block sub-links", function () {
		it("inline heading link: [[note#prefix + Enter", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });
			await focusEditor();
			await browser.keys("[[Istanbul trip#pack");

			await expectSelectedSuggestionText("Packing list");
			await expectHeadingBadge();
			await browser.keys("Enter");

			assert.equal(
				await getEditorText(),
				"[[Trip to Istanbul#Packing list]]",
			);
		});

		it("inline block link: [[note^prefix + Enter writes block ID", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });
			await focusEditor();
			await browser.keys("[[starter^feed");

			await expectSelectedSuggestionText("Feed the starter");
			await expectBlockBadge();
			await browser.keys("Enter");

			const blockId = await waitForBlockId(
				"Sourdough starter.md",
				"Feed the starter after breakfast",
			);

			await waitForEditorText(`[[Sourdough starter#^${blockId}]]`);
		});
	});

	// =========================================================================
	// Inline suggest — editing existing links
	// =========================================================================
	describe("Inline suggest — editing existing links", function () {
		it("editing existing [[link|display]] preserves display text via Tab", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });

			// Set up: "Check [[|the box]] later" with cursor right after [[
			// setCursorPosition via executeObsidian doesn't sync with WebDriver
			// input context, so use keyboard Home + arrow keys to navigate.
			// Text length: "Check [[|the box]] later" = 24 chars
			// Target cursor position: ch 8 (right after "[[")
			await setEditorText("Check [[|the box]] later");
			await focusEditor();
			await browser.keys("Home");
			for (let i = 0; i < 8; i++) {
				await browser.keys("ArrowRight");
			}
			await browser.pause(200);
			await browser.keys("wooden");

			await expectSelectedSuggestionText("Wooden box");
			// Tab triggers "insert with display" — resolveEditingContext extracts
			// the original "|the box" display and buildLink preserves it.
			await browser.keys("Tab");

			await waitForEditorText("Check [[Wooden box|the box]] later");
		});
	});

	// =========================================================================
	// Search features
	// =========================================================================
	describe("Search features", function () {
		it("finds note by Russian declension form (morphology)", async function () {
			await openModal();
			await browser.keys("деревянную коробку");

			await expectSelectedSuggestionText("Деревянная коробка");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Деревянная коробка]]");
		});

		it("finds note by alias", async function () {
			await openModal();
			await browser.keys("jogging routine");

			await expectSelectedSuggestionText("Morning run");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Morning run]]");
		});

		it("shows non-existing notes (unresolved links) in results", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, searchNonExistingNotes: true });
			await openModal();
			await browser.keys("Old memories");

			await waitForSuggestions();
			const texts = await getSuggestionTexts();
			const found = texts.some((t) => t.includes("Old memories"));
			assert.ok(found, "Unresolved link 'Old memories' should appear in results");
		});

		it("hides non-existing notes when searchNonExistingNotes is false", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, searchNonExistingNotes: false });
			await openModal();
			await browser.keys("Old memories");

			// Wait a moment for suggestions to settle
			await browser.pause(500);

			// Either no suggestions or none matching "Old memories"
			const count = await getSuggestionCount();
			if (count > 0) {
				const texts = await getSuggestionTexts();
				const found = texts.some((t) => t.includes("Old memories"));
				assert.ok(!found, "'Old memories' should NOT appear when searchNonExistingNotes is false");
			}
		});
	});

	// =========================================================================
	// Commands
	// =========================================================================
	describe("Commands — toggle inline suggest", function () {
		it("toggle-inline-link-suggest toggles the setting", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: false });

			const before = await getPluginSetting("inlineLinkSuggest");
			assert.equal(before, false);

			await browser.executeObsidianCommand("natural-link:toggle-inline-link-suggest");
			await browser.pause(500);

			const after = await getPluginSetting("inlineLinkSuggest");
			assert.equal(after, true);
		});

		it("enable-inline-link-suggest sets setting to true", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: false });

			await browser.executeObsidianCommand("natural-link:enable-inline-link-suggest");
			await browser.pause(500);

			const value = await getPluginSetting("inlineLinkSuggest");
			assert.equal(value, true);
		});

		it("disable-inline-link-suggest sets setting to false", async function () {
			await updatePluginSettings({ ...DEFAULT_SETTINGS, inlineLinkSuggest: true });

			await browser.executeObsidianCommand("natural-link:disable-inline-link-suggest");
			await browser.pause(500);

			const value = await getPluginSetting("inlineLinkSuggest");
			assert.equal(value, false);
		});
	});

	// =========================================================================
	// Pipe syntax
	// =========================================================================
	describe("Pipe syntax — explicit display text", function () {
		it("modal: query|custom display inserts [[Target|custom display]]", async function () {
			await openModal();
			await browser.keys("wooden boxes|my box");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Tab");

			assert.equal(await getEditorText(), "[[Wooden box|my box]]");
		});

		it("modal: Enter with pipe syntax still inserts without display text", async function () {
			await openModal();
			await browser.keys("wooden boxes|my box");

			await expectSelectedSuggestionText("Wooden box");
			await browser.keys("Enter");

			assert.equal(await getEditorText(), "[[Wooden box]]");
		});
	});
});
