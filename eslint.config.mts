import fs from 'node:fs';
import json from '@eslint/json';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

// The template has no root manifest.json (plugins own that file), and
// projectService fails outright on a listed path that does not exist.
const hasManifest = fs.existsSync('manifest.json');

/**
 * A plugin that wants its unit tests and build scripts type-linted adds a
 * `tsconfig.eslint.json` extending tsconfig.json with those paths in `include`.
 * Without it, files outside the build tsconfig are "not found by the project
 * service" — and `allowDefaultProject` is not meant for whole directories.
 */
const eslintTsconfig = 'tsconfig.eslint.json';
const hasEslintTsconfig = fs.existsSync(eslintTsconfig);

const typedParserOptions = hasEslintTsconfig
	? { project: eslintTsconfig }
	: { projectService: { allowDefaultProject: hasManifest ? ['manifest.json'] : [] } };

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'**/main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'tsconfig.eslint.json',
		'vitest.config.ts',
		'.obsidian-cache',
		// Build/tooling config: runs in Node, so the plugin's "no Node APIs on
		// mobile" rules do not apply to it.
		'eslint.config.mts',
		// The test harness and demo scenarios are plain .mjs run by wdio or node,
		// outside the TS project — but fixture-plugin/**/*.ts is linted, so the
		// template checks its own plugin code the same way a real plugin does.
		'obsidian-tests/**/*.mjs',
		'obsidian-tests/demo-artifacts',
		'scripts',
		'docs',
		'wdio.conf.mjs',
		'wdio.demo.conf.mjs',
		// Scaffolding: contains {{PLACEHOLDER}} tokens, not valid TypeScript.
		'templates',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				...typedParserOptions,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	// recommendedWithLocalesEn additionally enforces sentence-case UI strings in
	// i18n modules; fall back when the installed plugin version lacks it.
	...(obsidianmd.configs.recommendedWithLocalesEn ?? obsidianmd.configs.recommended),
	{
		// Validate manifest.json against Obsidian's plugin manifest rules.
		files: ['manifest.json'],
		language: 'json/json',
		plugins: { json, obsidianmd },
		rules: {
			'no-irregular-whitespace': 'off',
			'obsidianmd/validate-manifest': 'error',
		},
	},
);
