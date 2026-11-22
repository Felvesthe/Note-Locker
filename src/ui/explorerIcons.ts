import { setIcon } from 'obsidian';
import { NOTEBOOK_NAVIGATOR_ICON_SURFACE } from '../integrations/notebookNavigator';
import { LOCKS_CHANGED } from '../lockActions';
import type NoteLockerPlugin from '../main';
import type { LockTargetKind, NoteLockerSettings } from '../types';
import { iconForLevel } from './noteState';

const ICON_CLASS = 'note-locker-explorer-icon';

export interface IconSurface {
	viewType: string;
	isEnabled(settings: NoteLockerSettings): boolean;
	itemWithPathSelector: string;
	kindOf(itemEl: HTMLElement): LockTargetKind;
	iconContainerOf(itemEl: HTMLElement): HTMLElement | null;
}

const FILE_EXPLORER_ICON_SURFACE: IconSurface = {
	viewType: 'file-explorer',
	isEnabled: (settings) => settings.showExplorerIcons,
	itemWithPathSelector: '.nav-file-title[data-path], .nav-folder-title[data-path]',
	kindOf: (itemEl) => (itemEl.classList.contains('nav-folder-title') ? 'folder' : 'note'),
	iconContainerOf: (itemEl) => itemEl,
};

const SURFACES: IconSurface[] = [FILE_EXPLORER_ICON_SURFACE, NOTEBOOK_NAVIGATOR_ICON_SURFACE];

export class ExplorerIcons {
	private readonly observers = new Map<HTMLElement, { surface: IconSurface; observer: MutationObserver }>();
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
		for (const container of [...this.observers.keys()]) this.release(container);
	}

	refresh(): void {
		const containers = this.surfaceContainers();
		for (const container of [...this.observers.keys()]) {
			if (!containers.has(container)) this.release(container);
		}
		for (const [container, surface] of containers) {
			if (this.observers.has(container)) continue;
			const observer = new MutationObserver((mutations) => {
				if (mutations.some(changesListedItems)) this.requestDecorate();
			});
			observer.observe(container, { childList: true, subtree: true });
			this.observers.set(container, { surface, observer });
		}
		this.requestDecorate();
	}

	private release(container: HTMLElement): void {
		this.observers.get(container)?.observer.disconnect();
		this.observers.delete(container);
		container.querySelectorAll(`.${ICON_CLASS}`).forEach((icon) => icon.remove());
	}

	private requestDecorate(): void {
		if (this.pendingFrame !== null) return;
		this.pendingFrame = window.requestAnimationFrame(() => {
			this.pendingFrame = null;
			for (const [container, { surface }] of this.observers) this.decorate(container, surface);
		});
	}

	private decorate(container: HTMLElement, surface: IconSurface): void {
		container.querySelectorAll<HTMLElement>(surface.itemWithPathSelector).forEach((itemEl) => {
			const path = itemEl.dataset.path;
			const iconContainer = surface.iconContainerOf(itemEl);
			if (!path || !iconContainer) return;

			const level = this.plugin.locks.getOwnLevel({ kind: surface.kindOf(itemEl), path });
			const iconEl = iconContainer.querySelector<HTMLElement>(`:scope > .${ICON_CLASS}`);

			if (!level) {
				iconEl?.remove();
				return;
			}

			const icon = iconForLevel(level);
			const el = iconEl ?? iconContainer.createDiv({ cls: ICON_CLASS });
			if (el.dataset.icon !== icon) {
				setIcon(el, icon);
				el.dataset.icon = icon;
				el.dataset.level = level;
			}
		});
	}

	private surfaceContainers(): Map<HTMLElement, IconSurface> {
		const containers = new Map<HTMLElement, IconSurface>();
		for (const surface of SURFACES) {
			if (!surface.isEnabled(this.plugin.settings)) continue;
			for (const leaf of this.plugin.app.workspace.getLeavesOfType(surface.viewType)) {
				containers.set(leaf.view.containerEl, surface);
			}
		}
		return containers;
	}
}

function changesListedItems(mutation: MutationRecord): boolean {
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
