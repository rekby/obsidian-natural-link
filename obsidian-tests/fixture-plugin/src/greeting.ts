/**
 * Pure logic, deliberately free of Obsidian types — this is the shape a plugin
 * should aim for, because it can be unit-tested without mocking anything.
 */
export function buildGreeting(name: string, template = 'Hello, {name}!'): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) return template.replace('{name}', 'world');
	return template.replace('{name}', trimmed);
}
