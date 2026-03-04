import { describe, it, expect } from "vitest";
import { LinkSuggestCore } from "../../src/ui/link-suggest-core";
import { LinkSuggestion, NoteInfo } from "../../src/types";
import { TFile } from "obsidian";
import { RecentNotes } from "../../src/search/recent-notes";

function makeNote(title: string, path?: string): NoteInfo {
	return { title, path: path ?? `${title}.md`, aliases: [] };
}

function makeCore(): LinkSuggestCore {
	return new LinkSuggestCore({
		app: {} as never,
		collectNotes: () => [],
		stemmer: { stem: (w: string) => [w] },
		recentNotes: makeNoopRecentNotes(),
	});
}

function makeNoopRecentNotes(): never {
	return {
		toJSON: () => ({}),
		boostRecent: <T>(r: T[]) => r,
		getTop: () => [],
		getTopTitles: () => [],
	} as never;
}

function makePriorityApp(
	openTitles: string[],
	mtimeByPath: Record<string, number>,
): unknown {
	const filesByPath = new Map<string, TFile>();
	for (const [path, mtime] of Object.entries(mtimeByPath)) {
		const file = new TFile(path) as TFile & { stat?: { mtime: number } };
		file.stat = { mtime };
		filesByPath.set(path, file);
	}
	const makeLeaf = (title: string) => ({ view: { file: { basename: title } } });

	return {
		vault: {
			getAbstractFileByPath: (path: string) => filesByPath.get(path) ?? null,
			getMarkdownFiles: () => [...filesByPath.values()],
		},
		workspace: {
			getMostRecentLeaf: () => (openTitles.length > 0 ? makeLeaf(openTitles[0]!) : null),
			getLeavesOfType: (_type: string) => openTitles.map((title) => makeLeaf(title)),
		},
		metadataCache: {
			getFileCache: (_f: unknown) => null,
		},
	};
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

	it("omits display for block links when explicitDisplay is empty", () => {
		const item: LinkSuggestion = { type: "block", note, blockId: "abc123", blockText: "txt" };
		expect(core.buildLink(item, "note^abc", false, "")).toBe("[[My Note#^abc123]]");
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

describe("LinkSuggestCore contextual priority boosting", () => {
	it("reorders relevant note suggestions by context priority tiers", async () => {
		const now = Date.now();
		const notes = [
			makeNote("Rel A", "Rel A.md"),
			makeNote("Rel B", "Rel B.md"),
			makeNote("Rel C", "Rel C.md"),
			makeNote("Rel D", "Rel D.md"),
			makeNote("Rel E", "Rel E.md"),
		];

		const app = makePriorityApp(
			["Rel B", "Rel E", "Rel D"],
			{
				"Rel A.md": now - 60_000,
				"Rel B.md": now - 30_000,
				"Rel C.md": now - 20_000,
				"Rel D.md": now - 700_000,
				"Rel E.md": now - 800_000,
			},
		);

		const recent = new RecentNotes({
			"Rel A": now - 60_000,
			"Rel D": now - 700_000,
		});

		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => notes,
			stemmer: { stem: (w: string) => [w.toLowerCase()] },
			recentNotes: recent,
		});

		const suggestions = await core.getSuggestions("rel");
		const titles = suggestions
			.filter((s): s is Extract<LinkSuggestion, { type: "note" }> => s.type === "note")
			.map((s) => s.note.title);

		expect(titles.slice(0, 5)).toEqual([
			"Rel B",
			"Rel C",
			"Rel A",
			"Rel E",
			"Rel D",
		]);
	});

	it("does not inject non-relevant notes into non-empty query results", async () => {
		const now = Date.now();
		const notes = [
			makeNote("Alpha", "Alpha.md"),
			makeNote("Beta", "Beta.md"),
			makeNote("Gamma", "Gamma.md"),
		];
		const app = makePriorityApp(
			["Beta", "Gamma"],
			{
				"Alpha.md": now - 10_000,
				"Beta.md": now - 10_000,
				"Gamma.md": now - 10_000,
			},
		);
		const recent = new RecentNotes({
			Beta: now - 10_000,
			Gamma: now - 10_000,
		});

		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => notes,
			stemmer: { stem: (w: string) => [w.toLowerCase()] },
			recentNotes: recent,
		});

		const suggestions = await core.getSuggestions("alp");
		const titles = suggestions
			.filter((s): s is Extract<LinkSuggestion, { type: "note" }> => s.type === "note")
			.map((s) => s.note.title);

		expect(titles).toEqual(["Alpha"]);
	});

	it("uses contextual priority list for empty query", async () => {
		const now = Date.now();
		const notes = [
			makeNote("Rel A", "Rel A.md"),
			makeNote("Rel B", "Rel B.md"),
			makeNote("Rel C", "Rel C.md"),
			makeNote("Rel D", "Rel D.md"),
			makeNote("Rel E", "Rel E.md"),
			makeNote("Rel F", "Rel F.md"),
		];
		const app = makePriorityApp(
			["Rel B", "Rel E", "Rel D"],
			{
				"Rel A.md": now - 60_000,
				"Rel B.md": now - 30_000,
				"Rel C.md": now - 20_000,
				"Rel D.md": now - 700_000,
				"Rel E.md": now - 800_000,
				"Rel F.md": now - 900_000,
			},
		);
		const recent = new RecentNotes({
			"Rel A": now - 60_000,
			"Rel D": now - 700_000,
			"Rel F": now - 1_000_000,
		});

		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => notes,
			stemmer: { stem: (w: string) => [w.toLowerCase()] },
			recentNotes: recent,
		});

		const suggestions = await core.getSuggestions("");
		const titles = suggestions
			.filter((s): s is Extract<LinkSuggestion, { type: "note" }> => s.type === "note")
			.map((s) => s.note.title);

		expect(titles).toEqual(["Rel B", "Rel C", "Rel A", "Rel E", "Rel D"]);
		expect(titles).toHaveLength(5);
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
			recentNotes: makeNoopRecentNotes(),
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
			recentNotes: makeNoopRecentNotes(),
		});

		const suggestions = await core.getSuggestions("Note^Al");
		const blockTexts = suggestions.map((s) => (s.type === "block" ? s.blockText : null)).filter(Boolean);

		expect(blockTexts).toContain("- Alpha");
		expect(blockTexts).toContain("- Almond");
		expect(blockTexts).not.toContain("- Beta");
	});

	it("preserves existing ^id on list items and strips it from preview", async () => {
		const note = makeNote("Note");
		const app = makeAppForBlocks({
			note,
			content: "- First\n- Second ^abc123\n- Third",
			sections: [
				{ type: "list", position: { start: { line: 0 }, end: { line: 2 } } },
			],
			listItems: [
				{ position: { start: { line: 0 }, end: { line: 0 } } },
				{ id: "abc123", position: { start: { line: 1 }, end: { line: 1 } } },
				{ position: { start: { line: 2 }, end: { line: 2 } } },
			],
		});
		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => [note],
			stemmer: { stem: (w: string) => [w] },
			recentNotes: makeNoopRecentNotes(),
		});

		const suggestions = await core.getSuggestions("Note^");
		const second = suggestions.find((s) => s.type === "block" && s.blockText === "- Second");
		expect(second).toBeDefined();
		expect(second!.type === "block" && second!.blockId).toBe("abc123");
		expect(second!.type === "block" && second!.needsWrite).toBeUndefined();

		const first = suggestions.find((s) => s.type === "block" && s.blockText === "- First");
		expect(first).toBeDefined();
		expect(first!.type === "block" && first!.needsWrite).toBeTruthy();
	});

	it("strips ^id from multi-line list item preview", async () => {
		const note = makeNote("Note");
		const app = makeAppForBlocks({
			note,
			content: "- Multi\n  line ^xyz789\n- Single",
			sections: [
				{ type: "list", position: { start: { line: 0 }, end: { line: 2 } } },
			],
			listItems: [
				{ id: "xyz789", position: { start: { line: 0 }, end: { line: 1 } } },
				{ position: { start: { line: 2 }, end: { line: 2 } } },
			],
		});
		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => [note],
			stemmer: { stem: (w: string) => [w] },
			recentNotes: makeNoopRecentNotes(),
		});

		const suggestions = await core.getSuggestions("Note^");
		const multi = suggestions.find((s) => s.type === "block" && s.blockId === "xyz789");
		expect(multi).toBeDefined();
		expect(multi!.type === "block" && multi!.blockText).toBe("- Multi\n  line");
		expect(multi!.type === "block" && multi!.needsWrite).toBeUndefined();
	});

	it("expands nested list items individually with full text", async () => {
		const note = makeNote("Note");
		const app = makeAppForBlocks({
			note,
			content: "- Parent\n  - Child 1\n  - Child 2",
			sections: [
				{ type: "list", position: { start: { line: 0 }, end: { line: 2 } } },
			],
			listItems: [
				{ position: { start: { line: 0 }, end: { line: 2 } } },
				{ position: { start: { line: 1 }, end: { line: 1 } } },
				{ position: { start: { line: 2 }, end: { line: 2 } } },
			],
		});
		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => [note],
			stemmer: { stem: (w: string) => [w] },
			recentNotes: makeNoopRecentNotes(),
		});

		const suggestions = await core.getSuggestions("Note^");
		const blockTexts = suggestions.map((s) => (s.type === "block" ? s.blockText : null)).filter(Boolean);

		expect(blockTexts).toContain("- Parent\n  - Child 1\n  - Child 2");
		expect(blockTexts).toContain("- Child 1");
		expect(blockTexts).toContain("- Child 2");
		expect(blockTexts).toHaveLength(3);
	});

	it("includes continuation lines in multi-line list items", async () => {
		const note = makeNote("Note");
		const app = makeAppForBlocks({
			note,
			content: "- Item 1\n  continuation\n- Item 2",
			sections: [
				{ type: "list", position: { start: { line: 0 }, end: { line: 2 } } },
			],
			listItems: [
				{ position: { start: { line: 0 }, end: { line: 1 } } },
				{ position: { start: { line: 2 }, end: { line: 2 } } },
			],
		});
		const core = new LinkSuggestCore({
			app: app as never,
			collectNotes: () => [note],
			stemmer: { stem: (w: string) => [w] },
			recentNotes: makeNoopRecentNotes(),
		});

		const suggestions = await core.getSuggestions("Note^");
		const blockTexts = suggestions.map((s) => (s.type === "block" ? s.blockText : null)).filter(Boolean);

		expect(blockTexts).toContain("- Item 1\n  continuation");
		expect(blockTexts).toContain("- Item 2");
		expect(blockTexts).toHaveLength(2);

		const item1 = suggestions.find((s) => s.type === "block" && s.blockText === "- Item 1\n  continuation");
		expect(item1!.type === "block" && item1!.needsWrite).toEqual({ line: 1 });
	});
});
