import assert from 'node:assert/strict';
import { browser } from '@wdio/globals';
import { APP_SELECTOR } from './constants.mjs';

/**
 * Resize the actual Electron BrowserWindow so the inner viewport matches the
 * screenshot frame.
 *
 * Pinning `.app-container` via CSS is not enough on its own: popovers and menus
 * position themselves against the full Electron viewport, so if the window is
 * larger than the captured element they render outside the screenshot.
 *
 * Tries the Electron-native API first (Obsidian's renderer has node
 * integration), then falls back to `window.resizeTo` — chromedriver classic does
 * not support WebDriver's window/rect commands for Electron windows.
 */
export async function lockElectronWindow(innerWidth, innerHeight) {
	await browser.execute((targetW, targetH) => {
		let win = null;
		try {
			const electron = window.require?.('electron');
			win = electron?.remote?.getCurrentWindow?.()
				?? electron?.BrowserWindow?.getFocusedWindow?.()
				?? null;
		} catch {
			win = null;
		}

		if (win && typeof win.setContentSize === 'function') {
			win.setResizable?.(true);
			win.setContentSize(targetW, targetH);
			return;
		}
		if (win && typeof win.setSize === 'function') {
			const chromeW = window.outerWidth - window.innerWidth;
			const chromeH = window.outerHeight - window.innerHeight;
			win.setResizable?.(true);
			win.setSize(targetW + chromeW, targetH + chromeH);
			return;
		}

		window.resizeTo(targetW, targetH);
		const chromeW = window.outerWidth - window.innerWidth;
		const chromeH = window.outerHeight - window.innerHeight;
		if (chromeW !== 0 || chromeH !== 0) {
			window.resizeTo(targetW + chromeW, targetH + chromeH);
		}
	}, innerWidth, innerHeight);

	const final = await browser.execute(() => ({ iw: window.innerWidth, ih: window.innerHeight }));
	assert.equal(final.iw, innerWidth, `viewport innerWidth ${final.iw} != ${innerWidth}`);
	assert.equal(final.ih, innerHeight, `viewport innerHeight ${final.ih} != ${innerHeight}`);
}

/**
 * Fail the run rather than emit an off-size PNG. A wrong frame size is the one
 * screenshot defect that silently produces a "valid" but useless asset.
 */
export async function assertFrameSize(expectedWidth, expectedHeight) {
	const actual = await browser.execute((selector) => {
		const el = document.querySelector(selector);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return { width: Math.round(r.width), height: Math.round(r.height) };
	}, APP_SELECTOR);

	assert.ok(actual, `${APP_SELECTOR} not found`);
	assert.equal(actual.width, expectedWidth, `${APP_SELECTOR} width ${actual.width} != ${expectedWidth}`);
	assert.equal(actual.height, expectedHeight, `${APP_SELECTOR} height ${actual.height} != ${expectedHeight}`);
}
