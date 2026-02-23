import { LinkSuggestion, NoteInfo } from "../types";

/**
 * Tracks the state of the user's ongoing query session.
 *
 * It stores the last set of suggestions returned while in "note search" mode,
 * and handles the transition into "sub-link search" mode (when the user types
 * `#` or `^`). When entering sub-link mode, it resolves the specific note
 * the user had highlighted.
 */
export class SuggestSession {
    private lastNoteSuggestions: LinkSuggestion[] = [];
    private resolvedNote: NoteInfo | null = null;

    /**
     * Called when the query is in "note search" mode (no `#` or `^`).
     * Remembers the suggestions and resets any previously resolved note.
     */
    updateNoteSuggestions(suggestions: LinkSuggestion[]): void {
        this.resolvedNote = null;
        this.lastNoteSuggestions = suggestions;
    }

    /**
     * Called when the query enters "sub-link search" mode.
     * Resolves the currently highlighted note from the UI precisely once,
     * then caches it for the remainder of the sub-link query.
     *
     * @param getSelectedIndex A callback to read the UI's currently selected index.
     */
    getResolvedNote(getSelectedIndex: () => number): NoteInfo | undefined {
        if (!this.resolvedNote && this.lastNoteSuggestions.length > 0) {
            const idx = getSelectedIndex();
            if (idx >= 0 && idx < this.lastNoteSuggestions.length) {
                this.resolvedNote = this.lastNoteSuggestions[idx]!.note;
            }
        }

        return this.resolvedNote ?? undefined;
    }
}
