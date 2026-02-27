import { describe, it, expect } from "vitest";
import { LinkSuggestCore } from "../../src/ui/link-suggest-core";
import { LinkSuggestion, NoteInfo } from "../../src/types";
import { TFile } from "obsidian";

function makeNote(title: string, path?: string): NoteInfo {
	return { title, path: path ?? `${title}.md`, aliases: [] };
}

function makeCore(): LinkSuggestCore {
	return new LinkSuggestCore({
		app: {} as never,
		collectNotes: () => [],
		stemmer: { stem: (w: string) => [w] },
		recentNotes: { toJSON: () => ({}), boostRecent: <T>(r: T[]) => r } as never,
		searchNonExistingNotes: () => false,
	});
}

describe("LinkSuggestCore.buildLink", () => {
	const core = makeCore();
	const note = makeNote("My Note");

	it("builds a piped link for a note suggestion", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "my query", false)).toBe("[[My Note|my query]]");
	});

	it("builds a heading link with notePart as display", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "Section One", level: 2 };
		expect(core.buildLink(item, "my note#sec", false)).toBe("[[My Note#Section One|my note]]");
	});

	it("builds a block link with notePart as display", () => {
		const item: LinkSuggestion = { type: "block", note, blockId: "abc123", blockText: "some text" };
		expect(core.buildLink(item, "my note^abc", false)).toBe("[[My Note#^abc123|my note]]");
	});

	it("uses explicit display text from pipe in query", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "note|custom display", false)).toBe("[[My Note|custom display]]");
	});

	it("uses explicit display text with heading query", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "Intro", level: 1 };
		expect(core.buildLink(item, "note#intro|my text", false)).toBe("[[My Note#Intro|my text]]");
	});

	it("falls back to notePart when display part after | is empty", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "note|", false)).toBe("[[My Note|note]]");
	});

	it("omits display text when notePart is empty (bare #heading)", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "H1", level: 1 };
		expect(core.buildLink(item, "#heading", false)).toBe("[[My Note#H1]]");
	});

	it("trims whitespace from display text", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "  my query  ", false)).toBe("[[My Note|my query]]");
	});

	it("omits display text when query is empty", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "", false)).toBe("[[My Note]]");
	});

	it("omits display text when query is whitespace only", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "   ", false)).toBe("[[My Note]]");
	});

	it("omits display text for heading when query is empty", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "Intro", level: 2 };
		expect(core.buildLink(item, "", false)).toBe("[[My Note#Intro]]");
	});

	it("preserves existing display text from pipe in edited link", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "old note|красивый текст", false)).toBe("[[My Note|красивый текст]]");
	});

	it("preserves existing display text for heading in edited link", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "Section", level: 1 };
		expect(core.buildLink(item, "note#sec|my display", false)).toBe("[[My Note#Section|my display]]");
	});
});

describe("LinkSuggestCore.buildLink (explicitDisplay parameter)", () => {
	const core = makeCore();
	const note = makeNote("My Note");

	it("uses explicitDisplay when provided", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "note", false, "заметк")).toBe("[[My Note|заметк]]");
	});

	it("omits display when explicitDisplay is empty string", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "note", false, "")).toBe("[[My Note]]");
	});

	it("preserves display for heading when editing existing link", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "Intro", level: 1 };
		expect(core.buildLink(item, "note#", false, "заметк")).toBe("[[My Note#Intro|заметк]]");
	});

	it("omits display for heading when original had none", () => {
		const item: LinkSuggestion = { type: "heading", note, heading: "Intro", level: 1 };
		expect(core.buildLink(item, "note#", false, "")).toBe("[[My Note#Intro]]");
	});

	it("explicitDisplay overrides query-derived display", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "typed text", false, "original")).toBe("[[My Note|original]]");
	});
});

describe("LinkSuggestCore.buildRawLink", () => {
	const core = makeCore();

	it("uses raw query as both target and display", () => {
		expect(core.buildRawLink("my query")).toBe("[[my query|my query]]");
	});

	it("trims whitespace", () => {
		expect(core.buildRawLink("  hello  ")).toBe("[[hello|hello]]");
	});

	it("preserves special characters in raw link", () => {
		expect(core.buildRawLink("note#heading|display")).toBe(
			"[[note#heading|display|note#heading|display]]",
		);
	});
});

describe("LinkSuggestCore.buildLink (asTyped=true)", () => {
	const core = makeCore();
	const note = makeNote("My Note");

	it("ignores the suggestion and uses raw query", () => {
		const item: LinkSuggestion = { type: "note", note };
		expect(core.buildLink(item, "raw input", true)).toBe("[[raw input|raw input]]");
	});
});

describe("LinkSuggestCore.getNoteTitle", () => {
	const core = makeCore();

	it("returns the note title for a note suggestion", () => {
		const item: LinkSuggestion = { type: "note", note: makeNote("Alpha") };
		expect(core.getNoteTitle(item)).toBe("Alpha");
	});

	it("returns the note title for a heading suggestion", () => {
		const item: LinkSuggestion = { type: "heading", note: makeNote("Beta"), heading: "H1", level: 1 };
		expect(core.getNoteTitle(item)).toBe("Beta");
	});

	it("returns the note title for a block suggestion with existing id", () => {
		const item: LinkSuggestion = { type: "block", note: makeNote("Gamma"), blockId: "x", blockText: "text" };
		expect(core.getNoteTitle(item)).toBe("Gamma");
	});

	it("returns the note title for a block suggestion without id", () => {
		const item: LinkSuggestion = { type: "block", note: makeNote("Delta"), blockText: "text", needsWrite: { line: 5 } };
		expect(core.getNoteTitle(item)).toBe("Delta");
	});
});

// ----- Block suggestions: list items -----

type SectionLike = {
	id?: string;
	type: string;
	position: { start: { line: number }; end: { line: number } };
};

type ListItemLike = {
	id?: string;
	position: { start: { line: number }; end: { line: number } };
};

function makeAppForBlocks(opts: {
	note: NoteInfo;
	content: string;
	sections: SectionLike[];
	listItems?: ListItemLike[];
}) {
	const file = new TFile(opts.note.path);
	return {
		vault: {
			getAbstractFileByPath: (path: string) => (path === opts.note.path ? file : null),
			cachedRead: async (_f: unknown) => opts.content,
			getMarkdownFiles: () => [],
		},
		metadataCache: {
			getFileCache: (_f: unknown) => ({
				sections: opts.sections,
				listItems: opts.listItems ?? [],
			}),
		},
	};
}

describe("LinkSuggestCore.getSuggestions (block ^ with list items)", () => {
	it("returns all list items as individual block candidates", async () => {
		const note = makeNote("Some note");
		const app = makeAppForBlocks({
			note,
			content: "Some text:\n- Item 1\n- Item 2",
			sections: [
				{ type: "paragraph", position: { start: { line: 0 }, end: { line: 0 } } },
				{ type: "list", position: { start: { line: 1 }, end: { line: 2 } } },
			],
			listItems: [
				{ position: { start: { line: 1 }, end: { line: 1 } } },
				{ position: { start: { line: 2 }, end: { line: 2 } } },
			],
		});
		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => [note],
			stemmer: { stem: (w: string) => [w] },
			recentNotes: { toJSON: () => ({}), boostRecent: <T>(r: T[]) => r } as never,
		});

		const suggestions = await core.getSuggestions("Some note^");
		const blockTexts = suggestions.map((s) => (s.type === "block" ? s.blockText : null)).filter(Boolean);

		expect(blockTexts).toContain("Some text:");
		expect(blockTexts).toContain("- Item 1");
		expect(blockTexts).toContain("- Item 2");
		expect(suggestions.every((s) => s.type === "block")).toBe(true);
	});

	it("filters list items by query prefix", async () => {
		// Verify that the search filter works for individual list items
		const note = makeNote("Note");
		const app = makeAppForBlocks({
			note,
			content: "- Alpha\n- Beta\n- Almond",
			sections: [
				{ type: "list", position: { start: { line: 0 }, end: { line: 2 } } },
			],
			listItems: [
				{ position: { start: { line: 0 }, end: { line: 0 } } },
				{ position: { start: { line: 1 }, end: { line: 1 } } },
				{ position: { start: { line: 2 }, end: { line: 2 } } },
			],
		});
		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => [note],
			stemmer: { stem: (w: string) => [w] },
			recentNotes: { toJSON: () => ({}), boostRecent: <T>(r: T[]) => r } as never,
		});

		const suggestions = await core.getSuggestions("Note^Al");
		const blockTexts = suggestions.map((s) => (s.type === "block" ? s.blockText : null)).filter(Boolean);

		expect(blockTexts).toContain("- Alpha");
		expect(blockTexts).toContain("- Almond");
		expect(blockTexts).not.toContain("- Beta");
	});
});
