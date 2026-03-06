import { SearchResult } from "../types";
import { t } from "../i18n";

/**
 * Renders a SearchResult into a suggestion list element.
 * Shared between NaturalLinkModal and NaturalLinkSuggest.
 */
export function renderSearchResult(result: SearchResult, el: HTMLElement): void {
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
