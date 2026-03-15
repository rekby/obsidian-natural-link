import { describe, expect, it } from "vitest";
import {
	parseOpenCorporaXmlStream,
	parseOpenCorporaLemmaGroups,
} from "../../scripts/dictionaries/opencorpora-source";
import { type LemmaGroup, type WordPair } from "../../scripts/dictionaries/types";

const SAMPLE_XML = `<?xml version="1.0" encoding="utf8" standalone="yes"?>
<dictionary version="0.8" revision="1">
  <lemmata>
    <lemma id="1" rev="1">
      <l t="человек"><g v="NOUN"/><g v="anim"/></l>
      <f t="люди"><g v="plur"/></f>
      <f t="людей"><g v="gent"/></f>
    </lemma>
    <lemma id="2" rev="1">
      <l t="мышь"><g v="NOUN"/></l>
      <f t="мыши"><g v="plur"/></f>
    </lemma>
    <lemma id="3" rev="1">
      <l t="Иванов"><g v="NOUN"/><g v="Surn"/></l>
      <f t="Иванова"><g v="gent"/></f>
    </lemma>
  </lemmata>
</dictionary>`;

async function* xmlSource(xml: string) {
	yield xml;
}

describe("parseOpenCorporaXmlStream", () => {
	it("extracts form -> lemma pairs from OpenCorpora XML", async () => {
		const pairs: WordPair[] = [];
		const stats = await parseOpenCorporaXmlStream(xmlSource(SAMPLE_XML), (pair) =>
			pairs.push(pair),
		);

		expect(stats.lemmas).toBe(3);
		expect(stats.pairs).toBe(4);
		expect(pairs).toEqual([
			["люди", "человек"],
			["людей", "человек"],
			["мыши", "мышь"],
			["Иванова", "Иванов"],
		]);
	});
});

describe("parseOpenCorporaLemmaGroups", () => {
	it("extracts lemma groups with forms and grammemes", async () => {
		const groups: LemmaGroup[] = [];
		const stats = await parseOpenCorporaLemmaGroups(xmlSource(SAMPLE_XML), (group) => {
			groups.push(group);
		});

		expect(stats.lemmas).toBe(3);
		expect(groups).toHaveLength(3);

		expect(groups[0]!.lemma).toBe("человек");
		expect(groups[0]!.forms).toEqual(["люди", "людей"]);
		expect(groups[0]!.grammemes).toEqual(new Set(["NOUN", "anim"]));

		expect(groups[1]!.lemma).toBe("мышь");
		expect(groups[1]!.forms).toEqual(["мыши"]);
		expect(groups[1]!.grammemes).toEqual(new Set(["NOUN"]));

		expect(groups[2]!.lemma).toBe("Иванов");
		expect(groups[2]!.forms).toEqual(["Иванова"]);
		expect(groups[2]!.grammemes).toEqual(new Set(["NOUN", "Surn"]));
	});
});
