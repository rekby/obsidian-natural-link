export type WordPair = readonly [form: string, canonical: string];

export type PairSink = (pair: WordPair) => void | Promise<void>;

export type SourceParserStats = {
	lemmas: number;
	pairs: number;
};

export type SourceParser = (sink: PairSink) => Promise<SourceParserStats>;

export type LemmaGroup = {
	lemma: string;
	forms: string[];
	grammemes: ReadonlySet<string>;
};

export type LemmaGroupSink = (group: LemmaGroup) => void | Promise<void>;

export type LemmaGroupParserStats = {
	lemmas: number;
};

export type LemmaGroupSourceParser = (sink: LemmaGroupSink) => Promise<LemmaGroupParserStats>;
