/* global describe, it */

import path from "node:path";
import { $, browser } from "@wdio/globals";
import {
	APP_SELECTOR,
	expectModalPlaceholder,
	expectSelectedSuggestionText,
	focusEditor,
	openModal,
	prepareDemoScenario,
} from "./demo-helpers.mjs";

const EN_VAULT = "./obsidian-tests/demo-vaults/en";
const RU_VAULT = "./obsidian-tests/demo-vaults/ru";

function screenshotPath(locale, name) {
	return path.resolve("docs/demo", locale, `${name}.png`);
}

async function typeQuery(text) {
	for (const char of [...text]) {
		await browser.keys(char);
	}
}

async function showHotkeyOverlay(label) {
	await browser.execute((text) => {
		const overlay = document.getElementById("natural-link-demo-key-overlay");
		if (!overlay) return;
		overlay.textContent = text;
		overlay.style.display = "block";
	}, label);
}

async function hideHotkeyOverlay() {
	await browser.execute(() => {
		const overlay = document.getElementById("natural-link-demo-key-overlay");
		if (!overlay) return;
		overlay.textContent = "";
		overlay.style.display = "none";
	});
}

async function saveAppScreenshot(outputPath) {
	const app = await $(APP_SELECTOR);
	await app.waitForDisplayed();
	await app.saveScreenshot(outputPath);
}

describe("Natural link README screenshots", function () {
	it("captures English modal search screenshot", async () => {
		await prepareDemoScenario({
			vault: EN_VAULT,
			locale: "en",
			startFile: "Weekend notes.md",
			initialText: "Workout log:\n\nYesterday after lunch I ",
		});

		await openModal();
		await expectModalPlaceholder("en");
		await typeQuery("went walking");
		await expectSelectedSuggestionText("Go for a walk");
		await showHotkeyOverlay("Cmd/Ctrl+Shift+K");

		await saveAppScreenshot(screenshotPath("en", "modal-search"));
		await hideHotkeyOverlay();
	});

	it("captures English inline suggest screenshot", async () => {
		await prepareDemoScenario({
			vault: EN_VAULT,
			locale: "en",
			startFile: "Weekend notes.md",
			inlineLinkSuggest: true,
			initialText: "Sunday reset:\n\nA small ritual that helps me wake up is ",
		});

		await focusEditor();
		await typeQuery("[[running mornings");
		await expectSelectedSuggestionText("Morning run");

		await saveAppScreenshot(screenshotPath("en", "inline-link"));
	});

	it("captures Russian modal search screenshot", async () => {
		await prepareDemoScenario({
			vault: RU_VAULT,
			locale: "ru",
			startFile: "Заметки выходных.md",
			initialText: "Дневные дела:\n\nПосле обеда нужно сводить ",
		});

		await openModal();
		await expectModalPlaceholder("ru");
		await typeQuery("детей на площадку");
		await expectSelectedSuggestionText("Ребёнок на площадке");
		await showHotkeyOverlay("Cmd/Ctrl+Shift+K");

		await saveAppScreenshot(screenshotPath("ru", "modal-search"));
		await hideHotkeyOverlay();
	});

	it("captures Russian inline suggest screenshot", async () => {
		await prepareDemoScenario({
			vault: RU_VAULT,
			locale: "ru",
			startFile: "Заметки выходных.md",
			inlineLinkSuggest: true,
			initialText: "Ритуалы утра:\n\nПроснуться помогает ",
		});

		await focusEditor();
		await typeQuery("[[утренние пробежки");
		await expectSelectedSuggestionText("Утренняя пробежка");

		await saveAppScreenshot(screenshotPath("ru", "inline-link"));
	});
});
