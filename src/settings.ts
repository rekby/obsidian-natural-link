import { App, PluginSettingTab, Setting } from "obsidian";
import type NaturalLinkPlugin from "./main";
import { t } from "./i18n";

export interface NaturalLinkSettings {
	/** Schema version for future migrations */
	version: number;
	/** Whether to include unresolved links (non-existing notes) in search results */
	searchNonExistingNotes: boolean;
}

export const DEFAULT_SETTINGS: NaturalLinkSettings = {
	version: 1,
	searchNonExistingNotes: true,
};

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
			.setName(t("settings.search-non-existing-notes"))
			.setDesc(t("settings.search-non-existing-notes-description"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.searchNonExistingNotes)
					.onChange(async (value) => {
						this.plugin.settings.searchNonExistingNotes = value;
						await this.plugin.saveSettings();
					}),
			);

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
							inputEl?: HTMLInputElement;
						};
					};
				};
			};

			if (app.setting) {
				app.setting.open();
				app.setting.openTabById("hotkeys");
				// Delay to let the tab render before setting the filter
				setTimeout(() => {
					const searchComponent = app.setting?.activeTab?.searchComponent;
					if (searchComponent) {
						searchComponent.setValue("Natural Link");
						// Dispatch input event to trigger the actual filtering
						searchComponent.inputEl?.dispatchEvent(
							new Event("input", { bubbles: true }),
						);
					}
				}, 100);
			}
		} catch {
			// Fallback: just open settings if internal API changed
			(this.app as App & { setting?: { open(): void } }).setting?.open();
		}
	}
}
