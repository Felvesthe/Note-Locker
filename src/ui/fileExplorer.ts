import { setIcon } from "obsidian";
import type NoteLockerPlugin from "../main";

export class FileExplorerUI {
	private plugin: NoteLockerPlugin;
	private folderObserver: MutationObserver | null = null;
	private updateDebounceTimeout: number | null = null;

	constructor(plugin: NoteLockerPlugin) {
		this.plugin = plugin;
	}

	public addFileExplorerIconStyling(): void {
		const styleEl = document.createElement('style');
		styleEl.id = 'note-locker-styles';
		styleEl.textContent = `
            .note-locker-icon {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-left: 6px;
                width: 14px;
                height: 14px;
                color: var(--text-accent);
                opacity: 0.8;
            }
            .nav-file-title, .nav-folder-title {
                display: flex;
                align-items: center;
            }
            .nav-file-title-content, .nav-folder-title-content {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
		document.head.appendChild(styleEl);

		this.plugin.app.workspace.onLayoutReady(() => {
			this.updateFileExplorerIcons();
			this.setupFolderObserver();
		});
	}

	private setupFolderObserver(): void {
		if (this.folderObserver) {
			this.folderObserver.disconnect();
			this.folderObserver = null;
		}

		const fileExplorer = document.querySelector('.workspace-split.mod-left-split .nav-files-container');
		if (!fileExplorer) return;

		this.folderObserver = new MutationObserver((mutations) => {
			let shouldUpdate = false;

			for (const mutation of mutations) {
				if (mutation.target instanceof HTMLElement &&
					(mutation.target.classList.contains('note-locker-icon') ||
						mutation.target.closest('.note-locker-icon'))) {
					continue;
				}

				if (mutation.type === 'childList') {
					const target = mutation.target as HTMLElement;
					const isTitle = target.classList.contains('nav-file-title') || target.classList.contains('nav-folder-title');

					let shouldProcess = false;

					for (let i = 0; i < mutation.addedNodes.length; i++) {
						const node = mutation.addedNodes[i];
						if (!(node instanceof HTMLElement && node.classList.contains('note-locker-icon'))) {
							shouldProcess = true;
							break;
						}
					}

					if (!shouldProcess) {
						for (let i = 0; i < mutation.removedNodes.length; i++) {
							shouldProcess = true;
							break;
						}
					}

					if (shouldProcess) {
						if (isTitle) {
							const container = target.parentElement;
							if (container) this.processItem(container);
						} else {
							this.handleAddedNodes(mutation.addedNodes);
						}
					}

				} else if (mutation.type === 'attributes') {
					if (mutation.target instanceof HTMLElement) {
						if (mutation.target.classList.contains('nav-file') || mutation.target.classList.contains('nav-folder')) {
							this.processItem(mutation.target);
						}
					}
				}
			}
		});

		this.folderObserver.observe(fileExplorer, {
			childList: true,
			attributes: true,
			attributeFilter: ['class', 'data-path', 'is-collapsed'],
			subtree: true
		});
	}

	private handleAddedNodes(nodeList: NodeList): void {
		nodeList.forEach((node) => {
			if (node instanceof HTMLElement) {
				if (node.classList.contains('nav-file') || node.classList.contains('nav-folder')) {
					this.processItem(node);
				}

				if (node.classList.contains('nav-file-title') || node.classList.contains('nav-folder-title')) {
					const container = node.parentElement;
					if (container) this.processItem(container);
				}

				const items = node.querySelectorAll('.nav-file, .nav-folder');
				items.forEach(item => this.processItem(item as HTMLElement));

				const titles = node.querySelectorAll('.nav-file-title, .nav-folder-title');
				titles.forEach(title => {
					const container = title.parentElement;
					if (container) this.processItem(container);
				});
			}
		});
	}

	private processItem(item: HTMLElement): void {
		const titleEl = item.querySelector('.nav-file-title, .nav-folder-title');
		if (!titleEl) return;

		const path = titleEl.getAttribute('data-path');
		if (!path) return;

		let iconName: string | null = null;
		if (item.classList.contains('nav-file')) {
			if (this.plugin.settings.strictLockedNotes.has(path)) {
				iconName = 'lock-keyhole';
			} else if (this.plugin.settings.lockedNotes.has(path)) {
				iconName = 'lock';
			}
		} else if (item.classList.contains('nav-folder')) {
			if (this.plugin.settings.lockedFolders.has(path)) {
				iconName = 'lock';
			}
		}

		this.updateIconState(titleEl, iconName);
	}

	public updateFileExplorerIcons(): void {
		if (!this.plugin.settings.showFileExplorerIcons) {
			this.removeFileExplorerIcons();
			return;
		}

		// Handle files
		const fileItems = document.querySelectorAll('.nav-file');
		fileItems.forEach((fileItem) => {
			const titleEl = fileItem.querySelector('.nav-file-title');
			if (!titleEl) return;

			const filePath = titleEl.getAttribute('data-path');
			if (!filePath) return;

			let iconName: string | null = null;
			if (this.plugin.settings.strictLockedNotes.has(filePath)) {
				iconName = 'lock-keyhole';
			} else if (this.plugin.settings.lockedNotes.has(filePath)) {
				iconName = 'lock';
			}
			this.updateIconState(titleEl, iconName);
		});

		// Handle folders
		const folderItems = document.querySelectorAll('.nav-folder');
		folderItems.forEach((folderItem) => {
			const titleEl = folderItem.querySelector('.nav-folder-title');
			if (!titleEl) return;

			const folderPath = titleEl.getAttribute('data-path');
			if (!folderPath) return;

			let iconName: string | null = null;
			if (this.plugin.settings.lockedFolders.has(folderPath)) {
				iconName = 'lock';
			}
			this.updateIconState(titleEl, iconName);
		});
	}

	private updateIconState(targetEl: Element, iconName: string | null): void {
		const existingIcon = targetEl.querySelector('.note-locker-icon');

		if (iconName) {
			if (!existingIcon) {
				const iconEl = document.createElement('div');
				iconEl.addClass('note-locker-icon');
				setIcon(iconEl, iconName);
				targetEl.appendChild(iconEl);
			} else {
				setIcon(existingIcon as HTMLElement, iconName);
			}
		} else {
			if (existingIcon) {
				existingIcon.remove();
			}
		}
	}

	public removeFileExplorerIcons(): void {
		document.querySelectorAll('.note-locker-icon').forEach(el => el.remove());
	}

	public cleanup(): void {
		if (this.updateDebounceTimeout !== null) {
			window.clearTimeout(this.updateDebounceTimeout);
			this.updateDebounceTimeout = null;
		}

		if (this.folderObserver) {
			this.folderObserver.disconnect();
			this.folderObserver = null;
		}

		this.removeFileExplorerIcons();
	}
}
