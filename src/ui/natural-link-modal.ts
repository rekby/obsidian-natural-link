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
	private readonly swapEnterAndTab: boolean;
	private lastQuery = "";
	private readonly session = new SuggestSession();

	constructor(
		app: App,
		editor: Editor,
		core: LinkSuggestCore,
		onNoteSelected: (title: string) => void,
		swapEnterAndTab = false,
	) {
		super(app);
		this.core = core;
		this.editor = editor;
		this.onNoteSelected = onNoteSelected;
		this.swapEnterAndTab = swapEnterAndTab;
		this.setPlaceholder(t("modal.placeholder"));
		this.setInstructions(LinkSuggestCore.getInstructions(swapEnterAndTab));

		this.scope.register(["Shift"], "Enter", () => {
			this.insertRawLink();
			return false;
		});
		this.scope.register([], "Tab", () => {
			this.insertLinkWithoutDisplay();
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

	onChooseSuggestion(item: LinkSuggestion, evt: MouseEvent | KeyboardEvent): void {
		const isTab = evt instanceof KeyboardEvent && evt.key === "Tab";
		const withoutDisplay = isTab !== this.swapEnterAndTab;
		this.core.prepareBlockId(item);
		const link = this.core.buildLink(item, this.lastQuery, false, withoutDisplay ? "" : undefined);
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

	private insertLinkWithoutDisplay(): void {
		const item = this.getSelectedSuggestion();
		if (!item) return;
		// Synthesize a Tab event; onChooseSuggestion will XOR with swapEnterAndTab
		this.onChooseSuggestion(item, new KeyboardEvent("keydown", { key: "Tab" }));
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

	private getSelectedSuggestion(): LinkSuggestion | null {
		try {
			const chooser = (this as unknown as {
				chooser?: { values?: LinkSuggestion[]; selectedItem?: number };
			}).chooser;
			const values = chooser?.values;
			if (!values || values.length === 0) return null;
			const idx = chooser.selectedItem ?? 0;
			return values[idx] ?? null;
		} catch {
			return null;
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
