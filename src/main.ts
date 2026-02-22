import { Editor, MarkdownView, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, NaturalLinkSettings, NaturalLinkSettingTab } from "./settings";
import { NaturalLinkModal } from "./ui/natural-link-modal";
import { NaturalLinkSuggest } from "./ui/natural-link-suggest";
import { LinkSuggestCore } from "./ui/link-suggest-core";
import { NotesIndex } from "./search/notes-index";
import { RecentNotes } from "./search/recent-notes";
import { MultiStemmer } from "./stemming/multi-stemmer";
import { RussianStemmer } from "./stemming/russian-stemmer";
import { EnglishStemmer } from "./stemming/english-stemmer";
import { NoteInfo } from "./types";
import { t } from "./i18n";

export default class NaturalLinkPlugin extends Plugin {
	settings: NaturalLinkSettings;
	recentNotes: RecentNotes;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "insert-link",
			name: t("command.natural-link"),
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				this.openNaturalLinkModal(editor);
			},
		});

		this.addSettingTab(new NaturalLinkSettingTab(this.app, this));

		const suggest = new NaturalLinkSuggest(this);
		this.registerEditorSuggest(suggest);

		// The native [[ suggest is registered before plugin suggests, so it
		// claims the [[ trigger first.  Move ours to the front of the array
		// so onTrigger is checked before the native one.  When our setting is
		// disabled, onTrigger returns null and the native suggest still works.
		this.app.workspace.onLayoutReady(() => {
			this.prioritizeSuggest(suggest);
		});
	}

	private prioritizeSuggest(suggest: NaturalLinkSuggest): void {
		try {
			const manager = (
				this.app.workspace as unknown as { editorSuggest?: { suggests: unknown[] } }
			).editorSuggest;
			if (!manager?.suggests) return;
			const idx = manager.suggests.indexOf(suggest);
			if (idx > 0) {
				manager.suggests.splice(idx, 1);
				manager.suggests.unshift(suggest);
			}
		} catch {
			// Internal API may have changed — suggest still works, just lower priority
		}
	}

	// ----- Modal -----

	private openNaturalLinkModal(editor: Editor): void {
		const notes = this.collectNotes();
		const stemmer = new MultiStemmer([new RussianStemmer(), new EnglishStemmer()]);
		const index = new NotesIndex(notes, stemmer);

		const core = new LinkSuggestCore({
			app: this.app,
			collectNotes: () => this.collectNotes(),
			stemmer,
			recentNotes: this.recentNotes,
			searchNonExistingNotes: () => this.settings.searchNonExistingNotes,
			prebuiltIndex: index,
		});

		new NaturalLinkModal(
			this.app,
			editor,
			core,
			(title) => this.recordNoteSelection(title),
		).open();
	}

	// ----- Note collection -----

	collectNotes(): NoteInfo[] {
		const files = this.app.vault.getMarkdownFiles();
		const notes: NoteInfo[] = files.map((file) => {
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
			return { path: file.path, title: file.basename, aliases };
		});

		if (this.settings.searchNonExistingNotes) {
			notes.push(...this.collectUnresolvedNotes(notes));
		}
		return notes;
	}

	private collectUnresolvedNotes(existingNotes: NoteInfo[]): NoteInfo[] {
		const existingTitles = new Set(existingNotes.map((n) => n.title.toLowerCase()));
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks;
		const seenTitles = new Set<string>();
		const result: NoteInfo[] = [];

		for (const destinations of Object.values(unresolvedLinks)) {
			for (const linkText of Object.keys(destinations)) {
				const lower = linkText.toLowerCase();
				if (existingTitles.has(lower) || seenTitles.has(lower)) continue;
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

	// ----- Settings & persistence -----

	async loadSettings() {
		const data = (await this.loadData()) as Partial<NaturalLinkSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		const recentRaw = this.app.loadLocalStorage("natural-link-recentNotes") as string | null;
		const recentData = recentRaw
			? (JSON.parse(recentRaw) as Record<string, number>)
			: undefined;
		this.recentNotes = new RecentNotes(recentData);
	}

	async saveSettings() {
		await this.saveData({ ...this.settings });
	}

	saveRecentNotes() {
		this.app.saveLocalStorage(
			"natural-link-recentNotes",
			JSON.stringify(this.recentNotes.toJSON()),
		);
	}

	recordNoteSelection(title: string): void {
		this.recentNotes.record(title);
		this.saveRecentNotes();
	}
}
