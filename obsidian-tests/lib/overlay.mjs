import { browser } from '@wdio/globals';

const OVERLAY_ID = 'demo-key-overlay';

/**
 * Show a caption in the corner of the frame — used to narrate which key the
 * demo is "pressing", since a GIF cannot show the keyboard.
 *
 * The font stack is pinned explicitly: this element is created by the harness,
 * so it is not covered by the Inter override applied to the app's own UI.
 */
export async function showKeyOverlay(label, overlayId = OVERLAY_ID) {
	await browser.execute((text, id) => {
		let overlay = document.getElementById(id);
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = id;
			overlay.style.cssText = `
				position: fixed;
				right: 28px;
				bottom: 28px;
				z-index: 10000;
				padding: 10px 14px;
				border-radius: 12px;
				background: rgba(28, 28, 30, 0.88);
				color: #fff;
				font: 600 18px/1.2 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
				letter-spacing: 0.02em;
				box-shadow: 0 14px 32px rgba(0, 0, 0, 0.18);
			`;
			document.body.append(overlay);
		}
		overlay.textContent = text;
		overlay.style.display = 'block';
	}, label, overlayId);
}

export async function hideKeyOverlay(overlayId = OVERLAY_ID) {
	await browser.execute((id) => {
		const overlay = document.getElementById(id);
		if (!overlay) return;
		overlay.textContent = '';
		overlay.style.display = 'none';
	}, overlayId);
}

/** Show the caption, record a frame, then hide it again unless asked to keep it. */
export async function captureKeyPress(recorder, label, durationMs = 650, options = {}) {
	const { keepVisible = false, overlayId = OVERLAY_ID } = options;
	await showKeyOverlay(label, overlayId);
	await recorder.captureAndPause(durationMs);
	if (!keepVisible) await hideKeyOverlay(overlayId);
}
