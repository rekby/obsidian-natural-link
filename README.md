*Читайте на [русском](README.ru.md).*

# Natural Link

An Obsidian plugin that lets you create links to notes using natural word forms. Type a word in any grammatical form and the plugin will find matching notes regardless of declension, conjugation, or word order.

![Search example: typing "runnin" finds the note "Run is good"](Screenshot.png)

## Features

- **Morphological search**: Find notes by any word form. Searching for "деревянную коробку" will match a note titled "Деревянная коробка".
- **Prefix matching**: Results update as you type. Even incomplete words match — typing "кор" will find "Коробка".
- **Alias support**: Searches across note titles and frontmatter aliases.
- **Word order independence**: "коробку деревянную" finds "Деревянная коробка".
- **Multi-language**: Russian and English stemming work simultaneously. The plugin determines word stems algorithmically, no dictionaries required.
- **Insert link as typed**: Press **Shift+Enter** to insert a link with your exact input as both target and display text, bypassing search results.
- **Preserved display text**: Links are always created as `[[Note Title|your input]]`, so your original text is preserved even if the note is renamed.
- **Localized UI**: Interface available in English and Russian. Language follows your Obsidian settings.

## Usage

1. Open the command palette (Cmd/Ctrl+P) and run **Insert natural link**, or use your assigned hotkey.
2. Start typing the word or phrase you want to link.
3. Select a matching note from the suggestions and press **Enter**.
4. The plugin inserts a wikilink: `[[Matched Note|your typed text]]`.

**Tip**: Press **Shift+Enter** at any time to insert a link using your exact input as-is, bypassing search results. The result is `[[your typed text|your typed text]]`.

### Recommended hotkey

The plugin does not assign a hotkey by default. We recommend **Cmd/Ctrl+Shift+K** (next to Cmd+K which is "Insert link" in Obsidian). To set it up:

1. Go to **Settings → Hotkeys**
2. Search for "Natural Link"
3. Assign your preferred shortcut

You can also open the hotkey settings directly from the plugin's settings tab.

## Examples

| You type | Note found | Link created |
|----------|-----------|--------------|
| running shoes | Running shoes | `[[Running shoes\|running shoes]]` |
| run shoe | Running shoes | `[[Running shoes\|run shoe]]` |

## Installation

### From Obsidian Community Plugins

> **Status**: The plugin has been submitted to the official community plugin list and is awaiting review. Once approved, it will be available directly from Obsidian.

1. Open **Settings → Community plugins → Browse**.
2. Search for **Natural Link**.
3. Click **Install**, then **Enable**.

### Via BRAT (recommended while awaiting official listing)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) (Beta Reviewers Auto-update Tester) lets you install plugins directly from GitHub and keeps them up to date automatically.

1. Install the **BRAT** plugin from Obsidian Community Plugins if you haven't already.
2. Open **Settings → BRAT → Add Beta plugin**.
3. Enter the repository URL: `https://github.com/rekby/obsidian-natural-link`
4. Click **Add Plugin**.
5. Enable **Natural Link** in **Settings → Community plugins**.

BRAT will automatically check for updates and keep the plugin current.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/rekby/obsidian-natural-link/releases/latest).
2. Create a folder `<Vault>/.obsidian/plugins/obsidian-natural-link/`.
3. Copy the downloaded files into that folder.
4. Reload Obsidian and enable **Natural Link** in **Settings → Community plugins**.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode
npm run build        # Type check + production build
npm test             # Run tests
npm run test:watch   # Watch mode tests
npm run lint         # Lint
```

## Known limitations

- **Consonant alternations**: Snowball stemming is algorithmic and does not handle root consonant changes (e.g. "бег" and "бежать" have different stems). Full lemmatization support is planned for a future release.
- **No typo tolerance**: Currently matches are exact on stems. Fuzzy matching is planned.

## License

[MIT](LICENSE)
