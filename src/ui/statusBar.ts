import { debounce, MarkdownView, Menu, Platform, setIcon, setTooltip } from 'obsidian';
import { LOCKS_CHANGED } from '../lockActions';
import type NoteLockerPlugin from '../main';
import { addNoteMenuItems } from './lockMenu';
import { describeNote } from './noteState';

export class StatusBar {
	private itemEl: HTMLElement | null = null;
	private readonly requestRefresh = debounce(() => this.refresh(), 0, true);

	constructor(private readonly plugin: NoteLockerPlugin) {}

	start(): void {
		const { workspace } = this.plugin.app;
		this.plugin.registerEvent(workspace.on('file-open', this.requestRefresh));
		this.plugin.registerEvent(workspace.on('active-leaf-change', this.requestRefresh));
		this.plugin.registerEvent(this.plugin.actions.on(LOCKS_CHANGED, this.requestRefresh));
		this.refresh();
	}

	stop(): void {
		this.requestRefresh.cancel();
		this.itemEl?.detach();
		this.itemEl = null;
	}

	refresh(): void {
		if (Platform.isMobile || !this.plugin.settings.showStatusBar) {
			this.stop();
			return;
		}

		const itemEl = this.itemEl ?? this.createItem();
		itemEl.empty();

		const view = this.activeMarkdownView();
		const path = view?.file?.path;
		itemEl.toggle(path !== undefined);
		if (!view || !path) return;

		const state = describeNote(this.plugin, path, view.leaf);
		setIcon(itemEl.createSpan({ cls: 'note-locker-status-icon' }), state.icon);
		itemEl.createSpan({ text: state.label });
		itemEl.dataset.level = state.level ?? 'none';
		setTooltip(itemEl, state.tooltip, { placement: 'top' });
	}

	private createItem(): HTMLElement {
		const itemEl = this.plugin.addStatusBarItem();
		itemEl.addClass('note-locker-status', 'mod-clickable');
		this.plugin.registerDomEvent(itemEl, 'click', (event) => this.openMenu(event));
		this.itemEl = itemEl;
		return itemEl;
	}

	private openMenu(event: MouseEvent): void {
		const view = this.activeMarkdownView();
		const path = view?.file?.path;
		if (!view || !path) return;

		const menu = new Menu();
		addNoteMenuItems(menu, this.plugin, path, view.leaf);
		menu.showAtMouseEvent(event);
	}

	private activeMarkdownView(): MarkdownView | null {
		const view = this.plugin.app.workspace.getMostRecentLeaf()?.view;
		return view instanceof MarkdownView ? view : null;
	}
}
