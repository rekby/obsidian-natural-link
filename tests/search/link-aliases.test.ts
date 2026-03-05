import { describe, it, expect } from "vitest";
import { addLinkDisplayAliases, LinkDisplay } from "../../src/search/link-aliases";
import { NoteInfo } from "../../src/types";

function makeNote(title: string, aliases: string[] = []): NoteInfo {
	return { path: `${title}.md`, title, aliases: [...aliases] };
}

describe("addLinkDisplayAliases", () => {
	it("adds displayText as alias", () => {
		const notes = [makeNote("My Note")];
		const links: LinkDisplay[] = [{ notePath: "My Note.md", displayText: "my note" }];
		addLinkDisplayAliases(notes, links);
		expect(notes[0]!.aliases).toContain("my note");
	});

	it("skips displayText that equals the note title", () => {
		const notes = [makeNote("My Note")];
		const links: LinkDisplay[] = [{ notePath: "My Note.md", displayText: "My Note" }];
		addLinkDisplayAliases(notes, links);
		expect(notes[0]!.aliases).toHaveLength(0);
	});

	it("does not duplicate an alias already in frontmatter aliases", () => {
		const notes = [makeNote("My Note", ["custom alias"])];
		const links: LinkDisplay[] = [{ notePath: "My Note.md", displayText: "custom alias" }];
		addLinkDisplayAliases(notes, links);
		expect(notes[0]!.aliases).toEqual(["custom alias"]);
	});

	it("does not duplicate when same displayText appears in multiple links", () => {
		const notes = [makeNote("My Note")];
		const links: LinkDisplay[] = [
			{ notePath: "My Note.md", displayText: "alias" },
			{ notePath: "My Note.md", displayText: "alias" },
		];
		addLinkDisplayAliases(notes, links);
		expect(notes[0]!.aliases).toEqual(["alias"]);
	});

	it("ignores links to unknown note paths", () => {
		const notes = [makeNote("My Note")];
		const links: LinkDisplay[] = [{ notePath: "Unknown.md", displayText: "alias" }];
		addLinkDisplayAliases(notes, links);
		expect(notes[0]!.aliases).toHaveLength(0);
	});

	it("adds multiple distinct displayTexts as aliases", () => {
		const notes = [makeNote("My Note")];
		const links: LinkDisplay[] = [
			{ notePath: "My Note.md", displayText: "alias one" },
			{ notePath: "My Note.md", displayText: "alias two" },
		];
		addLinkDisplayAliases(notes, links);
		expect(notes[0]!.aliases).toEqual(["alias one", "alias two"]);
	});

	it("handles links to multiple different notes", () => {
		const note1 = makeNote("Note A");
		const note2 = makeNote("Note B");
		const links: LinkDisplay[] = [
			{ notePath: "Note A.md", displayText: "alias a" },
			{ notePath: "Note B.md", displayText: "alias b" },
		];
		addLinkDisplayAliases([note1, note2], links);
		expect(note1.aliases).toEqual(["alias a"]);
		expect(note2.aliases).toEqual(["alias b"]);
	});

	it("does not mutate notes when links array is empty", () => {
		const notes = [makeNote("My Note", ["existing"])];
		addLinkDisplayAliases(notes, []);
		expect(notes[0]!.aliases).toEqual(["existing"]);
	});
});
