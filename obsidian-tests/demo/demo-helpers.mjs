/**
 * Demo helpers specific to natural-link.
 *
 * Everything generic — freezing the UI, locking the window, capturing frames,
 * rendering byte-identical GIFs — lives in `obsidian-tests/lib/` and is owned by
 * the plugin template. Keep only plugin-specific ids, selectors and strings
 * here, so a template sync never conflicts with this file.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { $, browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
	DEMO_ARTIFACTS_ROOT as LIB_ARTIFACTS_ROOT,
	DEMO_OUTPUT_ROOT as LIB_OUTPUT_ROOT,
	DemoRecorder as LibDemoRecorder,
	HUMAN_KEY_DELAY_MS,
	HUMAN_PAUSE_MS,
	APP_SELECTOR,
	captureKeyPress as libCaptureKeyPress,
	configureDemoEnvironment as freezeUi,
	readVaultDir,
	saveAppScreenshot,
	syncVaultFiles,
	waitForMetadataResolved,
	waitForPlugin as libWaitForPlugin,
} from "../lib/index.mjs";

export const PLUGIN_ID = "natural-link";
export const COMMAND_ID = "natural-link:insert-link";
export const OPEN_MODAL_CAPTION = "Cmd/Ctrl+Shift+K";
export const STYLE_ID = "natural-link-demo-style";
export const OVERLAY_ID = "natural-link-demo-key-overlay";

export { APP_SELECTOR, HUMAN_KEY_DELAY_MS, HUMAN_PAUSE_MS, saveAppScreenshot };

export const DEMO_OUTPUT_ROOT = LIB_OUTPUT_ROOT;
export const DEMO_ARTIFACTS_ROOT = LIB_ARTIFACTS_ROOT;

const INPUT_SELECTOR = ".modal-container .prompt-input";
const SELECTED_SUGGESTION_SELECTOR = ".suggestion-item.is-selected";

export const LOCALE_TEXT = {
	en: {
		modalPlaceholder: "Type to search notes...",
		headingBadge: "Heading",
		blockBadge: "Block",
		insertWithoutDisplay: "Insert link without display text",
		instructions: [
			{ command: "↑↓", purpose: "Navigate" },
			{ command: "↵", purpose: "Insert link without display text" },
			{ command: "tab", purpose: "Insert link" },
			{ command: "shift ↵", purpose: "Insert link as typed" },
			{ command: "esc", purpose: "Dismiss" },
		],
	},
	ru: {
		modalPlaceholder: "Начните вводить для поиска заметок...",
		headingBadge: "заголовок",
		blockBadge: "блок",
		insertWithoutDisplay: "Вставить ссылку без отображаемого текста",
		instructions: [
			{ command: "↑↓", purpose: "Навигация" },
			{ command: "↵", purpose: "Вставить ссылку без отображаемого текста" },
			{ command: "tab", purpose: "Вставить ссылку" },
			{ command: "shift ↵", purpose: "Вставить ссылку как введено" },
			{ command: "esc", purpose: "Закрыть" },
		],
	},
};

/** Per-locale output: docs/demo/<locale>/<scenario>.gif */
export class DemoRecorder extends LibDemoRecorder {
	constructor(locale, scenarioName) {
		super(scenarioName, {
			outputRoot: path.join(DEMO_OUTPUT_ROOT, locale),
			artifactsRoot: path.join(DEMO_ARTIFACTS_ROOT, locale),
		});
		this.locale = locale;
	}

	async finalize(extra = {}) {
		await super.finalize({ locale: this.locale, ...extra });
	}
}

export async function waitForPlugin() {
	await libWaitForPlugin(PLUGIN_ID);
}

export async function captureKeyPress(recorder, label, durationMs = 650) {
	await libCaptureKeyPress(recorder, label, durationMs, { overlayId: OVERLAY_ID });
}

export async function prepareDemoScenario({
	vault,
	locale,
	startFile,
	inlineLinkSuggest = false,
	initialText,
}) {
	await browser.keys("Escape");
	const modalContainer = await $(".modal-container");
	if (await modalContainer.isDisplayed().catch(() => false)) {
		await browser.keys("Escape");
		await browser.waitUntil(
			async () => !(await modalContainer.isDisplayed().catch(() => false)),
			{ timeout: 5000 },
		);
	}

	await browser.executeObsidian(({ app }) => {
		for (const leaf of app.workspace.getLeavesOfType("markdown")) {
			leaf.detach();
		}
	});

	if (await syncVaultFiles(await readVaultDir(vault))) {
		await waitForMetadataResolved();
	}

	// Recency and in-flight suggest state reorder results, so a scenario would
	// otherwise depend on whichever scenario ran before it.
	await browser.executeObsidian(({ app, plugins }) => {
		const plugin = plugins.naturalLink;
		if (!plugin) return;
		plugin.recentNotes = new (plugin.recentNotes.constructor)();
		app.saveLocalStorage("natural-link-recentNotes", null);

		const pluginSuggest = app.workspace.editorSuggest?.suggests?.find(
			(c) => c?.plugin === plugin,
		);
		if (pluginSuggest) {
			pluginSuggest.activeCore = null;
		}
	});

	await waitForPlugin();
	await configureDemoEnvironment(locale, inlineLinkSuggest);
	await obsidianPage.openFile(startFile);
	await browser.waitUntil(async () => (await getEditorText()) !== null, {
		timeoutMsg: "Editor did not become available",
	});
	await setEditorText(initialText);
}

export async function configureDemoEnvironment(locale, inlineLinkSuggest) {
	// Pin every setting that changes what is rendered. `showBoostReasonHint`
	// especially: the hint text depends on scoring internals.
	await browser.executeObsidian(
		async ({ plugins }, nextSettings) => {
			const plugin = plugins.naturalLink;
			if (!plugin) {
				throw new Error("Natural link plugin is not available");
			}
			Object.assign(plugin.settings, nextSettings);
			await plugin.saveSettings();
		},
		{
			searchNonExistingNotes: true,
			showBoostReasonHint: false,
			swapEnterAndTab: false,
			inlineLinkSuggest,
		},
	);

	// Freeze fonts, theme, chrome, animations, caret and window size.
	await freezeUi({ pluginId: PLUGIN_ID, locale, styleId: STYLE_ID });

	// The plugin renders its own strings through moment's locale, and the
	// suggest instructions are built once at construction time.
	await browser.executeObsidian(
		({ app, obsidian, plugins }, nextLocale, nextInstructions) => {
			obsidian.moment.locale(nextLocale);

			const manager = app.workspace.editorSuggest;
			const pluginSuggest = manager?.suggests?.find(
				(candidate) =>
					candidate?.plugin === plugins.naturalLink ||
					candidate?.constructor?.name === "NaturalLinkSuggest",
			);
			pluginSuggest?.setInstructions?.(nextInstructions);
		},
		locale,
		LOCALE_TEXT[locale].instructions,
	);
}

export async function setEditorText(text) {
	await browser.executeObsidian(
		({ app, obsidian }, value) => {
			const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			if (!view) {
				throw new Error("No active markdown view");
			}

			view.editor.setValue(value);
			view.editor.setCursor({
				line: value.split("\n").length - 1,
				ch: value.split("\n").at(-1).length,
			});
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

export async function typeText(text, recorder) {
	for (const char of [...text]) {
		await browser.keys(char);
		await recorder.captureAndPause(HUMAN_KEY_DELAY_MS);
	}
}

export async function openModal() {
	await browser.executeObsidianCommand(COMMAND_ID);
	const input = await $(INPUT_SELECTOR);
	await input.waitForDisplayed();
	await input.click();
	return input;
}

export async function expectModalPlaceholder(locale) {
	const input = await $(INPUT_SELECTOR);
	await input.waitForDisplayed();
	assert.equal(await input.getAttribute("placeholder"), LOCALE_TEXT[locale].modalPlaceholder);
}

/**
 * Wait for the selection to settle on the expected suggestion.
 *
 * Search results arrive asynchronously and the first painted item is often not
 * the final one, so asserting immediately after the element appears would check
 * an intermediate state — and, worse, a screenshot taken right after would show
 * it.
 */
export async function expectSelectedSuggestionText(text) {
	const expected = new RegExp(text);
	let lastSeen = null;

	await browser.waitUntil(async () => {
		const suggestion = await $(SELECTED_SUGGESTION_SELECTOR);
		if (!(await suggestion.isDisplayed().catch(() => false))) return false;
		lastSeen = await suggestion.getText();
		return expected.test(lastSeen);
	}, {
		timeout: 5000,
		interval: 50,
		timeoutMsg: `Expected selected suggestion to match ${expected}, last seen: ${lastSeen}`,
	});

	assert.match(lastSeen, expected);
}

export async function expectHeadingBadge(locale) {
	const badge = await $(`${SELECTED_SUGGESTION_SELECTOR} .natural-link-heading-badge`);
	await badge.waitForDisplayed();
	assert.equal(await badge.getText(), LOCALE_TEXT[locale].headingBadge);
}

export async function expectBlockBadge(locale) {
	const badge = await $(`${SELECTED_SUGGESTION_SELECTOR} .natural-link-block-badge`);
	await badge.waitForDisplayed();
	assert.equal(await badge.getText(), LOCALE_TEXT[locale].blockBadge);
}

export async function waitForEditorText(expectedText) {
	await browser.waitUntil(async () => (await getEditorText()) === expectedText, {
		timeoutMsg: `Expected editor text to become: ${expectedText}`,
	});
}

export async function waitForBlockId(filePath, lineFragment) {
	let matchedId = null;
	await browser.waitUntil(async () => {
		const content = await obsidianPage.read(filePath);
		const line = content.split("\n").find((candidate) => candidate.includes(lineFragment));
		if (!line) return false;

		const match = line.match(/\^([0-9a-f]{6})$/);
		if (!match) return false;
		matchedId = match[1];
		return true;
	}, {
		timeout: 15000,
		timeoutMsg: `Expected block ID to be written to ${filePath}`,
	});
	return matchedId;
}
