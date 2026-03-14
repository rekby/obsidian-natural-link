# Demo workflow

This file covers the localized README demo suite: demo vault content, static screenshot capture, and GIF rendering.

## Demo assets

- Demo vaults live in `obsidian-tests/demo-vaults/en` and `obsidian-tests/demo-vaults/ru`.
- Raw captured frames and manifests are written to `obsidian-tests/demo-artifacts/` and must stay gitignored.
- Static README screenshots are written to `docs/demo/en/*.png` and `docs/demo/ru/*.png`.
- Final README assets are rendered into `docs/demo/en/*.gif` and `docs/demo/ru/*.gif`.

## Scenario matrix

Each locale captures the same four scenarios:

- `modal-search`: open the command modal, type a morphology-based query, accept with `Tab`.
- `inline-link`: type `[[...` inline with plugin suggest enabled, accept with `Enter`.
- `heading-link`: search note first, then narrow with `#heading` and accept with `Tab`.
- `block-link`: search note first, then narrow with `^block`, accept with `Enter`, then show the written `^blockId` in the target note.

The scenario names are stable because they are reused in:
- artifact directories;
- output GIF filenames;
- README image paths.

## Capture rules

- Use `wdio.demo.conf.mjs` and `obsidian-tests/demo/demo.e2e.mjs` for demo capture. Keep this separate from smoke E2E in `wdio.conf.mjs`.
- Keep the plugin runtime unchanged. Demo-specific behavior belongs in test helpers only.
- Use a human pace: about 200 ms per typed character and about 800 ms for major pauses.
- Capture the Obsidian app container instead of the entire desktop. Hide sidebars/status UI in the test helper so GIFs stay compact and stable.
- Verify the final editor text for every scenario. For block demos, also verify that the target note actually gets a generated `^id`.
- Keep locale assertions in the flow so English and Russian demos prove the plugin UI is localized.

## Regeneration commands

```bash
npm run demo:screenshots
npm run demo:capture
npm run demo:render
npm run demo
```

- `demo:screenshots` builds the plugin and refreshes the localized README PNG screenshots for both English and Russian.
- `demo:capture` builds the plugin and records PNG frames plus JSON manifests.
- `demo:render` requires `ffmpeg` and converts every manifest into a GIF.
- `demo` refreshes the static README PNG screenshots and then runs the GIF pipeline end-to-end.

## Maintenance expectations

- If scenario text, filenames, or output paths change, update both README files in the same change.
- Keep demo vault notes human-readable and realistic; do not replace them with test-fixture gibberish.
- When adding a new demo scenario, add it for both locales unless the user explicitly wants a language-specific example.
