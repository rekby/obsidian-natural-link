import { App, Editor, SuggestModal } from "obsidian";
import { LinkSuggestion } from "../types";
import { LinkSuggestCore } from "./link-suggest-core";
import { parseQuery } from "./query-parser";
import { SuggestSession } from "./suggest-session";
import { t } from "../i18n";

/**
 * Modal for searching notes by natural word forms.
 * Thin wrapper around LinkSuggestCore — delegates search, rendering,
 * and link construction to the shared core.
 */
export class NaturalLinkModal extends SuggestModal<LinkSuggestion> {
	private readonly core: LinkSuggestCore;
	private readonly editor: Editor;
	private readonly onNoteSelected: (title: string) => void;
	private lastQuery = "";
	private readonly session = new SuggestSession();

	constructor(
		app: App,
		editor: Editor,
		core: LinkSuggestCore,
		onNoteSelected: (title: string) => void,
	) {
		super(app);
		this.core = core;
		this.editor = editor;
		this.onNoteSelected = onNoteSelected;
		this.setPlaceholder(t("modal.placeholder"));
		this.setInstructions(LinkSuggestCore.getInstructions());

		this.scope.register(["Shift"], "Enter", () => {
			this.insertRawLink();
			return false;
		});
	}

	async getSuggestions(query: string): Promise<LinkSuggestion[]> {
		this.lastQuery = query;

		const parsed = parseQuery(query);
		const hasSubLink = parsed.headingPart !== undefined || parsed.blockPart !== undefined;

		if (!hasSubLink) {
			const results = await this.core.getSuggestions(query);
			this.session.updateNoteSuggestions(results);
			return results;
		}

		const resolvedNote = this.session.getResolvedNote(() => this.getSelectedIndex());
		return this.core.getSuggestions(query, resolvedNote);
	}

	renderSuggestion(item: LinkSuggestion, el: HTMLElement): void {
		this.core.renderSuggestion(item, el);
	}

	onChooseSuggestion(item: LinkSuggestion, _evt: MouseEvent | KeyboardEvent): void {
		this.core.prepareBlockId(item);
		const link = this.core.buildLink(item, this.lastQuery, false);
		this.editor.replaceSelection(link);
		this.onNoteSelected(this.core.getNoteTitle(item));
		void this.core.writeBlockIdIfNeeded(item);
	}

	private insertRawLink(): void {
		const raw = this.lastQuery.trim();
		if (raw.length === 0) return;
		const link = this.core.buildRawLink(this.lastQuery);
		this.editor.replaceSelection(link);
		this.close();
	}

	/**
	 * Read the currently highlighted index from Obsidian's internal
	 * chooser.  Returns 0 when the internal API is unavailable.
	 */
	private getSelectedIndex(): number {
		try {
			const idx = (this as unknown as { chooser?: { selectedItem?: number } })
				.chooser?.selectedItem;
			return typeof idx === "number" ? idx : 0;
		} catch {
			return 0;
		}
	}

	onNoSuggestion(): void {
		this.resultContainerEl.empty();
		this.resultContainerEl.createEl("div", {
			text: t("modal.no-results"),
			cls: "suggestion-empty",
		});
	}
}
