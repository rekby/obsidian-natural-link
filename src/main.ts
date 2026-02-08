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
			id: "insert-link",
			name: t("command.natural-link"),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.openNaturalLinkModal(editor);
			},
		});

		this.addSettingTab(new NaturalLinkSettingTab(this.app, this));
	}

	private openNaturalLinkModal(editor: Editor): void {
		const notes = this.collectNotes();
		if (this.settings.searchNonExistingNotes) {
			const unresolvedNotes = this.collectUnresolvedNotes(notes);
			notes.push(...unresolvedNotes);
		}
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
				const raw: unknown = cache.frontmatter.aliases;
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

	/**
	 * Collect NoteInfo[] from unresolved links (references to notes that don't exist yet).
	 * Deduplicates against existing notes and within unresolved links themselves.
	 */
	private collectUnresolvedNotes(existingNotes: NoteInfo[]): NoteInfo[] {
		const existingTitles = new Set(existingNotes.map((n) => n.title.toLowerCase()));
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks;
		const seenTitles = new Set<string>();
		const result: NoteInfo[] = [];

		for (const destinations of Object.values(unresolvedLinks)) {
			for (const linkText of Object.keys(destinations)) {
				const lower = linkText.toLowerCase();
				if (existingTitles.has(lower) || seenTitles.has(lower)) {
					continue;
				}
				seenTitles.add(lower);
				result.push({
					path: `${linkText}.md`,
					title: linkText,
					aliases: [],
					exists: false,
				});
			}
		}
		return result;
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
