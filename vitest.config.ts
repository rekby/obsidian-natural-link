import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests run in plain Node, with the `obsidian` module aliased to a local
 * stub. Aliasing (instead of `vi.mock("obsidian")` in every test file) keeps
 * the mock in one place and works for transitive imports too.
 *
 * The stub is plugin-owned: each plugin stubs the API surface it actually uses,
 * starting from `templates/starter/tests/__mocks__/obsidian.ts`. The template
 * itself has no `tests/`, so it falls back to the fixture plugin's stub.
 */
const pluginMock = path.resolve(import.meta.dirname, 'tests/__mocks__/obsidian.ts');
const fixtureMock = path.resolve(
	import.meta.dirname,
	'obsidian-tests/fixture-plugin/tests/__mocks__/obsidian.ts',
);

export default defineConfig({
	test: {
		include: [
			'tests/**/*.test.ts',
			'src/**/*.test.ts',
			'obsidian-tests/fixture-plugin/tests/**/*.test.ts',
		],
	},
	resolve: {
		alias: {
			obsidian: fs.existsSync(pluginMock) ? pluginMock : fixtureMock,
		},
	},
});
