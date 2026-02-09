import { App, Editor, SuggestModal } from "obsidian";
import { NotesIndex } from "../search/notes-index";
import { RecentNotes } from "../search/recent-notes";
import { SearchResult } from "../types";
import { t } from "../i18n";

/**
 * Modal for searching notes by natural word forms.
 * Shows suggestions as the user types, inserts a wikilink on selection.
 */
export class NaturalLinkModal extends SuggestModal<SearchResult> {
	private readonly index: NotesIndex;
	private readonly editor: Editor;
	private readonly recentNotes: RecentNotes;
	private readonly onNoteSelected: (title: string) => void;
	private lastQuery: string;

	constructor(
		app: App,
		editor: Editor,
		index: NotesIndex,
		recentNotes: RecentNotes,
		onNoteSelected: (title: string) => void,
	) {
		super(app);
		this.index = index;
		this.editor = editor;
		this.recentNotes = recentNotes;
		this.onNoteSelected = onNoteSelected;
		this.lastQuery = "";
		this.setPlaceholder(t("modal.placeholder"));
		this.setInstructions([
			{ command: "↑↓", purpose: t("modal.instruction.navigate") },
			{ command: "↵", purpose: t("modal.instruction.insert-link") },
			{ command: "shift ↵", purpose: t("modal.instruction.insert-as-typed") },
			{ command: "esc", purpose: t("modal.instruction.dismiss") },
		]);

		this.scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
			this.insertRawLink();
			return false;
		});
	}

	getSuggestions(query: string): SearchResult[] {
		this.lastQuery = query;
		if (query.trim().length === 0) {
			return [];
		}
		const results = this.index.search(query);
		return this.recentNotes.boostRecent(results, (r) => r.note.title);
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

	onChooseSuggestion(result: SearchResult, _evt: MouseEvent | KeyboardEvent): void {
		const displayText = this.lastQuery.trim();
		const noteTitle = result.note.title;

		// Always use piped link to preserve the user's original text as display.
		// This ensures renaming the note won't change how the link looks in text.
		const link = `[[${noteTitle}|${displayText}]]`;

		this.editor.replaceSelection(link);
		this.onNoteSelected(noteTitle);
	}

	/**
	 * Insert a link using the raw user input as both target and display text.
	 * Bypasses search results — the link points to whatever the user typed.
	 */
	private insertRawLink(): void {
		const rawInput = this.lastQuery.trim();
		if (rawInput.length === 0) {
			return;
		}
		const link = `[[${rawInput}|${rawInput}]]`;
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
