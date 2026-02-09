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

	/** Cached items from the last buildNativeSuggestItems call. */
	private lastSuggestItems: NativeSuggestItem[] = [];
	/** Original user query saved when # or ^ is pressed, used as display text later. */
	private pendingSpecialCharQuery: string | null = null;
	/** Resolved note title for the pending special char (used for query substitution in heading/block mode). */
	private pendingSpecialCharTitle: string | null = null;
	/** Editor reference saved alongside pendingSpecialCharQuery. */
	private pendingSpecialCharEditor: Editor | null = null;

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
	 * Also intercepts #, ^, | keys to support heading/block references and
	 * display-text editing while preserving the user's natural-language query.
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
			// After #/^ special-char handling, pass through to native for heading/block
			// completion with the morphological query substituted by the resolved note title.
			nativeSuggest.getSuggestions = (
				context: NativeSuggestContext,
			): NativeSuggestItem[] | Promise<NativeSuggestItem[]> => {
				if (!this.settings.inlineLinkSuggest) {
					return origGetSuggestions(context);
				}
				const query = context.query || "";
				if (query.trim().length === 0) {
					this.clearPendingSpecialChar();
					return origGetSuggestions(context);
				}

				// Handle heading (#) or block (^) reference in the query.
				// This covers two cases:
				// 1. The native suggest called selectSuggestion on # / ^ (pendingSpecialCharTitle is set)
				// 2. The # / ^ was typed directly into the query text (first-time detection)
				const specialIdx = this.findSpecialCharIndex(query);
				if (specialIdx > 0) {
					return this.handleHeadingBlockQuery(
						context, query, specialIdx, origGetSuggestions,
					);
				}

				// No # or ^ in the query — clear any stale heading/block state
				if (this.pendingSpecialCharQuery !== null) {
					this.clearPendingSpecialChar();
				}

				return this.buildNativeSuggestItems(query);
			};

			// Wrap selectSuggestion: when enabled, insert piped wikilink
			// [[Title|userInput]] instead of the native [[Title]] format.
			// When #/^ triggers a native selection (heading/block mode transition),
			// save the query and let native handle it; when heading/block is later
			// selected, append |savedQuery as display text.
			nativeSuggest.selectSuggestion = (
				item: NativeSuggestItem,
				evt: MouseEvent | KeyboardEvent,
			): void => {
				if (!this.settings.inlineLinkSuggest) {
					origSelectSuggestion(item, evt);
					return;
				}
				if (this.pendingSpecialCharQuery !== null) {
					this.handlePostSpecialCharSelect(
						nativeSuggest, item, evt, origSelectSuggestion,
					);
					return;
				}

				// Detect native suggest transitioning to heading/block mode via # or ^.
				// The native suggest calls selectSuggestion when # or ^ is typed,
				// accepting the current file and switching to heading/block completion.
				// We save the original query for use as display text, let native handle
				// the transition, then insert |query before ]] so the user can see the
				// display text while browsing headings/blocks.
				if (evt instanceof KeyboardEvent && (evt.key === '#' || evt.key === '^')) {
					const ctx = nativeSuggest.context;
					const query = (ctx?.query || "").trim();
					if (query.length > 0) {
						this.pendingSpecialCharQuery = query;
						this.pendingSpecialCharEditor = ctx?.editor ?? null;
						this.pendingSpecialCharTitle = this.getLinkTitle(item, query);
						this.recordNoteSelection(this.pendingSpecialCharTitle);
					}
					origSelectSuggestion(item, evt);

					// Insert |query before ]] so the display text is visible
					// while the user browses headings/blocks.
					if (query.length > 0 && this.pendingSpecialCharEditor) {
						const editor = this.pendingSpecialCharEditor;
						const savedCursor = editor.getCursor();
						const line = editor.getLine(savedCursor.line);
						const closeBracketIdx = line.indexOf(']]', savedCursor.ch);
						if (closeBracketIdx >= 0) {
							const pipeText = `|${query}`;
							const insertPos: EditorPosition = {
								line: savedCursor.line, ch: closeBracketIdx,
							};
							editor.replaceRange(pipeText, insertPos, insertPos);
							// Keep cursor in the heading/block part, not in display text
							editor.setCursor(savedCursor);
						}
					}
					return;
				}

				this.insertPipedLink(nativeSuggest, item, evt);
			};

			// Intercept | key in the native suggest to handle display-text mode.
			// (# and ^ are handled in selectSuggestion / getSuggestions instead,
			// because the native suggest processes them via its own key handler first.)
			const keyHandler = (evt: KeyboardEvent): void => {
				if (!this.settings.inlineLinkSuggest) return;
				if (!nativeSuggest.context) return;

				// Clean up pending state on Escape
				if (evt.key === 'Escape') {
					this.clearPendingSpecialChar();
					return;
				}

				const query = nativeSuggest.context.query || "";
				if (query.trim().length === 0) return;

				// Already in heading/block/pipe mode — don't intercept
				if (query.includes('#') || query.includes('^') || query.includes('|')) return;

				// Don't intercept with Ctrl/Cmd/Alt modifiers
				if (evt.ctrlKey || evt.metaKey || evt.altKey) return;

				if (evt.key === '|') {
					const selectedItem = this.getSelectedSuggestItem(nativeSuggest);
					const item = selectedItem ?? this.lastSuggestItems[0];
					if (!item) return;

					evt.preventDefault();
					evt.stopPropagation();
					this.handleSpecialCharInSuggest(nativeSuggest, evt.key, item);
				}
			};
			document.addEventListener('keydown', keyHandler, true);

			// Restore originals on plugin unload
			this.register(() => {
				nativeSuggest.getSuggestions = origGetSuggestions;
				nativeSuggest.selectSuggestion = origSelectSuggestion;
				document.removeEventListener('keydown', keyHandler, true);
				this.clearPendingSpecialChar();
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
		const boosted = this.recentNotes.boostRecent(
			combined,
			(item) => this.suggestItemTitle(item),
			MAX_BOOST_COUNT,
		);
		this.lastSuggestItems = boosted;
		return boosted;
	}

	/**
	 * Extract the link target title from a NativeSuggestItem.
	 * Markdown files: basename (without .md). Non-markdown: full filename with extension.
	 */
	private getLinkTitle(item: NativeSuggestItem, fallbackQuery: string): string {
		const fileTyped = item.file as TAbstractFile & { basename?: string; name?: string; extension?: string } | null | undefined;
		if (fileTyped?.basename) {
			return fileTyped.extension === "md" ? fileTyped.basename : (fileTyped.name ?? fileTyped.basename);
		}
		if (item.linktext) {
			return item.linktext;
		}
		return (item.path || fallbackQuery).replace(/\.md$/, "");
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

		const title = this.getLinkTitle(item, query);

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

	/**
	 * Try to read the currently selected item from the native suggest's
	 * internal chooser. Returns null if the internal API is not available.
	 */
	private getSelectedSuggestItem(suggest: NativeSuggest): NativeSuggestItem | null {
		try {
			const internal = suggest as NativeSuggest & {
				suggestions?: { selectedItem?: number; values?: NativeSuggestItem[] };
			};
			const idx = internal.suggestions?.selectedItem ?? 0;
			const values = internal.suggestions?.values;
			if (Array.isArray(values) && values.length > 0) {
				return values[idx] ?? values[0] ?? null;
			}
		} catch { /* internal API not available */ }
		return null;
	}

	/** Clear all pending special-char state. */
	private clearPendingSpecialChar(): void {
		this.pendingSpecialCharQuery = null;
		this.pendingSpecialCharTitle = null;
		this.pendingSpecialCharEditor = null;
	}

	/**
	 * Find the position of the first # or ^ in the query (only if at position > 0,
	 * i.e. there is a note query part before the special char).
	 * Returns -1 if not found.
	 */
	private findSpecialCharIndex(query: string): number {
		for (let i = 1; i < query.length; i++) {
			if (query[i] === '#' || query[i] === '^') return i;
		}
		return -1;
	}

	/**
	 * Handle a query that contains # or ^ for heading/block reference.
	 *
	 * If `pendingSpecialCharTitle` is already set (the native suggest called
	 * selectSuggestion on #/^), uses the saved title. Otherwise resolves
	 * the note query via morphological search and saves the state.
	 *
	 * Substitutes the morphological query part with the resolved note title
	 * and passes to the native getSuggestions for heading/block completion.
	 */
	private handleHeadingBlockQuery(
		context: NativeSuggestContext,
		query: string,
		specialIdx: number,
		origGetSuggestions: (ctx: NativeSuggestContext) => NativeSuggestItem[] | Promise<NativeSuggestItem[]>,
	): NativeSuggestItem[] | Promise<NativeSuggestItem[]> {
		const specialPart = query.substring(specialIdx); // e.g. "#heading" or "^block"

		// If we already resolved the note title (set via selectSuggestion for #/^)
		if (this.pendingSpecialCharTitle) {
			const modifiedContext: NativeSuggestContext = {
				...context,
				query: this.pendingSpecialCharTitle + specialPart,
			};
			return origGetSuggestions(modifiedContext);
		}

		// First time seeing # or ^ in the query (typed directly, native didn't call
		// selectSuggestion). Resolve the note via morphological search.
		const noteQuery = query.substring(0, specialIdx).trim();
		if (noteQuery.length === 0) {
			return origGetSuggestions(context);
		}

		const items = this.buildNativeSuggestItems(noteQuery);
		if (items.length === 0) {
			return origGetSuggestions(context);
		}

		const topItem = items[0]!;
		const title = this.getLinkTitle(topItem, noteQuery);

		this.pendingSpecialCharQuery = noteQuery;
		this.pendingSpecialCharTitle = title;
		this.pendingSpecialCharEditor = context.editor;
		this.recordNoteSelection(title);

		const modifiedContext: NativeSuggestContext = {
			...context,
			query: title + specialPart,
		};
		return origGetSuggestions(modifiedContext);
	}

	/**
	 * Handle | pressed while the native suggest is showing our morphological
	 * search results. Inserts [[NoteTitle|query]] with cursor before ]] so
	 * the user can keep typing display text.
	 */
	private handleSpecialCharInSuggest(
		suggest: NativeSuggest,
		_char: string,
		item: NativeSuggestItem,
	): void {
		const ctx = suggest.context;
		if (!ctx) return;

		const query = (ctx.query || "").trim();
		if (query.length === 0) return;

		const title = this.getLinkTitle(item, query);
		this.insertLinkWithCursorBeforeClose(suggest, title, query);
	}

	/**
	 * Insert [[Title|query]] with cursor placed right before ]] so the user
	 * can continue typing display text. Used when | is pressed in the suggest.
	 */
	private insertLinkWithCursorBeforeClose(
		suggest: NativeSuggest,
		title: string,
		query: string,
	): void {
		const ctx = suggest.context;
		if (!ctx) return;

		const editor = ctx.editor;
		const link = `[[${title}|${query}]]`;

		const startLine = editor.getLine(ctx.start.line);
		let fromCh = ctx.start.ch;
		if (fromCh >= 2 && startLine.substring(fromCh - 2, fromCh) === '[[') {
			fromCh -= 2;
		}
		const from: EditorPosition = { line: ctx.start.line, ch: fromCh };

		const endLine = editor.getLine(ctx.end.line);
		let toCh = ctx.end.ch;
		if (endLine.substring(toCh, toCh + 2) === ']]') {
			toCh += 2;
		}
		const to: EditorPosition = { line: ctx.end.line, ch: toCh };

		editor.replaceRange(link, from, to);

		// Cursor before ]]
		editor.setCursor({ line: from.line, ch: from.ch + link.length - 2 });

		suggest.close();
		this.recordNoteSelection(title);
	}

	/**
	 * Called when selectSuggestion fires after a #/^ special-char was pressed.
	 * Delegates to the native selectSuggestion (which inserts [[NoteTitle#heading]]),
	 * then inserts |savedQuery before ]] so the final result is [[NoteTitle#heading|query]].
	 */
	private handlePostSpecialCharSelect(
		_suggest: NativeSuggest,
		item: NativeSuggestItem,
		evt: MouseEvent | KeyboardEvent,
		origSelectSuggestion: (item: NativeSuggestItem, evt: MouseEvent | KeyboardEvent) => void,
	): void {
		const savedQuery = this.pendingSpecialCharQuery;
		const editor = this.pendingSpecialCharEditor;
		this.clearPendingSpecialChar();

		if (!savedQuery || !editor) {
			origSelectSuggestion(item, evt);
			return;
		}

		// Shift+Enter in heading/block mode: pass through without display text
		if (evt instanceof KeyboardEvent && evt.shiftKey) {
			origSelectSuggestion(item, evt);
			return;
		}

		// Let native insert the heading/block link (e.g. [[NoteTitle#heading]])
		origSelectSuggestion(item, evt);

		// Append |savedQuery before the closing ]]
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const textUpToCursor = line.substring(0, cursor.ch);
		const closeBracketIdx = textUpToCursor.lastIndexOf(']]');

		if (closeBracketIdx >= 0) {
			// Only add display text if the link doesn't already have a pipe
			const openBracketIdx = textUpToCursor.lastIndexOf('[[');
			if (openBracketIdx >= 0) {
				const linkContent = textUpToCursor.substring(openBracketIdx + 2, closeBracketIdx);
				if (linkContent.includes('|')) {
					// Link already has display text — don't add another
					return;
				}
			}
			const pipeText = `|${savedQuery}`;
			const insertPos: EditorPosition = { line: cursor.line, ch: closeBracketIdx };
			editor.replaceRange(pipeText, insertPos, insertPos);
			editor.setCursor({ line: cursor.line, ch: closeBracketIdx + pipeText.length + 2 });
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
