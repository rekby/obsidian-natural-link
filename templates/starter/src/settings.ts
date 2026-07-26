import { App, PluginSettingTab, Setting } from 'obsidian';
import type {{PLUGIN_CLASS}} from './main';

export interface {{PLUGIN_CLASS}}Settings {
	greeting: string;
}

export const DEFAULT_SETTINGS: {{PLUGIN_CLASS}}Settings = {
	greeting: 'Hello from {{PLUGIN_NAME}}',
};

export class {{PLUGIN_CLASS}}SettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: {{PLUGIN_CLASS}}) {
		super(app, plugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Greeting')
			.setDesc('Text shown by the "Say hello" command.')
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.greeting)
					.setValue(this.plugin.settings.greeting)
					.onChange(async (value) => {
						this.plugin.settings.greeting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
