# Demo assets: byte-reproducible screenshots and GIFs

README screenshots are generated, not taken by hand, and regenerating them
without changing the plugin must produce **identical bytes**. That is what lets
you re-run `npm run demo` freely: if nothing visual changed, git shows no diff
and the history stays clean.

```bash
npm run demo            # capture + render + checksums
npm run demo:capture    # capture frames and PNGs only
npm run demo:render     # render GIFs, optimize PNGs, write CHECKSUMS.txt
DEMO_VERIFY=0 npm run demo:render   # skip the re-render self-check while iterating
node obsidian-tests/lib/checksums.mjs verify   # check without regenerating
```

Assets live in `docs/demo/` (plus `docs/demo/ru/` for Russian), with
`docs/demo/CHECKSUMS.txt` committed alongside. Raw frames land in
`obsidian-tests/demo-artifacts/` and are gitignored.

## The five layers of determinism

Every one of these is load-bearing; dropping any one reintroduces byte churn.

1. **Rendering flags** (`lib/chrome-options.mjs`) —
   `--force-device-scale-factor=1` (a Retina host would otherwise render 2× the
   pixels), `--disable-lcd-text` (subpixel AA varies by display and GPU),
   `--font-render-hinting=none` (hinting varies by platform).

2. **Bundled font** (`lib/fonts.mjs`) — Inter is loaded from
   `node_modules/@fontsource/inter` via `file://` `@font-face` and forced onto
   every element, so the host's installed fonts do not matter. Capture waits on
   `document.fonts.ready`.

3. **Frozen UI** (`lib/freeze-ui.mjs`) — forced light theme; hidden status bar,
   tab headers and right split (they carry a clock, word counts, file names);
   pinned sidebar width; `.app-container` pinned to 800×600; all animations and
   transitions zeroed; caret and selection hidden. Plus
   `lib/window.mjs` resizing the real Electron window to the same size (menus
   position against the window, not the captured element) and asserting the
   result, and `lib/vault.mjs` replacing the random temp-vault name with a
   stable one.

4. **Quiescing before each shot** (`lib/editor.mjs`) — blur the focused element,
   await webfonts, then two nested `requestAnimationFrame`s so the compositor
   has committed a frame.

5. **Byte-level post-processing** (`lib/render-demo.mjs`) —
   `oxipng --strip all --threads 1` removes the tIME/iCCP/tEXt chunks browsers
   embed (single-threaded because parallel deflate is not reproducible); ffmpeg
   comes pinned from `ffmpeg-static` and runs with `-fflags/-flags:v +bitexact`,
   ordered `dither=bayer`, and no scale filter. Then each GIF is re-rendered to
   a tmpfile and compared by sha256.

Obsidian itself is pinned to `manifest.minAppVersion` — a floating "latest"
would change rendering whenever Obsidian ships a release.

## Writing a scenario

- Launch Obsidian **once** per run. Between scenarios use `syncVaultFiles()` to
  restore file contents in place instead of restarting.
- **Assert, then capture.** Wait for the state you intend to show — text
  present, item selected, menu open — before taking the shot. This, not luck, is
  what keeps captures stable.
- Reset anything order-dependent: recency lists, "last opened" state, cursor
  position (`normalizeEditorState()`).
- Human pacing: ~200 ms per typed character, ~800 ms at beats. GIF timing comes
  from the frame manifest, not from wall-clock capture, so a slow machine
  produces the same GIF.
- Capture `.app-container`, never the desktop.
- Add every scenario in both locales unless it is deliberately language-specific.
- Keep demo-only behaviour in the harness. The plugin must not know it is being
  demoed.

## When assets change

Regenerate and commit `docs/demo/**` together with `CHECKSUMS.txt`. Reviewing
the checksum diff tells you at a glance whether pixels moved or only metadata.
A change in `obsidian-tests/lib/**` can shift every asset in every plugin —
regenerate each plugin's demos after syncing such a change.
