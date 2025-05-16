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
                display: inline-flex;
                justify-content: center;
                align-items: center;
                margin-left: 4px;
                width: 12px;
                height: 12px;
                font-size: 0.85em;
                color: var(--text-accent);
                vertical-align: middle;
            }
            .nav-file-title {
                display: flex;
                align-items: center;
            }
            .nav-file-title-content {
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
		document.head.appendChild(styleEl);

		// Initial update
		this.plugin.app.workspace.onLayoutReady(() => {
			this.updateFileExplorerIcons();
			this.setupFolderObserver();

			// Register handlers for folder expansion/collapse
			this.registerFolderClickHandlers();
		});
	}

	private registerFolderClickHandlers(): void {
		const fileExplorer = document.querySelector('.workspace-split.mod-left-split .nav-files-container');
		if (!fileExplorer) return;

		fileExplorer.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			const folderCollapseIndicator = target.closest('.nav-folder-collapse-indicator') ||
				target.closest('.nav-folder-title');

			if (folderCollapseIndicator) {
				// A folder was clicked, so schedule an update after DOM changes
				this.debouncedUpdateIcons(250);
			}
		});
	}

	private debouncedUpdateIcons(delay: number = 100): void {
		if (this.updateDebounceTimeout !== null) {
			window.clearTimeout(this.updateDebounceTimeout);
		}

		this.updateDebounceTimeout = window.setTimeout(() => {
			this.updateFileExplorerIcons();
			this.updateDebounceTimeout = null;
		}, delay);
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
				if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
					shouldUpdate = true;
					break;
				}

				if (mutation.type === 'attributes' &&
					mutation.target instanceof HTMLElement &&
					(mutation.target.classList.contains('nav-folder') ||
						mutation.target.classList.contains('is-collapsed'))) {
					shouldUpdate = true;
					break;
				}
			}

			if (shouldUpdate) {
				this.debouncedUpdateIcons(150);
			}
		});

		this.folderObserver.observe(fileExplorer, {
			childList: true,
			attributes: true,
			attributeFilter: ['class'],
			subtree: true
		});
	}

	public updateFileExplorerIcons(): void {
		if (!this.plugin.settings.showFileExplorerIcons) {
			this.removeFileExplorerIcons();
			return;
		}

		// First, remove existing icons to avoid duplicates
		this.removeFileExplorerIcons();

		// Get all file elements in the file explorer
		const fileItems = document.querySelectorAll('.nav-file');

		fileItems.forEach((fileItem) => {
			const titleEl = fileItem.querySelector('.nav-file-title');
			if (!titleEl) return;

			const filePath = titleEl.getAttribute('data-path');
			if (!filePath || !this.plugin.settings.lockedNotes.has(filePath)) return;

			// Create lock icon element
			const iconEl = document.createElement('div');
			iconEl.addClass('note-locker-icon');
			setIcon(iconEl, 'lock');

			titleEl.appendChild(iconEl);
		});
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
