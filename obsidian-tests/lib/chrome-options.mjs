/**
 * Chromium flags that remove machine-dependent rendering from screenshots.
 *
 * - force-device-scale-factor=1: without it a HiDPI/Retina host renders 2x the
 *   pixels of a 1x host, so the PNGs differ in size, not just in bytes.
 * - disable-lcd-text: subpixel (RGB) antialiasing depends on the display and
 *   the GPU; grayscale AA is stable everywhere.
 * - font-render-hinting=none: hinting differs between platforms and FreeType
 *   builds, shifting glyphs by a pixel.
 */
export const DETERMINISTIC_CHROME_OPTIONS = {
	args: [
		'--force-device-scale-factor=1',
		'--disable-lcd-text',
		'--font-render-hinting=none',
	],
};
