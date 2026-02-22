import { App, Editor, SuggestModal } from "obsidian";
import { LinkSuggestion } from "../types";
import { LinkSuggestCore } from "./link-suggest-core";
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
		return this.core.getSuggestions(query);
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

	onNoSuggestion(): void {
		this.resultContainerEl.empty();
		this.resultContainerEl.createEl("div", {
			text: t("modal.no-results"),
			cls: "suggestion-empty",
		});
	}
}
