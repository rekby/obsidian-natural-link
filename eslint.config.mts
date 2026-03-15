import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json',
						'tests/*/*.ts',
						'scripts/*/*.ts',
					],
					maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	// @ts-expect-error typing mismatch for configs
	...(obsidianmd.configs?.recommendedWithLocalesEn ?? []),
	{
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/ui/sentence-case-locale-module": "error",
		}
	},
	{
		files: ["scripts/**/*.ts"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			"import/no-nodejs-modules": "off",
			"no-console": "off",
			"no-restricted-globals": "off",
			"no-undef": "off",
			"@typescript-eslint/only-throw-error": "off",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/no-unsafe-call": "off",
			"@typescript-eslint/no-unsafe-argument": "off",
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"vitest.config.ts",
		"obsidian-tests/demo-artifacts",
	]),
);
