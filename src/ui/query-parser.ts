/**
 * Parsed wikilink query split by special delimiters.
 *
 * Given raw input like "note#heading|display":
 *   notePart     = "note"
 *   headingPart  = "heading"
 *   displayPart  = "display"
 */
export interface ParsedQuery {
	/** Text used for note search (before any #, ^, or |). */
	notePart: string;
	/** Text after # — heading filter. Mutually exclusive with blockPart. */
	headingPart?: string;
	/** Text after ^ — block reference filter. Mutually exclusive with headingPart. */
	blockPart?: string;
	/** Text after | — explicit display text for the link. */
	displayPart?: string;
}

/**
 * Parse a wikilink query into its constituent parts.
 *
 * Delimiter priority:
 *  1. `|` splits link target from display text (checked first)
 *  2. Within the link target, `#` denotes a heading sub-link
 *  3. Within the link target, `^` denotes a block reference
 *  Only the first occurrence of each delimiter is used.
 *  `#` and `^` are mutually exclusive — whichever appears first wins.
 */
export function parseQuery(raw: string): ParsedQuery {
	let linkTarget: string;
	let displayPart: string | undefined;

	const pipeIdx = raw.indexOf("|");
	if (pipeIdx !== -1) {
		linkTarget = raw.substring(0, pipeIdx);
		displayPart = raw.substring(pipeIdx + 1);
	} else {
		linkTarget = raw;
	}

	const hashIdx = linkTarget.indexOf("#");
	const caretIdx = linkTarget.indexOf("^");

	let delimIdx = -1;
	let delimType: "heading" | "block" | undefined;

	if (hashIdx !== -1 && (caretIdx === -1 || hashIdx < caretIdx)) {
		delimIdx = hashIdx;
		delimType = "heading";
	} else if (caretIdx !== -1) {
		delimIdx = caretIdx;
		delimType = "block";
	}

	if (delimIdx !== -1 && delimType === "heading") {
		return {
			notePart: linkTarget.substring(0, delimIdx),
			headingPart: linkTarget.substring(delimIdx + 1),
			displayPart,
		};
	}
	if (delimIdx !== -1 && delimType === "block") {
		return {
			notePart: linkTarget.substring(0, delimIdx),
			blockPart: linkTarget.substring(delimIdx + 1),
			displayPart,
		};
	}

	return { notePart: linkTarget, displayPart };
}
