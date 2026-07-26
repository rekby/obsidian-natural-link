/**
 * Obsidian stub for the template's own unit tests.
 *
 * A real plugin gets its own copy at `tests/__mocks__/obsidian.ts` (see
 * `templates/starter/`); `vitest.config.ts` prefers that one when it exists.
 */

export class Plugin {
	constructor(public app?: unknown, public manifest?: unknown) {}
	addCommand(): void {}
	addSettingTab(): void {}
	async loadData(): Promise<unknown> { return null; }
	async saveData(): Promise<void> {}
}

export class Notice {
	constructor(public message?: string) {}
}

export class TFile {
	constructor(public path: string = '') {}
}

export const moment = {
	locale: (): string => 'en',
};
