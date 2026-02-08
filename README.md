# Natural Link

An Obsidian plugin that lets you create links to notes using natural word forms. Type a word in any grammatical form and the plugin will find matching notes regardless of declension, conjugation, or word order.

## Features

- **Morphological search**: Find notes by any word form. Searching for "деревянную коробку" will match a note titled "Деревянная коробка".
- **Prefix matching**: Results update as you type. Even incomplete words match — typing "кор" will find "Коробка".
- **Alias support**: Searches across note titles and frontmatter aliases.
- **Word order independence**: "коробку деревянную" finds "Деревянная коробка".
- **Multi-language**: Russian and English stemming work simultaneously. The plugin determines word stems algorithmically, no dictionaries required.
- **Preserved display text**: Links are always created as `[[Note Title|your input]]`, so your original text is preserved even if the note is renamed.
- **Localized UI**: Interface available in English and Russian. Language follows your Obsidian settings.

## Usage

1. Open the command palette (Cmd/Ctrl+P) and run **Insert natural link**, or use your assigned hotkey.
2. Start typing the word or phrase you want to link.
3. Select a matching note from the suggestions.
4. The plugin inserts a wikilink: `[[Matched Note|your typed text]]`.

### Recommended hotkey

The plugin does not assign a hotkey by default. We recommend **Cmd/Ctrl+Shift+K** (next to Cmd+K which is "Insert link" in Obsidian). To set it up:

1. Go to **Settings → Hotkeys**
2. Search for "Natural Link"
3. Assign your preferred shortcut

You can also open the hotkey settings directly from the plugin's settings tab.

## Examples

| You type | Note found | Link created |
|----------|-----------|--------------|
| деревянную коробку | Деревянная коробка | `[[Деревянная коробка\|деревянную коробку]]` |
| коробку | Деревянная коробка | `[[Деревянная коробка\|коробку]]` |
| кор | Коробка | `[[Коробка\|кор]]` |
| running shoes | Running shoes | `[[Running shoes\|running shoes]]` |
| run shoe | Running shoes | `[[Running shoes\|run shoe]]` |

## Installation

### From Obsidian Community Plugins

*(Coming soon)*

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
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

[0-BSD](LICENSE)
