# Contributing to Natural link

Thanks for your interest in improving the plugin. This document covers how to get a local checkout running, how the codebase is laid out, and the conventions changes are expected to follow.

## Prerequisites

- Node.js 22+
- npm 10+
- Obsidian (for manual verification and end-to-end tests)
- `ffmpeg` (only required for regenerating README demo GIFs)

## Getting started

```bash
git clone https://github.com/rekby/obsidian-natural-link.git
cd obsidian-natural-link
npm install
npm run build
```

The build emits `main.js`; copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/natural-link/` to try the plugin locally, or symlink the repo into your test vault.

## Common scripts

- `npm run dev` — esbuild watch mode.
- `npm run build` — type-check (`tsc --noEmit`) and produce a production bundle.
- `npm test` — vitest unit tests.
- `npm run lint` — ESLint with the Obsidian plugin ruleset.
- `npm run obsidian-tests` — WebdriverIO end-to-end tests inside Obsidian.
- `npm run demo` — full README screenshot + GIF regeneration pipeline.

Before opening a pull request please run at least `npm run build`, `npm test`, and `npm run lint`.

## Project layout

- `src/main.ts` — plugin lifecycle and command registration. Keep this file small.
- `src/search/` — note index, ranking, recency, link aliases.
- `src/stemming/` — multi-language stemmer wrapper around `snowball-stemmers`.
- `src/ui/` — modal, inline suggester, query parsing, and shared rendering. Cross-UI behavior must live in `src/ui/link-suggest-core.ts`.
- `src/i18n/` — translation modules (`en.ts`, `ru.ts`) and the `t()` helper.
- `tests/` — vitest unit tests mirroring the `src/` layout.
- `obsidian-tests/` — WebdriverIO end-to-end tests and the demo capture pipeline.
- `agents/` — task-oriented architecture and workflow guides; read these before making non-trivial changes.

## Conventions

- Keep modal and inline suggest behavior in lockstep via `LinkSuggestCore`.
- Add or update tests in `tests/**` alongside any logic change.
- Any new user-visible string must be added to both `src/i18n/en.ts` and `src/i18n/ru.ts`.
- Follow the Obsidian plugin guidelines that the ESLint config enforces (sentence-case UI strings, no bare timers, no DOM string assignment, etc.).
- Do not commit generated artifacts under `obsidian-tests/demo-artifacts/`.

## Submitting changes

1. Fork the repository and create a topic branch.
2. Make focused commits — a single change per commit is preferred.
3. Run build, tests, and lint locally.
4. Open a pull request describing what changed and why, referencing any related issue.
5. If your change alters user-visible behavior or strings, update `README.md`, `README.ru.md`, and the relevant `agents/*.md` files in the same PR.

## Reporting bugs

Open an issue at https://github.com/rekby/obsidian-natural-link/issues with:

- Obsidian version and operating system.
- Plugin version (from `manifest.json` or the community plugins list).
- Steps to reproduce and the observed vs. expected behavior.
- Console output (`Ctrl+Shift+I` → Console) if relevant.
