import { App, Instruction, TFile } from "obsidian";
import { NotesIndex } from "../search/notes-index";
import { RecentNotes, MAX_BOOST_COUNT } from "../search/recent-notes";
import { NoteInfo, Stemmer, LinkSuggestion } from "../types";
import { parseQuery, ParsedQuery } from "./query-parser";
import { t } from "../i18n";

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BLOCK_ID_LENGTH = 6;
const BLOCK_ID_CHARS = "0123456789abcdef";
const BLOCK_TEXT_MAX_LENGTH = 120;

/**
 * Shared logic for both the SuggestModal and the EditorSuggest.
 *
 * Handles query parsing, morphological search, heading/block sub-link
 * resolution, suggestion rendering, and wikilink construction.
 *
 * Both UIs instantiate this core and delegate their Obsidian callbacks to it.
 */
export class LinkSuggestCore {
	private readonly app: App;
	private readonly collectNotes: () => NoteInfo[];
	private readonly stemmer: Stemmer;
	private readonly recentNotes: RecentNotes;

	/**
	 * Optional pre-built index (used by the modal which builds once on open).
	 * When null, a fresh index is built on every getSuggestions call
	 * (used by the EditorSuggest).
	 */
	private cachedIndex: NotesIndex | null;

	constructor(opts: {
		app: App;
		collectNotes: () => NoteInfo[];
		stemmer: Stemmer;
		recentNotes: RecentNotes;
		prebuiltIndex?: NotesIndex;
	}) {
		this.app = opts.app;
		this.collectNotes = opts.collectNotes;
		this.stemmer = opts.stemmer;
		this.recentNotes = opts.recentNotes;
		this.cachedIndex = opts.prebuiltIndex ?? null;
	}

	// ----- Suggestions -----

	async getSuggestions(query: string, selectedNote?: NoteInfo): Promise<LinkSuggestion[]> {
		if (query.trim().length === 0) {
			return this.getRecentSuggestions();
		}

		const parsed = parseQuery(query);

		const hasSubLink = parsed.headingPart !== undefined || parsed.blockPart !== undefined;
		if (hasSubLink) {
			return this.getSubLinkSuggestions(parsed, selectedNote);
		}

		return this.getNoteSuggestions(parsed.notePart);
	}

	// ----- Rendering -----

	renderSuggestion(item: LinkSuggestion, el: HTMLElement): void {
		switch (item.type) {
			case "note":
				this.renderNoteSuggestion(item, el);
				break;
			case "heading":
				this.renderHeadingSuggestion(item, el);
				break;
			case "block":
				this.renderBlockSuggestion(item, el);
				break;
		}
	}

	// ----- Link building -----

	/**
	 * Build a piped wikilink string from a suggestion and the raw query.
	 * When `asTyped` is true, the raw query is used as both target and display
	 * (Shift+Enter "insert as typed" behaviour).
	 *
	 * @param explicitDisplay — when defined, overrides the display text
	 *   derived from the query.  Used when editing an existing link to
	 *   preserve (or omit) the original display text.
	 */
	buildLink(
		item: LinkSuggestion,
		rawQuery: string,
		asTyped: boolean,
		explicitDisplay?: string,
	): string {
		if (asTyped) {
			const raw = rawQuery.trim();
			return `[[${raw}|${raw}]]`;
		}

		const display = explicitDisplay !== undefined
			? explicitDisplay
			: this.getDisplayText(rawQuery);
		const target = this.getLinkTarget(item);
		if (display.length === 0) {
			return `[[${target}]]`;
		}
		return `[[${target}|${display}]]`;
	}

	/**
	 * Build a raw "as typed" link from just the query string.
	 */
	buildRawLink(rawQuery: string): string {
		const raw = rawQuery.trim();
		return `[[${raw}|${raw}]]`;
	}

	/**
	 * Return the note title for recording in RecentNotes.
	 */
	getNoteTitle(item: LinkSuggestion): string {
		return item.note.title;
	}

	/**
	 * For block suggestions without an existing ID, generate a unique one
	 * and set it on the item.  Must be called before buildLink() so the
	 * link target contains the ID.
	 */
	prepareBlockId(item: LinkSuggestion): void {
		if (item.type !== "block" || item.blockId || !item.needsWrite) return;
		const allIds = this.collectAllBlockIds();
		item.blockId = this.generateUniqueBlockId(allIds);
	}

	/**
	 * If the block suggestion needed a new ID (needsWrite is set),
	 * append ` ^{blockId}` to the corresponding line in the file.
	 * Uses vault.process() for atomic modification.
	 * Call prepareBlockId() first.
	 */
	async writeBlockIdIfNeeded(item: LinkSuggestion): Promise<void> {
		if (item.type !== "block" || !item.needsWrite || !item.blockId) return;
		const file = this.app.vault.getAbstractFileByPath(item.note.path);
		if (!file || !(file instanceof TFile)) return;

		const lineNum = item.needsWrite.line;
		const id = item.blockId;
		await this.app.vault.process(file, (data) => {
			const lines = data.split("\n");
			if (lineNum >= 0 && lineNum < lines.length) {
				lines[lineNum] = `${lines[lineNum]} ^${id}`;
			}
			return lines.join("\n");
		});
	}

	// ----- Shared instruction set for both UIs -----

	static getInstructions(): Instruction[] {
		return [
			{ command: "↑↓", purpose: t("modal.instruction.navigate") },
			{ command: "↵", purpose: t("modal.instruction.insert-link") },
			{ command: "shift ↵", purpose: t("modal.instruction.insert-as-typed") },
			{ command: "esc", purpose: t("modal.instruction.dismiss") },
		];
	}

	// ----- Private helpers -----

	private getIndex(): NotesIndex {
		if (this.cachedIndex) return this.cachedIndex;
		const notes = this.collectNotes();
		return new NotesIndex(notes, this.stemmer);
	}

	private getNoteSuggestions(notePart: string): LinkSuggestion[] {
		const index = this.getIndex();
		const results = index.search(notePart);
		const suggestions: LinkSuggestion[] = results.map((r) => ({
			type: "note" as const,
			note: r.note,
			matchedAlias: r.matchedAlias,
		}));
		return this.recentNotes.boostRecent(suggestions, (s) => s.note.title, MAX_BOOST_COUNT);
	}

	/**
	 * When the query contains # or ^, resolve the best matching note first,
	 * then return its headings or blocks filtered by the sub-link prefix.
	 */
	private async getSubLinkSuggestions(parsed: ParsedQuery, selectedNote?: NoteInfo): Promise<LinkSuggestion[]> {
		const noteResults = parsed.notePart.trim().length > 0
			? this.getNoteSuggestions(parsed.notePart)
			: this.getRecentSuggestions();

		// Use the explicitly selected note if provided (from the UI's
		// highlighted item); otherwise fall back to the best search result.
		const bestNote = selectedNote ?? noteResults[0]?.note;
		if (!bestNote) return [];

		const file = this.app.vault.getAbstractFileByPath(bestNote.path);
		if (!file || !(file instanceof TFile)) return noteResults;

		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache) return noteResults;

		if (parsed.headingPart !== undefined) {
			return this.filterHeadings(bestNote, cache.headings ?? [], parsed.headingPart);
		}
		if (parsed.blockPart !== undefined) {
			return this.buildBlockSuggestions(bestNote, file, cache, parsed.blockPart);
		}

		return noteResults;
	}

	private filterHeadings(
		note: NoteInfo,
		headings: Array<{ heading: string; level: number }>,
		query: string,
	): LinkSuggestion[] {
		if (query.trim().length === 0) {
			return headings.map((h) => ({
				type: "heading" as const,
				note,
				heading: h.heading,
				level: h.level,
			}));
		}

		const matched = this.searchTexts(
			headings.map((h) => h.heading),
			query,
		);
		return matched.map((i) => ({
			type: "heading" as const,
			note,
			heading: headings[i]!.heading,
			level: headings[i]!.level,
		}));
	}

	/**
	 * Build block suggestions from all sections in the note.
	 * Sections with existing ^id markers keep their IDs.
	 * Sections without IDs get a generated unique one (written on selection).
	 */
	private async buildBlockSuggestions(
		note: NoteInfo,
		file: TFile,
		cache: { sections?: Array<{ id?: string; type: string; position: { start: { line: number }; end: { line: number } } }> },
		query: string,
	): Promise<LinkSuggestion[]> {
		const sections = cache.sections ?? [];
		if (sections.length === 0) return [];

		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");

		interface BlockCandidate {
			preview: string;
			existingId?: string;
			endLine: number;
		}
		const candidates: BlockCandidate[] = [];
		for (const section of sections) {
			const firstLine = lines[section.position.start.line];
			if (!firstLine || firstLine.trim().length === 0) continue;
			if (section.type === "yaml") continue;

			let preview = firstLine.trim();
			const existingId = section.id;
			if (existingId) {
				preview = preview.replace(new RegExp(`\\s*\\^${escapeRegExp(existingId)}$`), "");
			}
			preview = preview.substring(0, BLOCK_TEXT_MAX_LENGTH);
			candidates.push({ preview, existingId, endLine: section.position.end.line });
		}

		let orderedIndices: number[];
		if (query.trim().length === 0) {
			orderedIndices = candidates.map((_, i) => i);
		} else {
			const searchTexts = candidates.map((c) =>
				c.existingId ? `${c.preview} ${c.existingId}` : c.preview,
			);
			orderedIndices = this.searchTexts(searchTexts, query);
		}

		return orderedIndices.map((i) => {
			const c = candidates[i]!;
			if (c.existingId) {
				return { type: "block" as const, note, blockId: c.existingId, blockText: c.preview };
			}
			return { type: "block" as const, note, blockText: c.preview, needsWrite: { line: c.endLine } };
		});
	}

	/**
	 * Collect all existing block IDs across the entire vault.
	 * Uses metadataCache which is already in memory — fast.
	 */
	private collectAllBlockIds(): Set<string> {
		const ids = new Set<string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.blocks) {
				for (const id of Object.keys(cache.blocks)) {
					ids.add(id);
				}
			}
		}
		return ids;
	}

	private generateUniqueBlockId(existingIds: Set<string>): string {
		let id: string;
		do {
			id = "";
			for (let i = 0; i < BLOCK_ID_LENGTH; i++) {
				id += BLOCK_ID_CHARS[Math.floor(Math.random() * BLOCK_ID_CHARS.length)];
			}
		} while (existingIds.has(id));
		existingIds.add(id);
		return id;
	}

	/**
	 * Run the same morphological search used for notes against a list of
	 * arbitrary text strings.  Returns the indices of matched strings in
	 * relevance order.
	 */
	private searchTexts(texts: string[], query: string): number[] {
		const notes: NoteInfo[] = texts.map((text, i) => ({
			path: String(i),
			title: text,
			aliases: [],
		}));
		const index = new NotesIndex(notes, this.stemmer);
		const results = index.search(query);
		return results.map((r) => parseInt(r.note.path, 10));
	}

	private getRecentSuggestions(): LinkSuggestion[] {
		const recentData = this.recentNotes.toJSON();
		const sorted = Object.entries(recentData).sort((a, b) => b[1] - a[1]);

		const notes = this.collectNotes();
		const notesByTitle = new Map(notes.map((n) => [n.title, n]));

		const suggestions: LinkSuggestion[] = [];
		for (const [title] of sorted) {
			const note = notesByTitle.get(title);
			if (note) {
				suggestions.push({ type: "note", note });
			}
			if (suggestions.length >= MAX_BOOST_COUNT) break;
		}
		return suggestions;
	}

	// ----- Render helpers -----

	private renderNoteSuggestion(
		item: Extract<LinkSuggestion, { type: "note" }>,
		el: HTMLElement,
	): void {
		el.createEl("div", { text: item.note.title, cls: "suggestion-title" });
		if (item.matchedAlias) {
			el.createEl("div", {
				text: item.matchedAlias,
				cls: "suggestion-note natural-link-matched-alias",
			});
		}
		if (item.note.exists === false) {
			el.createEl("small", {
				text: t("modal.note-not-created"),
				cls: "suggestion-note natural-link-not-created",
			});
		} else if (item.note.path !== `${item.note.title}.md`) {
			el.createEl("small", { text: item.note.path, cls: "suggestion-path" });
		}
	}

	private renderHeadingSuggestion(
		item: Extract<LinkSuggestion, { type: "heading" }>,
		el: HTMLElement,
	): void {
		const prefix = "#".repeat(item.level) + " ";
		el.createEl("div", {
			text: `${item.note.title} > ${prefix}${item.heading}`,
			cls: "suggestion-title",
		});
		el.createEl("small", {
			text: t("suggest.heading-badge"),
			cls: "suggestion-note natural-link-heading-badge",
		});
	}

	private renderBlockSuggestion(
		item: Extract<LinkSuggestion, { type: "block" }>,
		el: HTMLElement,
	): void {
		el.createEl("div", { text: item.blockText, cls: "suggestion-title" });
		if (item.blockId) {
			el.createEl("small", {
				text: `^${item.blockId}`,
				cls: "suggestion-note natural-link-block-badge",
			});
		} else {
			el.createEl("small", {
				text: t("suggest.block-badge"),
				cls: "suggestion-note natural-link-block-badge",
			});
		}
	}

	// ----- Link helpers -----

	private getLinkTarget(item: LinkSuggestion): string {
		switch (item.type) {
			case "note":
				return item.note.title;
			case "heading":
				return `${item.note.title}#${item.heading}`;
			case "block":
				return `${item.note.title}#^${item.blockId}`;
		}
	}

	/**
	 * Extract display text from the raw query.
	 *
	 * The display text represents what the user was "saying" — the note
	 * reference they typed, NOT the heading/block navigation they used to
	 * drill down.  So `заметк#загол` → display is `заметк`.
	 *
	 * Priority:
	 *  1. Explicit `|displayPart` if non-empty
	 *  2. `notePart` (text before any #, ^, |)
	 *  3. Full raw query as fallback (e.g. bare `#heading`)
	 */
	private getDisplayText(rawQuery: string): string {
		const parsed = parseQuery(rawQuery);
		if (parsed.displayPart !== undefined && parsed.displayPart.trim().length > 0) {
			return parsed.displayPart.trim();
		}
		// Display = the note part the user typed (before any #, ^, |).
		// When empty (e.g. bare "#heading" or "^"), no display text is shown.
		return parsed.notePart.trim();
	}
}
