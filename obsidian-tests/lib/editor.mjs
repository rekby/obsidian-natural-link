import { browser } from '@wdio/globals';
import { VAULT_NAME_SELECTORS } from './constants.mjs';

/**
 * Put the active editor into a known state: cursor at the start of the file,
 * no selection, scrolled to the top.
 *
 * Without this the cursor lands wherever Obsidian last left it, which varies
 * between runs and shifts the rendered content.
 */
export async function normalizeEditorState() {
	await browser.executeObsidian(({ app, obsidian }) => {
		const view = app.workspace.getActiveViewOfType?.(obsidian.MarkdownView);
		if (!view) return;

		const editor = view.editor;
		const start = { line: 0, ch: 0 };
		editor.setSelection(start, start);
		editor.scrollTo(0, 0);

		if (typeof view.contentEl?.scrollTo === 'function') {
			view.contentEl.scrollTo(0, 0);
		}
		const scrollers = view.containerEl?.querySelectorAll?.('.cm-scroller, .markdown-preview-view') ?? [];
		scrollers.forEach((el) => {
			el.scrollTop = 0;
			el.scrollLeft = 0;
		});
	});

	await blurActiveElement();
}

export async function blurActiveElement() {
	await browser.execute(() => {
		const active = document.activeElement;
		if (active && typeof active.blur === 'function' && active !== document.body) {
			active.blur();
		}
	});
}

/**
 * Quiet the page immediately before a screenshot: drop focus (avoids caret and
 * selection artefacts), re-assert the stable vault name, wait for webfonts, then
 * flush two paint frames.
 *
 * The double `requestAnimationFrame` is what guarantees the compositor has
 * committed a frame — a single one can return before the paint lands.
 */
export async function prepareForScreenshot() {
	await browser.executeObsidian(async ({ app }, selectors) => {
		// Never block forever: fonts.ready and rAF both stall in a backgrounded
		// window, and a hung wait here surfaces as an opaque WebDriver script
		// timeout minutes later. Capturing a frame slightly early is recoverable;
		// losing the whole run is not.
		const withDeadline = (promise, ms) => Promise.race([
			promise,
			new Promise((resolve) => setTimeout(resolve, ms)),
		]);

		const active = document.activeElement;
		if (active && typeof active.blur === 'function' && active !== document.body) {
			active.blur();
		}

		const stableName = app.vault.getName();
		document.querySelectorAll(selectors).forEach((el) => {
			if (el.textContent !== stableName) el.textContent = stableName;
		});

		if (document.fonts && typeof document.fonts.ready?.then === 'function') {
			await withDeadline(document.fonts.ready, 2000);
		}
		await withDeadline(
			new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
			1000,
		);
	}, VAULT_NAME_SELECTORS);
}
