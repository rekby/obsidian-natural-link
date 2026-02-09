import { Editor, MarkdownView, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, NaturalLinkSettings, NaturalLinkSettingTab } from "./settings";
import { NaturalLinkModal } from "./ui/natural-link-modal";
import { NaturalLinkSuggest } from "./ui/natural-link-suggest";
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

		// Register inline [[ suggest (it checks the setting internally in onTrigger)
		const suggest = new NaturalLinkSuggest(this);
		this.registerEditorSuggest(suggest);

		// Once layout is ready, patch the native file suggest so ours can take over [[.
		// The native suggest is in the internal editorSuggest.suggests array.
		// This is not part of the public API but is widely used by community plugins.
		this.app.workspace.onLayoutReady(() => {
			this.patchNativeFileSuggest(suggest);
		});
	}

	/**
	 * Patch the native [[ file suggest so that it yields to our suggest
	 * when inlineLinkSuggest setting is enabled. Restores on plugin unload.
	 */
	private patchNativeFileSuggest(ownSuggest: NaturalLinkSuggest): void {
		try {
			const manager = (this.app.workspace as unknown as {
				editorSuggest?: { suggests?: unknown[] };
			}).editorSuggest;
			if (!manager?.suggests?.length) return;

			// Move our suggest to the front of the array for priority
			const suggests = manager.suggests;
			const idx = suggests.indexOf(ownSuggest);
			if (idx > 0) {
				suggests.splice(idx, 1);
				suggests.unshift(ownSuggest);
			}

			// Patch native file suggest (first non-ours suggest in the array).
			// When our inlineLinkSuggest setting is enabled, its onTrigger returns null
			// so it won't compete with ours for the [[ trigger.
			const nativeSuggest = suggests.find((s) => s !== ownSuggest) as
				| { onTrigger: (...args: unknown[]) => unknown }
				| undefined;
			if (!nativeSuggest || typeof nativeSuggest.onTrigger !== "function") return;

			const originalOnTrigger = nativeSuggest.onTrigger.bind(nativeSuggest);

			nativeSuggest.onTrigger = (...args: unknown[]) => {
				if (this.settings.inlineLinkSuggest) {
					return null;
				}
				return originalOnTrigger(...args);
			};

			// Restore original onTrigger when plugin is unloaded
			this.register(() => {
				nativeSuggest.onTrigger = originalOnTrigger;
			});
		} catch {
			// Internal API may have changed — silently ignore
		}
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
	collectNotes(): NoteInfo[] {
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
	collectUnresolvedNotes(existingNotes: NoteInfo[]): NoteInfo[] {
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
