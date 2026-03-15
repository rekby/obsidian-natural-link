import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { type WordPair } from "./types";

type EmitTsMapOptions = {
	targetPath: string;
	constName: string;
	pairs: WordPair[];
	headerComment?: string;
	locale?: string;
};

function escapeString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function emitReadonlyMapTs({
	targetPath,
	constName,
	pairs,
	headerComment,
	locale = "en",
}: EmitTsMapOptions): Promise<void> {
	const sortedPairs = [...pairs].sort(([leftForm, leftCanonical], [rightForm, rightCanonical]) => {
		const byForm = leftForm.localeCompare(rightForm, locale);
		if (byForm !== 0) {
			return byForm;
		}
		return leftCanonical.localeCompare(rightCanonical, locale);
	});

	const header = headerComment ? `// ${headerComment}\n` : "";
	const body = sortedPairs
		.map(
			([form, canonical]) =>
				`\t["${escapeString(form)}", "${escapeString(canonical)}"],`,
		)
		.join("\n");

	const output = `${header}export const ${constName}: ReadonlyMap<string, string> = new Map([\n${body}\n]);\n`;
	await mkdir(path.dirname(targetPath), { recursive: true });
	await writeFile(targetPath, output, "utf8");
}
