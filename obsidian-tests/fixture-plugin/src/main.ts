import { Notice, Plugin } from 'obsidian';
import { buildGreeting } from './greeting';

interface FixtureSettings {
	name: string;
}

const DEFAULT_SETTINGS: FixtureSettings = { name: 'Obsidian' };

/**
 * Minimal but real plugin, so the template's own CI exercises the full pipeline
 * — build, unit tests, e2e against a live Obsidian, demo capture. Without it a
 * breakage in `obsidian-tests/lib/` would only surface in the five downstream
 * plugins.
 */
export default class TemplateFixturePlugin extends Plugin {
	settings: FixtureSettings = { ...DEFAULT_SETTINGS };
	lastGreeting = '';

	override async onload(): Promise<void> {
		const stored = (await this.loadData()) as Partial<FixtureSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };

		this.addCommand({
			id: 'say-hello',
			name: 'Say hello',
			callback: () => {
				this.lastGreeting = buildGreeting(this.settings.name);
				new Notice(this.lastGreeting);
			},
		});
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
