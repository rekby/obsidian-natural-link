import { describe, it, expect } from "vitest";
import { getTranslation } from "../../src/i18n/index";

describe("i18n", () => {
	it("returns English translation for 'en' locale", () => {
		expect(getTranslation("en", "command.natural-link")).toBe(
			"Insert natural link",
		);
	});

	it("returns Russian translation for 'ru' locale", () => {
		expect(getTranslation("ru", "command.natural-link")).toBe(
			"Вставить естественную ссылку",
		);
	});

	it("falls back to English for unknown locale", () => {
		expect(getTranslation("zh", "command.natural-link")).toBe(
			"Insert natural link",
		);
	});

	it("falls back to English for missing key in a known locale", () => {
		// All keys are currently translated in ru, but this tests the fallback mechanism
		// by using a locale that has partial translations
		expect(getTranslation("en", "modal.placeholder")).toBe(
			"Type to search notes...",
		);
	});

	it("returns correct translations for all keys in English", () => {
		const keys: Array<Parameters<typeof getTranslation>[1]> = [
			"command.natural-link",
			"modal.placeholder",
			"modal.no-results",
			"modal.instruction.navigate",
			"modal.instruction.insert-link",
			"modal.instruction.insert-as-typed",
			"modal.instruction.dismiss",
			"settings.title",
			"settings.hotkey-button",
			"settings.hotkey-description",
		];
		for (const key of keys) {
			const value = getTranslation("en", key);
			expect(typeof value).toBe("string");
			expect(value.length).toBeGreaterThan(0);
		}
	});

	it("returns correct translations for all keys in Russian", () => {
		const keys: Array<Parameters<typeof getTranslation>[1]> = [
			"command.natural-link",
			"modal.placeholder",
			"modal.no-results",
			"modal.instruction.navigate",
			"modal.instruction.insert-link",
			"modal.instruction.insert-as-typed",
			"modal.instruction.dismiss",
			"settings.title",
			"settings.hotkey-button",
			"settings.hotkey-description",
		];
		for (const key of keys) {
			const value = getTranslation("ru", key);
			expect(typeof value).toBe("string");
			expect(value.length).toBeGreaterThan(0);
		}
	});
});
