/**
 * Scaffold a new plugin from `templates/starter/`.
 *
 * Only for brand-new plugins. An existing repository adopts the template by
 * merging it (see agents/template/template-sync.md) and keeps its own src/,
 * manifest.json and docs.
 *
 * Usage:
 *   node scripts/init-plugin.mjs --id my-plugin --name "My Plugin" \
 *     [--description "..."] [--author rekby] [--min-app-version 1.5.8]
 *
 * Placeholders replaced in copied files: {{PLUGIN_ID}}, {{PLUGIN_NAME}},
 * {{PLUGIN_DESCRIPTION}}, {{PLUGIN_AUTHOR}}, {{MIN_APP_VERSION}}, {{PLUGIN_CLASS}}.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const starterRoot = path.join(repoRoot, 'templates', 'starter');

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 2) {
		const key = argv[i];
		if (!key?.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
		args[key.slice(2)] = argv[i + 1];
	}
	return args;
}

/** `my-plugin` -> `MyPlugin`, for the exported plugin class name. */
function toPascalCase(id) {
	return id.split(/[-_\s]+/).filter(Boolean)
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join('');
}

async function copyTree(from, to, replacements) {
	const entries = await fs.readdir(from, { withFileTypes: true });
	for (const entry of entries) {
		const src = path.join(from, entry.name);
		const dest = path.join(to, entry.name);

		if (entry.isDirectory()) {
			await fs.mkdir(dest, { recursive: true });
			await copyTree(src, dest, replacements);
			continue;
		}

		if (await fs.access(dest).then(() => true, () => false)) {
			process.stdout.write(`skip (exists): ${path.relative(repoRoot, dest)}\n`);
			continue;
		}

		let content = await fs.readFile(src, 'utf8');
		for (const [token, value] of Object.entries(replacements)) {
			content = content.replaceAll(token, value);
		}
		await fs.mkdir(path.dirname(dest), { recursive: true });
		await fs.writeFile(dest, content);
		process.stdout.write(`create: ${path.relative(repoRoot, dest)}\n`);
	}
}

const args = parseArgs(process.argv.slice(2));

if (!args.id || !args.name) {
	process.stderr.write('usage: node scripts/init-plugin.mjs --id <plugin-id> --name "<Plugin Name>"\n');
	process.exit(1);
}

await copyTree(starterRoot, repoRoot, {
	'{{PLUGIN_ID}}': args.id,
	'{{PLUGIN_NAME}}': args.name,
	'{{PLUGIN_DESCRIPTION}}': args.description ?? args.name,
	'{{PLUGIN_AUTHOR}}': args.author ?? 'rekby',
	'{{MIN_APP_VERSION}}': args['min-app-version'] ?? '1.5.8',
	'{{PLUGIN_CLASS}}': toPascalCase(args.id),
});

process.stdout.write(
	'\nNext:\n'
	+ '  1. Update name/description/author in package.json\n'
	+ '  2. npm install\n'
	+ '  3. npm run build && npm test && npm run lint\n'
	+ '  4. Remove templates/starter/ if you do not need it as a reference\n',
);
