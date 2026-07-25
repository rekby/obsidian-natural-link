_Читайте на русском: [README.ru.md](README.ru.md)._

# {{PLUGIN_NAME}}

{{PLUGIN_DESCRIPTION}}

## Features

- _What the plugin does, from the user's point of view._

## Installation

### Community plugins

Settings → Community plugins → Browse → search for "{{PLUGIN_NAME}}".

### BRAT

Add `{{PLUGIN_AUTHOR}}/{{PLUGIN_ID}}` in the BRAT plugin to follow pre-releases.

### Manual

Download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/{{PLUGIN_AUTHOR}}/{{PLUGIN_ID}}/releases/latest)
into `<vault>/.obsidian/plugins/{{PLUGIN_ID}}/`, then enable the plugin.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| Greeting | `Hello from {{PLUGIN_NAME}}` | Text shown by the "Say hello" command. |

## Development

```bash
npm install
npm run dev              # watch build
npm run build            # type-check + production bundle
npm test                 # unit tests
npm run obsidian-tests   # e2e against a real Obsidian
npm run demo             # regenerate README screenshots (byte-reproducible)
```

## License

AGPL-3.0-or-later — see [LICENSE](LICENSE).
