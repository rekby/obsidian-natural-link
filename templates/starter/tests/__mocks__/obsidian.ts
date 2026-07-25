/**
 * Minimal stand-in for the `obsidian` module in unit tests.
 *
 * `vitest.config.ts` aliases `obsidian` to this file. Add only what your plugin
 * actually imports — a large stub is a sign that logic which should be pure has
 * grown a dependency on the Obsidian runtime.
 */

export class Plugin {
	constructor(public app?: unknown, public manifest?: unknown) {}
	addCommand(): void {}
	addSettingTab(): void {}
	registerEvent(): void {}
	async loadData(): Promise<unknown> { return null; }
	async saveData(): Promise<void> {}
}

export class PluginSettingTab {
	containerEl = { empty(): void {} };
	constructor(public app?: unknown, public plugin?: unknown) {}
	display(): void {}
}

export class Setting {
	constructor(public containerEl?: unknown) {}
	setName(): this { return this; }
	setDesc(): this { return this; }
	addText(): this { return this; }
	addToggle(): this { return this; }
}

export class Notice {
	constructor(public message?: string) {}
}

export class Modal {
	constructor(public app?: unknown) {}
	open(): void {}
	close(): void {}
}

export class TFile {
	constructor(public path: string = '') {}
}

export class TFolder {
	constructor(public path: string = '') {}
}

export const moment = {
	locale: (): string => 'en',
};

export type App = unknown;
export type Editor = unknown;
export type MarkdownView = unknown;
