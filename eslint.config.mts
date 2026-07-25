import json from '@eslint/json';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'vitest.config.ts',
		'.obsidian-cache',
		// Test harness, demo scenarios and scaffolding are plain .mjs/.ts run by
		// wdio, vitest or node — not part of the plugin bundle.
		'obsidian-tests',
		'scripts',
		'templates',
		'docs',
		'wdio.conf.mjs',
		'wdio.demo.conf.mjs',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
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
