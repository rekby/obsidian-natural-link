import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, type {{PLUGIN_CLASS}}Settings, {{PLUGIN_CLASS}}SettingTab } from './settings';

export default class {{PLUGIN_CLASS}} extends Plugin {
	settings: {{PLUGIN_CLASS}}Settings = { ...DEFAULT_SETTINGS };

	override async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: 'say-hello',
			name: 'Say hello',
			callback: () => {
				new Notice(this.settings.greeting);
			},
		});

		this.addSettingTab(new {{PLUGIN_CLASS}}SettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/** Demo and e2e helpers call this after patching settings — keep it public. */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
