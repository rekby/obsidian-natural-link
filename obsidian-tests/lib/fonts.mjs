import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FONTSOURCE_INTER_DIR = path.resolve('node_modules/@fontsource/inter');
const DEMO_FONT_WEIGHTS = ['400', '500', '600', '700'];

let cachedFontCss = null;

/**
 * Read the bundled Inter CSS (one file per weight) from @fontsource and rewrite
 * its relative `url(./files/foo.woff2)` references to absolute `file://` URLs
 * so Electron can load them from disk.
 *
 * Bundling a font is what stops screenshots from depending on which fonts happen
 * to be installed on the machine taking them.
 */
export async function loadInterFontCss() {
	if (cachedFontCss !== null) return cachedFontCss;

	const filesDir = path.join(FONTSOURCE_INTER_DIR, 'files');
	const blocks = [];
	for (const weight of DEMO_FONT_WEIGHTS) {
		const css = await fs.readFile(path.join(FONTSOURCE_INTER_DIR, `${weight}.css`), 'utf8');
		blocks.push(
			css.replace(
				/url\(\.\/files\/([^)]+)\)/g,
				(_, file) => `url('${pathToFileURL(path.join(filesDir, file)).href}')`,
			),
		);
	}

	cachedFontCss = blocks.join('\n');
	return cachedFontCss;
}
