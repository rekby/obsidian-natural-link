import { en } from "./en";
import { ru } from "./ru";
import { moment } from "obsidian";

export type TranslationKey = keyof typeof en;

const locales: Record<string, Partial<typeof en>> = {
	en,
	ru,
};

/**
 * Get a translated string for the given key.
 * Uses the current Obsidian locale (from moment.locale()).
 * Falls back to English if the key is not translated or the locale is unknown.
 */
export function t(key: TranslationKey): string {
	return getTranslation(moment.locale(), key);
}

/**
 * Get a translation for a specific locale (useful for testing).
 */
export function getTranslation(locale: string, key: TranslationKey): string {
	const translations = locales[locale];
	if (translations) {
		const value = translations[key];
		if (value !== undefined) {
			return value;
		}
	}
	return en[key];
}
