import type { en } from "./en";

export const ru: Partial<typeof en> = {
	"command.natural-link": "Вставить естественную ссылку",
	"command.toggle-inline-link-suggest": "Переключить подсказки [[",
	"command.toggle-inline-link-suggest.enabled": "подсказки [[ включены",
	"command.toggle-inline-link-suggest.disabled": "подсказки [[ отключены",
	"modal.placeholder": "Начните вводить для поиска заметок...",
	"modal.no-results": "Подходящих заметок не найдено",
	"modal.instruction.navigate": "Навигация",
	"modal.instruction.insert-link": "Вставить ссылку",
	"modal.instruction.insert-as-typed": "Вставить ссылку как введено",
	"modal.instruction.dismiss": "Закрыть",
	"modal.note-not-created": "(ещё не создана)",
	"suggest.heading-badge": "заголовок",
	"suggest.block-badge": "блок",
	"settings.title": "Natural link",
	"settings.hotkey-button": "Назначить горячую клавишу",
	"settings.hotkey-description": "Назначьте горячую клавишу для быстрой вставки естественных ссылок",
	"settings.search-non-existing-notes": "Искать несуществующие заметки",
	"settings.search-non-existing-notes-description":
		"Включить в результаты поиска заметки, на которые есть ссылки, но которые ещё не созданы",
	"settings.inline-link-suggest":
		"Заменить стандартные подсказки [[ (экспериментально)",
	"settings.inline-link-suggest-description":
		"Использовать морфологический поиск плагина вместо стандартного автодополнения при вводе [[",
};
