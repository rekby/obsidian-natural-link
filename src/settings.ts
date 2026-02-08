import { App, PluginSettingTab, Setting } from "obsidian";
import type NaturalLinkPlugin from "./main";
import { t } from "./i18n";

export interface NaturalLinkSettings {
	// Reserved for future settings (e.g. language selection)
}

export const DEFAULT_SETTINGS: NaturalLinkSettings = {};

export class NaturalLinkSettingTab extends PluginSettingTab {
	plugin: NaturalLinkPlugin;

	constructor(app: App, plugin: NaturalLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t("settings.hotkey-button"))
			.setDesc(t("settings.hotkey-description"))
			.addButton((button) =>
				button.setButtonText(t("settings.hotkey-button")).onClick(() => {
					this.openHotkeySettings();
				}),
			);
	}

	private openHotkeySettings(): void {
		// Use internal Obsidian API to open hotkey settings filtered to our command.
		// This is not documented but widely used by plugins.
		// Falls back to just opening settings if the internal API changes.
		try {
			const app = this.app as App & {
				setting?: {
					open(): void;
					openTabById(id: string): void;
					activeTab?: {
						searchComponent?: {
							setValue(value: string): void;
						};
					};
				};
			};

			if (app.setting) {
				app.setting.open();
				app.setting.openTabById("hotkeys");
				// Small delay to let the tab render before setting the filter
				setTimeout(() => {
					app.setting?.activeTab?.searchComponent?.setValue(
						"Natural Link",
					);
				}, 100);
			}
		} catch {
			// Fallback: just open settings if internal API changed
			(this.app as App & { setting?: { open(): void } }).setting?.open();
		}
	}
}
