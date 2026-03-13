import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { $, browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

export const COMMAND_ID = "natural-link:insert-link";
export const DEMO_ARTIFACTS_ROOT = path.resolve("obsidian-tests/demo-artifacts");
export const DEMO_OUTPUT_ROOT = path.resolve("docs/demo");
export const HUMAN_KEY_DELAY_MS = 200;
export const HUMAN_PAUSE_MS = 800;

const APP_SELECTOR = ".app-container";
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

export class DemoRecorder {
	constructor(locale, scenarioName) {
		this.locale = locale;
		this.scenarioName = scenarioName;
		this.frames = [];
		this.frameIndex = 0;
		this.outputPath = path.join(DEMO_OUTPUT_ROOT, locale, `${scenarioName}.gif`);
		this.scenarioDir = path.join(DEMO_ARTIFACTS_ROOT, locale, scenarioName);
	}

	async init() {
		await fs.rm(this.scenarioDir, { recursive: true, force: true });
		await fs.mkdir(this.scenarioDir, { recursive: true });
	}

	async capture(durationMs, selector = APP_SELECTOR) {
		const target = await $(selector);
		await target.waitForDisplayed();

		const filename = `${String(this.frameIndex).padStart(4, "0")}.png`;
		const filepath = path.join(this.scenarioDir, filename);
		await target.saveScreenshot(filepath);
		this.frames.push({ file: filename, durationMs });
		this.frameIndex += 1;
	}

	async captureAndPause(durationMs, selector = APP_SELECTOR) {
		await this.capture(durationMs, selector);
		await browser.pause(durationMs);
	}

	async finalize(extra = {}) {
		assert.ok(this.frames.length > 0, "demo recorder must capture at least one frame");

		const manifestPath = path.join(this.scenarioDir, "manifest.json");
		const manifest = {
			locale: this.locale,
			scenario: this.scenarioName,
			output: path.relative(process.cwd(), this.outputPath),
			frames: this.frames,
			...extra,
		};
		await fs.writeFile(manifestPath, JSON.stringify(manifest, null, "\t"));
	}
}

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

export async function prepareDemoScenario({
	vault,
	locale,
	startFile,
	inlineLinkSuggest = false,
	initialText,
}) {
	await browser.reloadObsidian({ vault });
	await waitForPlugin();
	await configureDemoEnvironment(locale, inlineLinkSuggest);
	await obsidianPage.openFile(startFile);
	await browser.waitUntil(async () => (await getEditorText()) !== null, {
		timeoutMsg: "Editor did not become available",
	});
	await setEditorText(initialText);
}

export async function configureDemoEnvironment(locale, inlineLinkSuggest) {
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

			app.workspace.leftSplit?.expand?.();
			app.workspace.leftSplit?.setCollapsed?.(false);
		},
		locale,
		LOCALE_TEXT[locale].instructions,
	);

	await browser.execute(() => {
		const styleId = "natural-link-demo-style";
		document.getElementById(styleId)?.remove();

		const style = document.createElement("style");
		style.id = styleId;
		style.textContent = `
			body.theme-dark {
				color-scheme: light;
			}
			body.theme-dark,
			body.theme-dark .app-container {
				background: var(--background-primary);
			}
			body.theme-dark .theme-dark,
			body.theme-dark .workspace,
			body.theme-dark .workspace-split,
			body.theme-dark .workspace-leaf-content {
				color: var(--text-normal);
			}
			.workspace-split.mod-right-split,
			.status-bar,
			.workspace-tab-header-container {
				display: none !important;
			}
			.workspace-split.mod-left-split {
				display: flex !important;
				min-width: 280px !important;
				width: 280px !important;
			}
			.workspace-split.mod-root {
				inset: 0 !important;
			}
		`;
		document.head.append(style);

		document.body.classList.remove("theme-dark");
		document.body.classList.add("theme-light");
		window.dispatchEvent(new Event("resize"));
	});

	await browser.pause(300);
}

export async function setEditorText(text) {
	await browser.executeObsidian(
		({ app, obsidian }, value) => {
			const view = app.workspace.getActiveViewOfType(obsidian.MarkdownView);
			if (!view) {
				throw new Error("No active markdown view");
			}

			view.editor.setValue(value);
			view.editor.setCursor({ line: value.split("\n").length - 1, ch: value.split("\n").at(-1).length });
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

export async function expectSelectedSuggestionText(text) {
	const suggestion = await $(SELECTED_SUGGESTION_SELECTOR);
	await suggestion.waitForDisplayed();
	assert.match(await suggestion.getText(), new RegExp(text));
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
