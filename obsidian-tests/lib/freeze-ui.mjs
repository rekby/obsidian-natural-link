import { browser } from '@wdio/globals';
import {
	DEMO_VIEWPORT_HEIGHT,
	DEMO_VIEWPORT_WIDTH,
	LEFT_SPLIT_WIDTH,
	STABLE_VAULT_NAME,
} from './constants.mjs';
import { loadInterFontCss } from './fonts.mjs';
import { waitForPlugin } from './plugin.mjs';
import { stabilizeVaultName } from './vault.mjs';
import { assertFrameSize, lockElectronWindow } from './window.mjs';

/**
 * Force Obsidian's UI language, reloading only when it actually changes (a
 * reload costs ~2s and would otherwise run on every scenario).
 */
export async function setLocale(locale, pluginId) {
	const needsReload = await browser.execute((lang) => {
		const current = window.localStorage.getItem('language');
		if (current === lang) return false;
		window.localStorage.setItem('language', lang);
		return true;
	}, locale);

	if (!needsReload) return;

	await browser.executeObsidian(({ app }) => {
		app.commands.executeCommandById('app:reload');
	});
	await browser.pause(2000);
	if (pluginId) await waitForPlugin(pluginId);
}

/**
 * Freeze everything that can differ between two runs of the same scenario, then
 * assert the frame really is the expected size.
 *
 * What each block removes, in order:
 *  - bundled Inter, forced on every element: no dependency on installed fonts;
 *  - forced light theme: the host's theme choice cannot bleed in;
 *  - hidden status bar / tab headers / right split: these carry volatile text
 *    (clock, word count, file names) that changes between runs;
 *  - pinned left split width: layout jitter;
 *  - `.app-container` pinned to the frame: capture size cannot drift;
 *  - zeroed animations and transitions: the single largest source of
 *    frame-to-frame noise;
 *  - hidden caret and selection: a blinking cursor makes two otherwise
 *    identical screenshots differ.
 */
export async function configureDemoEnvironment({
	pluginId,
	locale = 'en',
	stableVaultName = STABLE_VAULT_NAME,
	styleId = 'demo-freeze-style',
	viewportWidth = DEMO_VIEWPORT_WIDTH,
	viewportHeight = DEMO_VIEWPORT_HEIGHT,
	leftSplitWidth = LEFT_SPLIT_WIDTH,
} = {}) {
	await setLocale(locale, pluginId);

	const interFontCss = await loadInterFontCss();

	await browser.execute((id, leftWidth, frameW, frameH, fontCss) => {
		document.getElementById(id)?.remove();

		const style = document.createElement('style');
		style.id = id;
		style.textContent = `
			${fontCss}
			body, body * {
				font-family: 'Inter', sans-serif !important;
			}
			body.theme-dark {
				color-scheme: light;
			}
			body.theme-dark,
			body.theme-dark .app-container {
				background: var(--background-primary);
			}
			.workspace-split.mod-right-split,
			.status-bar,
			.workspace-tab-header-container {
				display: none !important;
			}
			.workspace-split.mod-left-split {
				width: ${leftWidth}px !important;
				min-width: ${leftWidth}px !important;
				max-width: ${leftWidth}px !important;
				flex: 0 0 ${leftWidth}px !important;
			}
			/*
			 * Belt-and-braces: pin .app-container to exactly the screenshot frame.
			 * The Electron window is resized to the same size (lockElectronWindow)
			 * so popovers and menus stay inside the frame.
			 */
			.app-container {
				width: ${frameW}px !important;
				height: ${frameH}px !important;
				overflow: hidden !important;
			}
			*, *::before, *::after {
				animation-duration: 0ms !important;
				animation-delay: 0ms !important;
				transition-duration: 0ms !important;
				transition-delay: 0ms !important;
				scroll-behavior: auto !important;
			}
			.cm-cursor, .cm-cursorLayer, .cm-fat-cursor {
				visibility: hidden !important;
				opacity: 0 !important;
			}
			.cm-content,
			input, textarea, [contenteditable="true"] {
				caret-color: transparent !important;
			}
			.cm-selectionBackground,
			::selection,
			::-moz-selection {
				background: transparent !important;
			}
		`;
		document.head.append(style);

		document.body.classList.remove('theme-dark');
		document.body.classList.add('theme-light');
		window.dispatchEvent(new Event('resize'));
	}, styleId, leftSplitWidth, viewportWidth, viewportHeight, interFontCss);

	await browser.execute(async () => {
		if (document.fonts && typeof document.fonts.ready?.then === 'function') {
			await document.fonts.ready;
		}
	});

	await browser.executeObsidian(({ app }, leftWidth) => {
		const left = app.workspace.leftSplit;
		left?.expand?.();
		if (left && typeof left.setSize === 'function') {
			left.setSize(leftWidth);
		}
	}, leftSplitWidth);

	if (stableVaultName) {
		await stabilizeVaultName(stableVaultName);
	}

	await lockElectronWindow(viewportWidth, viewportHeight);
	await assertFrameSize(viewportWidth, viewportHeight);
}
