/**
 * Single entry point for the template's test harness.
 *
 * Specs should import from here (`../lib/index.mjs`) rather than from individual
 * modules, so the internal layout can change without touching every plugin.
 */
export * from './constants.mjs';
export * from './chrome-options.mjs';
export * from './launcher-patch.mjs';
export * from './fonts.mjs';
export * from './freeze-ui.mjs';
export * from './window.mjs';
export * from './vault.mjs';
export * from './editor.mjs';
export * from './plugin.mjs';
export * from './screenshot.mjs';
export * from './overlay.mjs';
export * from './race.mjs';
