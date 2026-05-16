import tsparser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

// Rules from eslint-plugin-obsidianmd that need TypeScript type information.
// They must be disabled on non-TS files (package.json, etc.) to avoid
// "rule requires type information" parser errors.
const obsidianTypedRules = [
	"obsidianmd/no-plugin-as-component",
	"obsidianmd/no-view-references-in-plugin",
	"obsidianmd/no-unsupported-api",
	"obsidianmd/prefer-file-manager-trash-file",
	"obsidianmd/prefer-instanceof",
];
const disableObsidianTypedRules = Object.fromEntries(
	obsidianTypedRules.map((name) => [name, "off"]),
);

export default defineConfig([
	globalIgnores([
		"node_modules",
		"dist",
		"main.js",
		"esbuild.config.mjs",
		"version-bump.mjs",
		"vitest.config.ts",
		"wdio.conf.mjs",
		"wdio.demo.conf.mjs",
		"obsidian-tests",
		"versions.json",
		"data.json",
		"package-lock.json",
		"tsconfig.json",
		"tsconfig.eslint.json",
		".claude",
		".obsidian-cache",
	]),
	...obsidianmd.configs.recommendedWithLocalesEn,
	{
		files: ["**/*.ts", "**/*.tsx", "manifest.json"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./tsconfig.eslint.json",
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
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
			"obsidianmd/rule-custom-message": "off",
			"obsidianmd/no-global-this": "off",
		},
	},
	{
		files: ["**/*.json"],
		rules: disableObsidianTypedRules,
	},
]);
