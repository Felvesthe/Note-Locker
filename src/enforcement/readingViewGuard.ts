import type { MarkdownView } from 'obsidian';
import type NoteLockerPlugin from '../main';

export const STRICT_VIEW_CLASS = 'note-locker-strict';

const PROTECTED_INPUT_SELECTOR = `.${STRICT_VIEW_CLASS} .task-list-item-checkbox`;
const PROTECTED_AREA_SELECTOR = `.${STRICT_VIEW_CLASS} .metadata-container`;
const EDITING_KEYS = new Set(['Backspace', 'Delete', 'Enter']);

export function markStrictView(view: MarkdownView, isStrict: boolean): void {
	view.containerEl.toggleClass(STRICT_VIEW_CLASS, isStrict);
}

export function registerReadingViewGuard(plugin: NoteLockerPlugin): void {
	const guardDocument = (doc: Document) => {
		plugin.registerDomEvent(doc, 'click', blockIn(PROTECTED_INPUT_SELECTOR), { capture: true });
		for (const type of ['beforeinput', 'paste', 'drop'] as const) {
			plugin.registerDomEvent(doc, type, blockIn(PROTECTED_AREA_SELECTOR), { capture: true });
		}
		plugin.registerDomEvent(
			doc,
			'keydown',
			(event) => {
				if (EDITING_KEYS.has(event.key)) blockIn(PROTECTED_AREA_SELECTOR)(event);
			},
			{ capture: true },
		);
	};

	guardDocument(document);
	plugin.registerEvent(plugin.app.workspace.on('window-open', (win) => guardDocument(win.doc)));
}

function blockIn(selector: string) {
	return (event: Event) => {
		if (targetElement(event)?.closest(selector)) {
			event.preventDefault();
			event.stopPropagation();
		}
	};
}

function targetElement(event: Event): Element | null {
	const target = event.target as Node | null;
	return target?.instanceOf(Element) ? target : null;
}
