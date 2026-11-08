import { debounce, MarkdownView, Menu, setIcon, setTooltip } from 'obsidian';
import { LOCKS_CHANGED } from '../lockActions';
import type NoteLockerPlugin from '../main';
import { addNoteMenuItems } from './lockMenu';
import { describeNote } from './noteState';

const BUTTON_CLASS = 'note-locker-header-button';

export class HeaderButtons {
	private readonly buttons = new Map<MarkdownView, HTMLElement>();
	private readonly requestRefresh = debounce(() => this.refresh(), 0, true);

	constructor(private readonly plugin: NoteLockerPlugin) {}

	start(): void {
		const { workspace } = this.plugin.app;
		this.plugin.registerEvent(workspace.on('file-open', this.requestRefresh));
		this.plugin.registerEvent(workspace.on('layout-change', this.requestRefresh));
		this.plugin.registerEvent(this.plugin.actions.on(LOCKS_CHANGED, this.requestRefresh));
		this.refresh();
	}

	stop(): void {
		this.requestRefresh.cancel();
		for (const button of this.buttons.values()) button.detach();
		this.buttons.clear();
	}

	refresh(): void {
		const views = this.plugin.settings.showHeaderButton ? this.markdownViews() : [];

		for (const [view, button] of this.buttons) {
			if (!views.includes(view)) {
				button.detach();
				this.buttons.delete(view);
			}
		}
		for (const view of views) this.render(view);
	}

	private render(view: MarkdownView): void {
		const path = view.file?.path;
		if (!path) return;

		const state = describeNote(this.plugin, path, view.leaf);
		let button = this.buttons.get(view);
		if (!button) {
			button = view.addAction(state.icon, state.tooltip, (event) => this.openMenu(event, view));
			button.addClass(BUTTON_CLASS);
			this.buttons.set(view, button);
		}

		if (button.dataset.icon !== state.icon) {
			setIcon(button, state.icon);
			button.dataset.icon = state.icon;
		}
		button.dataset.level = state.level ?? 'none';
		setTooltip(button, state.tooltip);
	}

	private openMenu(event: MouseEvent, view: MarkdownView): void {
		const path = view.file?.path;
		if (!path) return;

		const menu = new Menu();
		addNoteMenuItems(menu, this.plugin, path, view.leaf);
		menu.showAtMouseEvent(event);
	}

	private markdownViews(): MarkdownView[] {
		return this.plugin.app.workspace
			.getLeavesOfType('markdown')
			.map((leaf) => leaf.view)
			.filter((view): view is MarkdownView => view instanceof MarkdownView);
	}
}
