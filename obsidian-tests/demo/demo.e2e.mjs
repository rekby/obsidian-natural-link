/* global describe, it */

import path from "node:path";
import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";
import {
	DemoRecorder,
	HUMAN_PAUSE_MS,
	OPEN_MODAL_CAPTION,
	prepareDemoScenario,
	openModal,
	typeText,
	captureKeyPress,
	expectModalPlaceholder,
	expectSelectedSuggestionText,
	expectHeadingBadge,
	expectBlockBadge,
	focusEditor,
	waitForEditorText,
	waitForBlockId,
} from "./demo-helpers.mjs";

const EN_VAULT = "./obsidian-tests/demo-vaults/en";
const RU_VAULT = "./obsidian-tests/demo-vaults/ru";

const scenarios = [
	{
		name: "modal-search",
		locale: "en",
		vault: EN_VAULT,
		startFile: "Weekend notes.md",
		initialText: "Weekend errands:\n\nThe best place for the winter gloves is ",
		query: "wooden boxes",
		selectedText: "Wooden box",
		acceptKey: "Tab",
		expectedEditorText:
			"Weekend errands:\n\nThe best place for the winter gloves is [[Wooden box|wooden boxes]]",
		run: async (scenario, recorder) => {
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, OPEN_MODAL_CAPTION);
			await openModal();
			await expectModalPlaceholder(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, scenario.acceptKey);
			await browser.keys(scenario.acceptKey);
			await waitForEditorText(scenario.expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
		},
	},
	{
		name: "inline-link",
		locale: "en",
		vault: EN_VAULT,
		startFile: "Weekend notes.md",
		inlineLinkSuggest: true,
		initialText: "Sunday reset:\n\nA small ritual that helps me wake up is ",
		query: "[[morning runs",
		selectedText: "Morning run",
		expectedEditorText:
			"Sunday reset:\n\nA small ritual that helps me wake up is [[Morning run]]",
		run: async (scenario, recorder) => {
			await focusEditor();
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, "Enter");
			await browser.keys("Enter");
			await waitForEditorText(scenario.expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
		},
	},
	{
		name: "heading-link",
		locale: "en",
		vault: EN_VAULT,
		startFile: "Weekend notes.md",
		initialText: "Travel planning:\n\nBefore I book anything, I revisit ",
		query: "Istanbul trip#pack",
		selectedText: "Packing list",
		acceptKey: "Tab",
		expectedEditorText:
			"Travel planning:\n\nBefore I book anything, I revisit [[Trip to Istanbul#Packing list|Istanbul trip]]",
		run: async (scenario, recorder) => {
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, OPEN_MODAL_CAPTION);
			await openModal();
			await expectModalPlaceholder(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await expectHeadingBadge(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, scenario.acceptKey);
			await browser.keys(scenario.acceptKey);
			await waitForEditorText(scenario.expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
		},
	},
	{
		name: "block-link",
		locale: "en",
		vault: EN_VAULT,
		startFile: "Weekend notes.md",
		initialText: "Kitchen plans:\n\nTonight I need to check ",
		query: "starter^feed",
		selectedText: "Feed the starter",
		targetFile: "Sourdough starter.md",
		targetLineFragment: "Feed the starter after breakfast",
		run: async (scenario, recorder) => {
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, OPEN_MODAL_CAPTION);
			await openModal();
			await expectModalPlaceholder(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await expectBlockBadge(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, "Enter");
			await browser.keys("Enter");

			const blockId = await waitForBlockId(
				scenario.targetFile,
				scenario.targetLineFragment,
			);
			const expectedEditorText =
				`Kitchen plans:\n\nTonight I need to check [[Sourdough starter#^${blockId}]]`;
			await waitForEditorText(expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);

			await obsidianPage.openFile(scenario.targetFile);
			await browser.waitUntil(async () => {
				const content = await obsidianPage.read(scenario.targetFile);
				return content.includes(`^${blockId}`);
			});
			await recorder.captureAndPause(1200);
		},
	},
	{
		name: "modal-search",
		locale: "ru",
		vault: RU_VAULT,
		startFile: "Заметки выходных.md",
		initialText: "Домашние дела:\n\nЛучше всего хранить зимние перчатки в ",
		query: "деревянную коробку",
		selectedText: "Деревянная коробка",
		acceptKey: "Tab",
		expectedEditorText:
			"Домашние дела:\n\nЛучше всего хранить зимние перчатки в [[Деревянная коробка|деревянную коробку]]",
		run: async (scenario, recorder) => {
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, OPEN_MODAL_CAPTION);
			await openModal();
			await expectModalPlaceholder(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, scenario.acceptKey);
			await browser.keys(scenario.acceptKey);
			await waitForEditorText(scenario.expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
		},
	},
	{
		name: "inline-link",
		locale: "ru",
		vault: RU_VAULT,
		startFile: "Заметки выходных.md",
		inlineLinkSuggest: true,
		initialText: "Ритуалы утра:\n\nПроснуться помогает ",
		query: "[[утренние пробежки",
		selectedText: "Утренняя пробежка",
		expectedEditorText:
			"Ритуалы утра:\n\nПроснуться помогает [[Утренняя пробежка]]",
		run: async (scenario, recorder) => {
			await focusEditor();
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, "Enter");
			await browser.keys("Enter");
			await waitForEditorText(scenario.expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
		},
	},
	{
		name: "heading-link",
		locale: "ru",
		vault: RU_VAULT,
		startFile: "Заметки выходных.md",
		initialText: "Планы на поездку:\n\nПеред покупкой билетов я открываю ",
		query: "поездка в стамбул#что взя",
		selectedText: "Что взять",
		acceptKey: "Tab",
		expectedEditorText:
			"Планы на поездку:\n\nПеред покупкой билетов я открываю [[Поездка в Стамбул#Что взять|поездка в стамбул]]",
		run: async (scenario, recorder) => {
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, OPEN_MODAL_CAPTION);
			await openModal();
			await expectModalPlaceholder(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await expectHeadingBadge(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, scenario.acceptKey);
			await browser.keys(scenario.acceptKey);
			await waitForEditorText(scenario.expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
		},
	},
	{
		name: "block-link",
		locale: "ru",
		vault: RU_VAULT,
		startFile: "Заметки выходных.md",
		initialText: "На кухне:\n\nСегодня вечером мне нужно проверить ",
		query: "закваска^подкорм",
		selectedText: "Подкормить закваску",
		targetFile: "Пшеничная закваска.md",
		targetLineFragment: "Подкормить закваску после завтрака",
		run: async (scenario, recorder) => {
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, OPEN_MODAL_CAPTION);
			await openModal();
			await expectModalPlaceholder(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await typeText(scenario.query, recorder);
			await expectSelectedSuggestionText(scenario.selectedText);
			await expectBlockBadge(scenario.locale);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);
			await captureKeyPress(recorder, "Enter");
			await browser.keys("Enter");

			const blockId = await waitForBlockId(
				scenario.targetFile,
				scenario.targetLineFragment,
			);
			const expectedEditorText =
				`На кухне:\n\nСегодня вечером мне нужно проверить [[Пшеничная закваска#^${blockId}]]`;
			await waitForEditorText(expectedEditorText);
			await recorder.captureAndPause(HUMAN_PAUSE_MS);

			await obsidianPage.openFile(scenario.targetFile);
			await browser.waitUntil(async () => {
				const content = await obsidianPage.read(scenario.targetFile);
				return content.includes(`^${blockId}`);
			});
			await recorder.captureAndPause(1200);
		},
	},
];

describe("Natural link README demo capture", function () {
	for (const scenario of scenarios) {
		it(`${scenario.locale} ${scenario.name}`, async function () {
			const recorder = new DemoRecorder(scenario.locale, scenario.name);
			await recorder.init();

			await prepareDemoScenario({
				vault: scenario.vault,
				locale: scenario.locale,
				startFile: scenario.startFile,
				inlineLinkSuggest: scenario.inlineLinkSuggest ?? false,
				initialText: scenario.initialText,
			});

			await scenario.run(scenario, recorder);
			await recorder.finalize({
				startFile: scenario.startFile,
				vault: path.basename(scenario.vault),
			});
		});
	}
});
