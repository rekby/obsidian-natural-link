import type { NoteInfo } from "../types";

export interface LinkDisplay {
	notePath: string;
	displayText: string;
}

/**
 * Enriches notes with displayText values collected from wikilinks across the vault.
 * Only explicitly-set display texts are expected in `links` (i.e. from [[Note|display]]).
 * Skips displayTexts that equal the note title or are already present in aliases.
 * Mutates aliases arrays in-place.
 */
export function addLinkDisplayAliases(
	notes: NoteInfo[],
	links: LinkDisplay[],
): void {
	const pathToNote = new Map(notes.map((n) => [n.path, n]));
	for (const { notePath, displayText } of links) {
		const note = pathToNote.get(notePath);
		if (!note) continue;
		if (displayText === note.title) continue;
		if (note.aliases.includes(displayText)) continue;
		note.aliases.push(displayText);
	}
}
