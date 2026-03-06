import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import type NaturalLinkPlugin from "../main";
import { NotesIndex } from "../search/notes-index";
import { MAX_BOOST_COUNT } from "../search/recent-notes";
import { MultiStemmer } from "../stemming/multi-stemmer";
import { RussianStemmer } from "../stemming/russian-stemmer";
import { EnglishStemmer } from "../stemming/english-stemmer";
import { SearchResult } from "../types";
import { renderSearchResult } from "./result-renderer";

/**
 * Inline EditorSuggest for [[ link triggers.
 * Activates when the user types [[ and the query does not contain | # ^
 * (those cases are left to the native file suggest).
 * On selection, replaces the full [[...]] span including any existing |display]] suffix.
 */
export class NaturalLinkSuggest extends EditorSuggest<SearchResult> {
	private readonly plugin: NaturalLinkPlugin;

	constructor(plugin: NaturalLinkPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile,
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.inlineLinkSuggest) {
			return null;
		}

		const line = editor.getLine(cursor.line);
		const textBeforeCursor = line.substring(0, cursor.ch);

		// Find the last [[ before the cursor on this line
		const openIdx = textBeforeCursor.lastIndexOf("[[");
		if (openIdx === -1) {
			return null;
		}

		const query = textBeforeCursor.substring(openIdx + 2);

		// Don't trigger if editing the display part (after |)
		if (query.includes("|")) {
			return null;
		}

		// Don't trigger for heading (#) or block (^) references — let native handle them
		if (query.includes("#") || query.includes("^")) {
			return null;
		}

		return {
			start: { line: cursor.line, ch: openIdx + 2 },
			end: cursor,
			query,
		};
	}

	getSuggestions(ctx: EditorSuggestContext): SearchResult[] {
		const query = ctx.query.trim();
		if (query.length === 0) {
			return [];
		}

		const notes = this.plugin.collectNotes();
		const stemmer = new MultiStemmer([new RussianStemmer(), new EnglishStemmer()]);
		const index = new NotesIndex(notes, stemmer);
		const results = index.search(query);
		return this.plugin.recentNotes.boostRecent(
			results,
			(r) => r.note.title,
			MAX_BOOST_COUNT,
		);
	}

	renderSuggestion(result: SearchResult, el: HTMLElement): void {
		renderSearchResult(result, el);
	}

	selectSuggestion(result: SearchResult, evt: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) return;

		const query = ctx.query.trim();
		const title = result.note.title;

		const link =
			evt instanceof KeyboardEvent && evt.shiftKey
				? `[[${query}|${query}]]`
				: `[[${title}|${query}]]`;

		if (!(evt instanceof KeyboardEvent && evt.shiftKey)) {
			this.plugin.recordNoteSelection(title);
		}

		const editor = ctx.editor;
		const line = editor.getLine(ctx.start.line);

		// Replace from [[ to the end of the full link span
		const from: EditorPosition = { line: ctx.start.line, ch: ctx.start.ch - 2 };
		const to: EditorPosition = this.findLinkEnd(line, ctx.end.ch);

		editor.replaceRange(link, from, to);
		editor.setCursor({ line: from.line, ch: from.ch + link.length });
		this.close();
	}

	/**
	 * Starting from `fromCh` in `line`, find the end of the [[...]] span.
	 * Handles three cases:
	 *   - "]]" immediately → skip past ]]
	 *   - "|...]]" → skip to end of ]]
	 *   - nothing recognized → return position at fromCh (replace only typed part)
	 */
	private findLinkEnd(line: string, fromCh: number): EditorPosition {
		const rest = line.substring(fromCh);

		if (rest.startsWith("]]")) {
			return { line: this.context!.start.line, ch: fromCh + 2 };
		}

		if (rest.startsWith("|")) {
			const closeIdx = rest.indexOf("]]");
			if (closeIdx !== -1) {
				return { line: this.context!.start.line, ch: fromCh + closeIdx + 2 };
			}
		}

		return { line: this.context!.start.line, ch: fromCh };
	}
}
