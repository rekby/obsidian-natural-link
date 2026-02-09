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
import { MultiStemmer } from "../stemming/multi-stemmer";
import { RussianStemmer } from "../stemming/russian-stemmer";
import { EnglishStemmer } from "../stemming/english-stemmer";
import { NoteInfo, SearchResult } from "../types";
import { t } from "../i18n";

/**
 * Inline editor suggest that replaces Obsidian's native [[ link autocomplete
 * with the plugin's morphological search. Activated when user types [[ in the editor.
 */
export class NaturalLinkSuggest extends EditorSuggest<SearchResult> {
	private readonly plugin: NaturalLinkPlugin;
	private cachedIndex: NotesIndex | null = null;
	private cachedNotes: NoteInfo[] = [];

	constructor(plugin: NaturalLinkPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.inlineLinkSuggest) {
			this.clearCache();
			return null;
		}

		const line = editor.getLine(cursor.line);
		const beforeCursor = line.substring(0, cursor.ch);

		// Find the last [[ before the cursor
		const triggerIndex = beforeCursor.lastIndexOf("[[");
		if (triggerIndex < 0) {
			this.clearCache();
			return null;
		}

		// Make sure there's no ]] between [[ and cursor (link already closed)
		const afterTrigger = beforeCursor.substring(triggerIndex + 2);
		if (afterTrigger.includes("]]")) {
			this.clearCache();
			return null;
		}

		// Build and cache the index on first trigger
		if (!this.cachedIndex) {
			this.cachedIndex = this.buildIndex();
		}

		return {
			start: { line: cursor.line, ch: triggerIndex + 2 },
			end: cursor,
			query: afterTrigger,
		};
	}

	getSuggestions(context: EditorSuggestContext): SearchResult[] {
		if (!this.cachedIndex) {
			return [];
		}
		if (context.query.trim().length === 0) {
			// Return all notes for empty query so our suggest claims the [[ trigger
			// immediately and the native link suggest doesn't take over.
			return this.cachedNotes.map((note) => ({ note }));
		}
		return this.cachedIndex.search(context.query);
	}

	renderSuggestion(result: SearchResult, el: HTMLElement): void {
		el.createEl("div", { text: result.note.title, cls: "suggestion-title" });
		if (result.matchedAlias) {
			el.createEl("div", {
				text: result.matchedAlias,
				cls: "suggestion-note natural-link-matched-alias",
			});
		}
		if (result.note.exists === false) {
			el.createEl("small", {
				text: t("modal.note-not-created"),
				cls: "suggestion-note natural-link-not-created",
			});
		} else if (result.note.path !== `${result.note.title}.md`) {
			el.createEl("small", { text: result.note.path, cls: "suggestion-path" });
		}
	}

	selectSuggestion(result: SearchResult, evt: MouseEvent | KeyboardEvent): void {
		if (!this.context) {
			return;
		}

		const editor = this.context.editor;
		const query = this.context.query.trim();

		// Replace from [[ to cursor with the full wikilink
		const from: EditorPosition = {
			line: this.context.start.line,
			ch: this.context.start.ch - 2, // include the [[ prefix
		};

		// Obsidian auto-inserts ]] after [[ — if present after cursor, include in replacement
		const line = editor.getLine(this.context.end.line);
		const afterCursor = line.substring(this.context.end.ch);
		const to: EditorPosition = afterCursor.startsWith("]]")
			? { line: this.context.end.line, ch: this.context.end.ch + 2 }
			: this.context.end;

		let link: string;
		if (evt instanceof KeyboardEvent && evt.shiftKey) {
			// Shift+Enter: insert link as typed (bypass search result)
			link = `[[${query}|${query}]]`;
		} else {
			// Normal Enter: insert link to the selected note
			link = `[[${result.note.title}|${query}]]`;
		}

		editor.replaceRange(link, from, to);

		// Place cursor after the inserted link so the user can continue typing
		editor.setCursor({
			line: from.line,
			ch: from.ch + link.length,
		});
	}

	/**
	 * Build a NotesIndex from the current vault state.
	 */
	private buildIndex(): NotesIndex {
		const notes = this.plugin.collectNotes();
		if (this.plugin.settings.searchNonExistingNotes) {
			const unresolvedNotes = this.plugin.collectUnresolvedNotes(notes);
			notes.push(...unresolvedNotes);
		}
		this.cachedNotes = notes;
		const stemmer = new MultiStemmer([
			new RussianStemmer(),
			new EnglishStemmer(),
		]);
		return new NotesIndex(notes, stemmer);
	}

	private clearCache(): void {
		this.cachedIndex = null;
		this.cachedNotes = [];
	}
}
