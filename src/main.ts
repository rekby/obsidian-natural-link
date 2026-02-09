import { Editor, EditorPosition, MarkdownView, Plugin, TAbstractFile } from "obsidian";
import { DEFAULT_SETTINGS, NaturalLinkSettings, NaturalLinkSettingTab } from "./settings";
import { NaturalLinkModal } from "./ui/natural-link-modal";
import { NotesIndex } from "./search/notes-index";
import { RecentNotes, MAX_BOOST_COUNT } from "./search/recent-notes";
import { MultiStemmer } from "./stemming/multi-stemmer";
import { RussianStemmer } from "./stemming/russian-stemmer";
import { EnglishStemmer } from "./stemming/english-stemmer";
import { NoteInfo, SearchResult } from "./types";
import { t } from "./i18n";

/**
 * Internal Obsidian types for the native [[ file suggest.
 * Not part of the public API — used by community plugins via editorSuggest.suggests.
 */
interface NativeSuggestContext {
	editor: Editor;
	start: EditorPosition;
	end: EditorPosition;
	query: string;
}

interface NativeSuggestItem {
	type: string;
	file?: TAbstractFile | null;
	path: string;
	alias?: string;
	linktext?: string;
	score: number;
	matches: null;
}

interface NativeSuggest {
	getSuggestions: (context: NativeSuggestContext) => NativeSuggestItem[] | Promise<NativeSuggestItem[]>;
	selectSuggestion: (item: NativeSuggestItem, evt: MouseEvent | KeyboardEvent) => void;
	context: NativeSuggestContext | null;
	close: () => void;
}

interface EditorSuggestManager {
	suggests: NativeSuggest[];
}

export default class NaturalLinkPlugin extends Plugin {
	settings: NaturalLinkSettings;
	recentNotes: RecentNotes;

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

		// Patch the native [[ suggest once layout is ready.
		// Wraps getSuggestions and selectSuggestion on the built-in file suggest
		// to use our morphological search when the setting is enabled.
		// Uses internal API (editorSuggest.suggests) — widely used by community plugins.
		this.app.workspace.onLayoutReady(() => {
			this.patchNativeSuggest();
		});
	}

	/**
	 * Wrap the native [[ file suggest's getSuggestions and selectSuggestion
	 * to inject morphological search results when inlineLinkSuggest is enabled.
	 * The native suggest handles all UI, triggering, and keyboard navigation.
	 * Originals are restored on plugin unload.
	 */
	private patchNativeSuggest(): void {
		try {
			const manager = (
				this.app.workspace as unknown as { editorSuggest?: EditorSuggestManager }
			).editorSuggest;
			if (!manager?.suggests?.length) return;

			const nativeSuggest = manager.suggests[0];
			if (
				!nativeSuggest ||
				typeof nativeSuggest.getSuggestions !== "function" ||
				typeof nativeSuggest.selectSuggestion !== "function"
			) {
				return;
			}

			const origGetSuggestions =
				nativeSuggest.getSuggestions.bind(nativeSuggest);
			const origSelectSuggestion =
				nativeSuggest.selectSuggestion.bind(nativeSuggest);

			// Wrap getSuggestions: when enabled and query is non-empty,
			// return morphological search results in native item format.
			nativeSuggest.getSuggestions = (
				context: NativeSuggestContext,
			): NativeSuggestItem[] | Promise<NativeSuggestItem[]> => {
				if (!this.settings.inlineLinkSuggest) {
					return origGetSuggestions(context);
				}
				const query = context.query || "";
				if (query.trim().length === 0) {
					// Empty query — show the native file list as usual
					return origGetSuggestions(context);
				}
				return this.buildNativeSuggestItems(query);
			};

			// Wrap selectSuggestion: when enabled, insert piped wikilink
			// [[Title|userInput]] instead of the native [[Title]] format.
			nativeSuggest.selectSuggestion = (
				item: NativeSuggestItem,
				evt: MouseEvent | KeyboardEvent,
			): void => {
				if (!this.settings.inlineLinkSuggest) {
					origSelectSuggestion(item, evt);
					return;
				}
				this.insertPipedLink(nativeSuggest, item, evt);
			};

			// Restore originals on plugin unload
			this.register(() => {
				nativeSuggest.getSuggestions = origGetSuggestions;
				nativeSuggest.selectSuggestion = origSelectSuggestion;
			});
		} catch {
			// Internal API may have changed — silently ignore
		}
	}

	/**
	 * Run morphological search and map results to the native suggest item format
	 * so renderSuggestion and the rest of the native UI work unchanged.
	 * Markdown notes are found via morphological search (displayed without .md).
	 * Non-markdown files are matched by substring (displayed with their extension).
	 */
	private buildNativeSuggestItems(query: string): NativeSuggestItem[] {
		// 1. Morphological search for markdown notes
		const notes = this.collectNotes();
		if (this.settings.searchNonExistingNotes) {
			notes.push(...this.collectUnresolvedNotes(notes));
		}
		const stemmer = new MultiStemmer([
			new RussianStemmer(),
			new EnglishStemmer(),
		]);
		const index = new NotesIndex(notes, stemmer);
		const results = index.search(query);

		const mdItems = results.map((result: SearchResult): NativeSuggestItem => {
			// Strip .md extension — native suggest shows markdown notes without it
			const displayPath = result.note.path.replace(/\.md$/, "");

			if (result.note.exists === false) {
				return {
					type: "linktext",
					linktext: result.note.title,
					path: result.note.title,
					score: 0,
					matches: null,
				};
			}
			const file = this.app.vault.getAbstractFileByPath(result.note.path);
			if (result.matchedAlias) {
				return {
					type: "alias",
					file,
					path: displayPath,
					alias: result.matchedAlias,
					score: 0,
					matches: null,
				};
			}
			return {
				type: "file",
				file,
				path: displayPath,
				score: 0,
				matches: null,
			};
		});

		// 2. Simple substring match for non-markdown files (images, PDFs, etc.)
		const lowerQuery = query.toLowerCase();
		const nonMdItems: NativeSuggestItem[] = this.app.vault
			.getFiles()
			.filter((f) => f.extension !== "md")
			.filter(
				(f) =>
					f.basename.toLowerCase().includes(lowerQuery) ||
					f.path.toLowerCase().includes(lowerQuery),
			)
			.map((f): NativeSuggestItem => ({
				type: "file",
				file: f,
				path: f.path, // keep extension for non-markdown files
				score: 0,
				matches: null,
			}));

		const combined = [...mdItems, ...nonMdItems];
		return this.recentNotes.boostRecent(
			combined,
			(item) => this.suggestItemTitle(item),
			MAX_BOOST_COUNT,
		);
	}

	/**
	 * Insert a piped wikilink [[Title|query]] at the suggest trigger location.
	 * Handles Shift+Enter for raw link insertion and auto-inserted ]].
	 */
	private insertPipedLink(
		suggest: NativeSuggest,
		item: NativeSuggestItem,
		evt: MouseEvent | KeyboardEvent,
	): void {
		const ctx = suggest.context;
		if (!ctx) return;

		const query = (ctx.query || "").trim();

		// Determine note title from the native item.
		// For markdown files, use basename (without .md) — Obsidian resolves them by name.
		// For non-markdown files, use the full filename with extension — otherwise the link breaks.
		let title: string;
		const fileTyped = item.file as TAbstractFile & { basename?: string; name?: string; extension?: string } | null | undefined;
		if (fileTyped?.basename) {
			title = fileTyped.extension === "md" ? fileTyped.basename : (fileTyped.name ?? fileTyped.basename);
		} else if (item.linktext) {
			title = item.linktext;
		} else {
			title = (item.path || query).replace(/\.md$/, "");
		}

		let link: string;
		if (evt instanceof KeyboardEvent && evt.shiftKey) {
			link = `[[${query}|${query}]]`;
		} else {
			link = `[[${title}|${query}]]`;
			this.recordNoteSelection(title);
		}

		const editor = ctx.editor;
		const startLine = editor.getLine(ctx.start.line);

		// Find where [[ begins (start may be at [[ or right after it)
		let fromCh = ctx.start.ch;
		if (fromCh >= 2 && startLine.substring(fromCh - 2, fromCh) === "[[") {
			fromCh -= 2;
		}
		const from: EditorPosition = { line: ctx.start.line, ch: fromCh };

		// Handle auto-inserted ]] after cursor
		const endLine = editor.getLine(ctx.end.line);
		let toCh = ctx.end.ch;
		if (endLine.substring(toCh, toCh + 2) === "]]") {
			toCh += 2;
		}
		const to: EditorPosition = { line: ctx.end.line, ch: toCh };

		editor.replaceRange(link, from, to);
		editor.setCursor({ line: from.line, ch: from.ch + link.length });
		suggest.close();
	}

	/**
	 * Extract the title key from a NativeSuggestItem — matching the logic used
	 * when recording a selection in insertPipedLink.
	 * Markdown files: basename (without .md). Non-markdown: full filename with extension.
	 */
	private suggestItemTitle(item: NativeSuggestItem): string {
		const f = item.file as TAbstractFile & { basename?: string; name?: string; extension?: string } | null | undefined;
		if (f?.basename) {
			return f.extension === "md" ? f.basename : (f.name ?? f.basename);
		}
		return item.linktext || item.path;
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
		new NaturalLinkModal(
			this.app,
			editor,
			index,
			this.recentNotes,
			(title) => this.recordNoteSelection(title),
		).open();
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
		this.app.saveLocalStorage("natural-link-recentNotes", JSON.stringify(this.recentNotes.toJSON()));
	}

	private recordNoteSelection(title: string): void {
		this.recentNotes.record(title);
		this.saveRecentNotes();
	}
}
