import fs from 'node:fs';
import json from '@eslint/json';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

// The template has no root manifest.json (plugins own that file), and
// projectService fails outright on a listed path that does not exist.
const hasManifest = fs.existsSync('manifest.json');

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
				projectService: {
					allowDefaultProject: hasManifest ? ['manifest.json'] : [],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
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
