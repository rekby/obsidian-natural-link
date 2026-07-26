_Read this in English: [README.md](README.md)._

# {{PLUGIN_NAME}}

{{PLUGIN_DESCRIPTION}}

## Возможности

- _Что плагин делает с точки зрения пользователя._

## Установка

### Каталог плагинов

Настройки → Сторонние плагины → Обзор → найдите «{{PLUGIN_NAME}}».

### BRAT

Добавьте `{{PLUGIN_AUTHOR}}/{{PLUGIN_ID}}` в плагин BRAT, чтобы получать
пре-релизы.

### Вручную

Скачайте `main.js`, `manifest.json` и `styles.css` из
[последнего релиза](https://github.com/{{PLUGIN_AUTHOR}}/{{PLUGIN_ID}}/releases/latest)
в каталог `<хранилище>/.obsidian/plugins/{{PLUGIN_ID}}/` и включите плагин.

## Настройки

| Настройка | По умолчанию | Описание |
| --- | --- | --- |
| Greeting | `Hello from {{PLUGIN_NAME}}` | Текст, который показывает команда «Say hello». |

## Разработка

```bash
npm install
npm run dev              # сборка в режиме наблюдения
npm run build            # проверка типов + продакшен-сборка
npm test                 # юнит-тесты
npm run obsidian-tests   # e2e в настоящем Obsidian
npm run demo             # перегенерация скриншотов (побайтово воспроизводимая)
```

## Лицензия

AGPL-3.0-or-later — см. [LICENSE](LICENSE).
