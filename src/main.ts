import { Editor, MarkdownView, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, NaturalLinkSettings, NaturalLinkSettingTab } from "./settings";
import { NaturalLinkModal } from "./ui/natural-link-modal";
import { NotesIndex } from "./search/notes-index";
import { MultiStemmer } from "./stemming/multi-stemmer";
import { RussianStemmer } from "./stemming/russian-stemmer";
import { EnglishStemmer } from "./stemming/english-stemmer";
import { NoteInfo } from "./types";
import { t } from "./i18n";

export default class NaturalLinkPlugin extends Plugin {
	settings: NaturalLinkSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "insert-natural-link",
			name: t("command.natural-link"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.openNaturalLinkModal(editor);
			},
		});

		this.addSettingTab(new NaturalLinkSettingTab(this.app, this));
	}

	private openNaturalLinkModal(editor: Editor): void {
		const notes = this.collectNotes();
		const stemmer = new MultiStemmer([
			new RussianStemmer(),
			new EnglishStemmer(),
		]);
		const index = new NotesIndex(notes, stemmer);
		new NaturalLinkModal(this.app, editor, index).open();
	}

	/**
	 * Collect NoteInfo[] from all markdown files in the vault.
	 */
	private collectNotes(): NoteInfo[] {
		const files = this.app.vault.getMarkdownFiles();
		return files.map((file) => {
			const cache = this.app.metadataCache.getFileCache(file);
			const aliases: string[] = [];
			if (cache?.frontmatter?.aliases) {
				const raw = cache.frontmatter.aliases;
				if (Array.isArray(raw)) {
					for (const a of raw) {
						if (typeof a === "string") {
							aliases.push(a);
						}
					}
				} else if (typeof raw === "string") {
					aliases.push(raw);
				}
			}
			return {
				path: file.path,
				title: file.basename,
				aliases,
			};
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<NaturalLinkSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
