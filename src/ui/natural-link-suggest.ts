import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import type NaturalLinkPlugin from "../main";
import { MultiStemmer } from "../stemming/multi-stemmer";
import { RussianStemmer } from "../stemming/russian-stemmer";
import { EnglishStemmer } from "../stemming/english-stemmer";
import { LinkSuggestion } from "../types";
import { LinkSuggestCore } from "./link-suggest-core";

/**
 * Inline [[ link suggest powered by morphological search.
 *
 * Registered via the public EditorSuggest API.  Placed at the front of the
 * suggests array so it is checked before the native [[ suggest.
 *
 * When the `inlineLinkSuggest` setting is disabled, `onTrigger` returns null
 * and the native suggest handles [[ as usual.
 */
export class NaturalLinkSuggest extends EditorSuggest<LinkSuggestion> {
	private readonly plugin: NaturalLinkPlugin;

	constructor(plugin: NaturalLinkPlugin) {
		super(plugin.app);
		this.plugin = plugin;

		this.setInstructions(LinkSuggestCore.getInstructions());

		this.scope.register(["Shift"], "Enter", () => {
			this.insertRawLink();
			return false;
		});
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (!this.plugin.settings.inlineLinkSuggest) return null;

		const line = editor.getLine(cursor.line);
		const textBefore = line.substring(0, cursor.ch);

		const bracketIdx = textBefore.lastIndexOf("[[");
		if (bracketIdx === -1) return null;

		const between = textBefore.substring(bracketIdx + 2);
		if (between.includes("]]")) return null;

		return {
			start: { line: cursor.line, ch: bracketIdx + 2 },
			end: cursor,
			query: between,
		};
	}

	async getSuggestions(context: EditorSuggestContext): Promise<LinkSuggestion[]> {
		const core = this.buildCore();
		return core.getSuggestions(context.query);
	}

	renderSuggestion(item: LinkSuggestion, el: HTMLElement): void {
		const core = this.buildCore();
		core.renderSuggestion(item, el);
	}

	selectSuggestion(item: LinkSuggestion, evt: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) return;

		const core = this.buildCore();
		const asTyped = evt instanceof KeyboardEvent && evt.shiftKey;

		if (!asTyped) {
			core.prepareBlockId(item);
		}

		const { end, explicitDisplay } = this.resolveEditingContext(ctx);
		const link = core.buildLink(item, ctx.query, asTyped, explicitDisplay);
		this.replaceRange(ctx.editor, ctx.start, end, link);
		this.close();

		if (!asTyped) {
			this.plugin.recordNoteSelection(core.getNoteTitle(item));
			void core.writeBlockIdIfNeeded(item);
		}
	}

	// ----- Private -----

	private buildCore(): LinkSuggestCore {
		return new LinkSuggestCore({
			app: this.plugin.app,
			collectNotes: () => this.plugin.collectNotes(),
			stemmer: new MultiStemmer([new RussianStemmer(), new EnglishStemmer()]),
			recentNotes: this.plugin.recentNotes,
			searchNonExistingNotes: () => this.plugin.settings.searchNonExistingNotes,
		});
	}

	private insertRawLink(): void {
		const ctx = this.context;
		if (!ctx) return;

		const raw = ctx.query.trim();
		if (raw.length === 0) return;

		const core = this.buildCore();
		const { end } = this.resolveEditingContext(ctx);
		const link = core.buildRawLink(ctx.query);
		this.replaceRange(ctx.editor, ctx.start, end, link);
		this.close();
	}

	/**
	 * When the cursor is inside an existing [[...]] link, detect the full
	 * extent (including |display and ]]) and extract the original display text.
	 *
	 * Returns:
	 *  - `end`: replacement range end (past ]] if editing, else cursor)
	 *  - `explicitDisplay`: the existing display text to preserve.
	 *    Defined only when editing an existing link.
	 *    Empty string means the original had no |display part.
	 */
	private resolveEditingContext(ctx: EditorSuggestContext): {
		end: EditorPosition;
		explicitDisplay?: string;
	} {
		const line = ctx.editor.getLine(ctx.end.line);
		const textAfter = line.substring(ctx.end.ch);
		const closingIdx = textAfter.indexOf("]]");

		if (closingIdx === -1) {
			return { end: ctx.end };
		}

		const afterContent = textAfter.substring(0, closingIdx);
		const newEnd: EditorPosition = {
			line: ctx.end.line,
			ch: ctx.end.ch + closingIdx + 2,
		};

		const fullContent = ctx.query + afterContent;
		const pipeIdx = fullContent.indexOf("|");

		if (pipeIdx !== -1) {
			return { end: newEnd, explicitDisplay: fullContent.substring(pipeIdx + 1).trim() };
		}

		return { end: newEnd, explicitDisplay: "" };
	}

	/**
	 * Replace the trigger range (between [[ and cursor) plus the surrounding
	 * [[ and ]] brackets with the constructed link text.
	 */
	private replaceRange(
		editor: Editor,
		start: EditorPosition,
		end: EditorPosition,
		link: string,
	): void {
		const startLine = editor.getLine(start.line);

		let fromCh = start.ch;
		if (fromCh >= 2 && startLine.substring(fromCh - 2, fromCh) === "[[") {
			fromCh -= 2;
		}
		const from: EditorPosition = { line: start.line, ch: fromCh };

		const endLine = editor.getLine(end.line);
		let toCh = end.ch;
		if (endLine.substring(toCh, toCh + 2) === "]]") {
			toCh += 2;
		}
		const to: EditorPosition = { line: end.line, ch: toCh };

		editor.replaceRange(link, from, to);
		editor.setCursor({ line: from.line, ch: from.ch + link.length });
	}
}
