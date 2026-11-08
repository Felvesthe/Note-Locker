import { setIcon } from 'obsidian';
import { LOCKS_CHANGED } from '../lockActions';
import type NoteLockerPlugin from '../main';
import type { LockTarget } from '../types';
import { iconForLevel } from './noteState';

const ICON_CLASS = 'note-locker-explorer-icon';
const TITLE_SELECTOR = '.nav-file-title[data-path], .nav-folder-title[data-path]';

export class ExplorerIcons {
	private readonly observers = new Map<HTMLElement, MutationObserver>();
	private pendingFrame: number | null = null;

	constructor(private readonly plugin: NoteLockerPlugin) {}

	start(): void {
		const { workspace } = this.plugin.app;
		this.plugin.registerEvent(workspace.on('layout-change', () => this.refresh()));
		this.plugin.registerEvent(this.plugin.actions.on(LOCKS_CHANGED, () => this.requestDecorate()));
		this.refresh();
	}

	stop(): void {
		if (this.pendingFrame !== null) window.cancelAnimationFrame(this.pendingFrame);
		this.pendingFrame = null;
		for (const observer of this.observers.values()) observer.disconnect();
		for (const container of this.observers.keys()) {
			container.querySelectorAll(`.${ICON_CLASS}`).forEach((icon) => icon.remove());
		}
		this.observers.clear();
	}

	refresh(): void {
		if (!this.plugin.settings.showExplorerIcons) {
			this.stop();
			return;
		}

		const containers = this.explorerContainers();
		for (const [container, observer] of this.observers) {
			if (!containers.includes(container)) {
				observer.disconnect();
				this.observers.delete(container);
			}
		}
		for (const container of containers) {
			if (this.observers.has(container)) continue;
			const observer = new MutationObserver((mutations) => {
				if (mutations.some(changesExplorerItems)) this.requestDecorate();
			});
			observer.observe(container, { childList: true, subtree: true });
			this.observers.set(container, observer);
		}
		this.requestDecorate();
	}

	private requestDecorate(): void {
		if (this.pendingFrame !== null) return;
		this.pendingFrame = window.requestAnimationFrame(() => {
			this.pendingFrame = null;
			for (const container of this.observers.keys()) this.decorate(container);
		});
	}

	private decorate(container: HTMLElement): void {
		container.querySelectorAll<HTMLElement>(TITLE_SELECTOR).forEach((titleEl) => {
			const path = titleEl.dataset.path;
			if (!path) return;

			const target: LockTarget = {
				kind: titleEl.classList.contains('nav-folder-title') ? 'folder' : 'note',
				path,
			};
			const level = this.plugin.locks.getOwnLevel(target);
			const iconEl = titleEl.querySelector<HTMLElement>(`:scope > .${ICON_CLASS}`);

			if (!level) {
				iconEl?.remove();
				return;
			}

			const icon = iconForLevel(level);
			const el = iconEl ?? titleEl.createDiv({ cls: ICON_CLASS });
			if (el.dataset.icon !== icon) {
				setIcon(el, icon);
				el.dataset.icon = icon;
				el.dataset.level = level;
			}
		});
	}

	private explorerContainers(): HTMLElement[] {
		return this.plugin.app.workspace.getLeavesOfType('file-explorer').map((leaf) => leaf.view.containerEl);
	}
}

function changesExplorerItems(mutation: MutationRecord): boolean {
	if (isInsideIcon(mutation.target)) return false;
	const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
	return nodes.some((node) => !isIcon(node));
}

function isIcon(node: Node): boolean {
	return node.instanceOf(HTMLElement) && node.hasClass(ICON_CLASS);
}

function isInsideIcon(node: Node): boolean {
	return node.instanceOf(Element) && node.closest(`.${ICON_CLASS}`) !== null;
}
