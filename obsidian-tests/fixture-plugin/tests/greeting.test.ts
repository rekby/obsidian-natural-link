import { describe, expect, it } from 'vitest';
import { buildGreeting } from '../src/greeting';

describe('buildGreeting', () => {
	it('substitutes the name', () => {
		expect(buildGreeting('Obsidian')).toBe('Hello, Obsidian!');
	});

	it('falls back to "world" for blank input', () => {
		expect(buildGreeting('   ')).toBe('Hello, world!');
	});

	it('honours a custom template', () => {
		expect(buildGreeting('rekby', 'Привет, {name}')).toBe('Привет, rekby');
	});
});
