/**
 * Minimal mock of the obsidian module for testing.
 * Only includes what's needed by our code.
 */

export const moment = {
	locale: () => "en",
};

export class Plugin {}
export class PluginSettingTab {}
export class Modal {}
export class SuggestModal {}
export class EditorSuggest {}
export class Setting {}
export class Notice {}
export class TFile {
	path: string;
	constructor(path: string) {
		this.path = path;
	}
}
