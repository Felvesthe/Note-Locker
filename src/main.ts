import {
	MarkdownView,
	Menu,
	Notice,
	Platform,
	Plugin,
	TFile,
	WorkspaceLeaf,
	TAbstractFile,
	TFolder,
} from "obsidian";

import { NoteLockerSettings, DEFAULT_SETTINGS } from "./models/types";
import { FileExplorerUI } from "./ui/fileExplorer";
import { StatusBarUI } from "./ui/statusBar";
import { NoteLockerSettingTab } from "./settings";
import { StrictUnlockModal } from "./ui/strictUnlockModal";

export default class NoteLockerPlugin extends Plugin {
	settings: NoteLockerSettings = DEFAULT_SETTINGS;
	fileExplorerUI: FileExplorerUI;
	statusBarUI: StatusBarUI;

	async onload() {
		await this.loadSettings();

		this.fileExplorerUI = new FileExplorerUI(this);
		this.statusBarUI = new StatusBarUI(this);

		this.registerEventHandlers();

		this.initializeExistingLeaves();

		if (this.settings.showStatusBarButton) {
			this.statusBarUI.createStatusBarItem();
		}

		if (this.settings.showFileExplorerIcons) {
			this.fileExplorerUI.addFileExplorerIconStyling();
		}

		this.addSettingTab(new NoteLockerSettingTab(this.app, this));

		// hotkey
		this.addCommand({
			id: 'toggle-note-lock',
			name: 'Toggle Lock for current note',
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === 'md') {
					if (!checking) {
						if (this.settings.strictLockedNotes.has(file.path)) {
							new StrictUnlockModal(this.app, () => {
								this.toggleStrictLock(file.path);
							}).open();
						} else {
							this.toggleNoteLock(file.path);
						}
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'switch-to-edit-mode-intercept',
			name: 'Switch to Edit Mode (Strict Lock Check)',
			hotkeys: [{ modifiers: ["Mod"], key: "e" }],
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === 'md') {
					if (this.settings.strictLockedNotes.has(file.path)) {
						if (!checking) {
							new StrictUnlockModal(this.app, () => {
								this.toggleStrictLock(file.path);
							}).open();
						}
						return true;
					}
				}
				return false;
			},
		});
	}

	onunload() {
		const styleEl = document.getElementById('note-locker-styles');
		if (styleEl) styleEl.remove();

		this.fileExplorerUI.cleanup();
		this.statusBarUI.removeStatusBarItem();
	}

	private registerEventHandlers() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) =>
				this.addLockMenuItem(menu, file.path)
			)
		);

		this.registerEvent(
			this.app.workspace.on("files-menu", (menu, files) =>
				this.addBulkLockMenuItem(menu, files)
			)
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, _, view) =>
				view.file && this.addLockMenuItem(menu, view.file.path)
			)
		);

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				this.updateLeafMode(leaf);
				this.statusBarUI.updateStatusBarButton();
			})
		);

		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				let settingsChanged = false;

				if (this.settings.lockedNotes.delete(oldPath)) {
					if (!this.settings.lockedNotes.has(file.path)) {
						this.settings.lockedNotes.add(file.path);
						settingsChanged = true;
					}
				}

				if (this.settings.lockedFolders.delete(oldPath)) {
					if (!this.settings.lockedFolders.has(file.path)) {
						this.settings.lockedFolders.add(file.path);
						settingsChanged = true;
					}
				}

				if (settingsChanged) {
					await this.saveSettings();
					this.fileExplorerUI.updateFileExplorerIcons();
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				this.statusBarUI.updateStatusBarButton();
				this.fileExplorerUI.updateFileExplorerIcons();
			})
		);

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.fileExplorerUI.updateFileExplorerIcons();
				this.app.workspace.iterateAllLeaves((leaf) => this.updateLeafMode(leaf));
			})
		);
	}

	private initializeExistingLeaves() {
		this.app.workspace
			.getLeavesOfType("markdown")
			.forEach((leaf) => this.updateLeafMode(leaf));
	}

	private addBulkLockMenuItem(menu: Menu, files: TAbstractFile[]) {
		const validItems = files.filter(f =>
			(f instanceof TFile && f.extension === 'md') ||
			(f instanceof TFolder)
		);

		if (validItems.length < 2) return;

		let allLocked = true;
		let allUnlocked = true;
		let allStrictUnlocked = true;

		for (const item of validItems) {
			const isLocked = this.isPathLocked(item.path);
			const isStrictLocked = this.settings.strictLockedNotes.has(item.path);

			if (isLocked) {
				allUnlocked = false;
			} else {
				allLocked = false;
			}

			if (isStrictLocked) {
				allStrictUnlocked = false;
			}
		}

		if (allLocked) {
			menu.addItem((item) =>
				item
					.setTitle(`Unlock ${validItems.length} items`)
					.setIcon("unlock")
					.onClick(() => {
						if (!allStrictUnlocked) {
							new StrictUnlockModal(
								this.app,
								() => this.toggleBulkLock(validItems, false),
								"Strictly Locked Items",
								"At least one of the selected items is strictly locked."
							).open();
						} else {
							this.toggleBulkLock(validItems, false);
						}
					})
			);
		} else if (allUnlocked) {
			menu.addItem((item) =>
				item
					.setTitle(`Lock ${validItems.length} items`)
					.setIcon("lock")
					.onClick(() => this.toggleBulkLock(validItems, true))
			);
		}

		const hasFiles = validItems.some(f => f instanceof TFile);
		if (allStrictUnlocked && hasFiles) {
			if (allUnlocked || allLocked) {
				menu.addItem((item) =>
					item
						.setTitle(`Strict Lock ${validItems.length} items`)
						.setIcon("lock")
						.onClick(() => this.toggleBulkStrictLock(validItems, true))
				);
			}
		}
	}

	private async toggleBulkLock(files: TAbstractFile[], shouldLock: boolean) {
		for (const file of files) {
			if (file instanceof TFile) {
				if (shouldLock) {
					this.settings.lockedNotes.add(file.path);
				} else {
					this.settings.lockedNotes.delete(file.path);
					this.settings.strictLockedNotes.delete(file.path);
				}
			} else if (file instanceof TFolder) {
				if (shouldLock) {
					this.settings.lockedFolders.add(file.path);
				} else {
					this.settings.lockedFolders.delete(file.path);
				}
			}
		}

		await this.saveSettings();
		this.fileExplorerUI.updateFileExplorerIcons();

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView && leaf.view.file) {
				const path = leaf.view.file.path;
				if (files.some(f => f.path === path || (f instanceof TFolder && path.startsWith(f.path + '/')))) {
					this.updateLeafMode(leaf);
				}
			}
		});
	}

	private async toggleBulkStrictLock(files: TAbstractFile[], shouldLock: boolean) {
		for (const file of files) {
			if (file instanceof TFile) {
				if (shouldLock) {
					this.settings.strictLockedNotes.add(file.path);
				} else {
					this.settings.strictLockedNotes.delete(file.path);
				}
			}
		}

		await this.saveSettings();
		this.fileExplorerUI.updateFileExplorerIcons();

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView && leaf.view.file) {
				const path = leaf.view.file.path;
				if (files.some(f => f.path === path)) {
					this.updateLeafMode(leaf);
				}
			}
		});
	}

	private addLockMenuItem(menu: Menu, path: string) {
		if (this.isParentFolderLocked(path)) {
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(path);

		if (file instanceof TFile && file.extension === 'md') {
			const isLocked = this.settings.lockedNotes.has(path);
			const isStrictLocked = this.settings.strictLockedNotes.has(path);

			if (!isStrictLocked) {
				menu.addItem((item) =>
					item
						.setTitle(isLocked ? "Unlock" : "Lock")
						.setIcon(isLocked ? "unlock" : "lock")
						.onClick(() => this.toggleNoteLock(path))
				);
			}

			if (!isLocked) {
				if (!isStrictLocked) {
					menu.addItem((item) =>
						item
							.setTitle("Strict Lock")
							.setIcon("lock")
							.onClick(() => this.toggleStrictLock(path))
					);
				} else {
					menu.addItem((item) =>
						item
							.setTitle("Strict Unlock")
							.setIcon("unlock")
							.onClick(() => {
								new StrictUnlockModal(this.app, () => {
									this.toggleStrictLock(path);
								}).open();
							})
					);
				}
			}
		} else if (file && !(file instanceof TFile)) {
			const isLocked = this.settings.lockedFolders.has(path);
			menu.addItem((item) =>
				item
					.setTitle(isLocked ? "Unlock all notes in folder" : "Lock all notes in folder")
					.setIcon(isLocked ? "unlock" : "lock")
					.onClick(() => this.toggleFolderLock(path))
			);
		}
	}

	private isParentFolderLocked(path: string): boolean {
		let currentPath = path;
		while (currentPath.includes("/")) {
			currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
			if (this.settings.lockedFolders.has(currentPath)) {
				return true;
			}
		}
		return false;
	}

	async toggleFolderLock(folderPath: string) {
		const isLocked = this.settings.lockedFolders.has(folderPath);

		isLocked
			? this.settings.lockedFolders.delete(folderPath)
			: this.settings.lockedFolders.add(folderPath);

		await this.saveSettings();

		new Notice(`${isLocked ? '🔓 Unlocked' : '🔒 Locked'} folder: ${folderPath}`);

		this.updateAllNotesInFolder(folderPath);
		this.statusBarUI.updateStatusBarButton();
		this.fileExplorerUI.updateFileExplorerIcons();
	}

	private updateAllNotesInFolder(folderPath: string) {
		this.app.workspace
			.getLeavesOfType("markdown")
			.forEach((leaf) => {
				if (leaf.view instanceof MarkdownView && leaf.view.file) {
					if (leaf.view.file.path.startsWith(folderPath + "/")) {
						this.updateLeafMode(leaf);
					}
				}
			});
	}

	async toggleNoteLock(notePath: string) {
		const isLocked = this.settings.lockedNotes.has(notePath);

		isLocked
			? this.settings.lockedNotes.delete(notePath)
			: this.settings.lockedNotes.add(notePath);

		await this.saveSettings();

		const file = this.app.vault.getAbstractFileByPath(notePath);

		if (!file) {
			new Notice("Error: Note not found");
			return;
		}

		if (this.settings.showNotifications) {
			const fileName = file instanceof TFile ? file.basename :
				notePath.split('/').pop()?.replace(/\..+$/, '') || notePath;
			const displayName = this.truncateFileName(fileName);

			new Notice(`${isLocked ? '🔓 Unlocked' : '🔒 Locked'}: ${displayName}`);
		}

		this.updateAllNoteInstances(notePath);
		this.statusBarUI.updateStatusBarButton();
		this.fileExplorerUI.updateFileExplorerIcons();
	}

	async toggleStrictLock(notePath: string) {
		const isStrictLocked = this.settings.strictLockedNotes.has(notePath);

		if (isStrictLocked) {
			this.settings.strictLockedNotes.delete(notePath);
		} else {
			this.settings.strictLockedNotes.add(notePath);
		}

		await this.saveSettings();

		new Notice(`${isStrictLocked ? '🔓 Strictly Unlocked' : '🔒 Strictly Locked'}: ${notePath}`);

		this.updateAllNoteInstances(notePath);
		this.statusBarUI.updateStatusBarButton();
		this.fileExplorerUI.updateFileExplorerIcons();
	}

	private truncateFileName(name: string): string {
		const maxLength = Platform.isMobile
			? this.settings.mobileNotificationMaxLength
			: this.settings.desktopNotificationMaxLength;
		return name.length > maxLength
			? `${name.slice(0, maxLength)}…`
			: name;
	}

	private updateAllNoteInstances(notePath: string) {
		this.app.workspace
			.getLeavesOfType("markdown")
			.filter((leaf) => this.isSameNote(leaf, notePath))
			.forEach((leaf) => this.updateLeafMode(leaf));
	}

	private isSameNote(leaf: WorkspaceLeaf, notePath: string): boolean {
		const view = leaf.view;
		return view instanceof MarkdownView && view.file?.path === notePath;
	}

	public isPathLocked(path: string): boolean {
		if (this.settings.strictLockedNotes.has(path)) return true;
		if (this.settings.lockedNotes.has(path)) return true;

		let currentPath = path;
		while (currentPath.includes("/")) {
			currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
			if (this.settings.lockedFolders.has(currentPath)) {
				return true;
			}
		}
		return false;
	}

	private updateLeafMode(leaf: WorkspaceLeaf | null) {
		if (!leaf || !(leaf.view instanceof MarkdownView)) return;

		const { view } = leaf;
		const path = view.file?.path;
		if (!path) return;

		const isStrictLocked = this.settings.strictLockedNotes.has(path);
		const isLocked = this.isPathLocked(path);

		if (isStrictLocked) {
			const state = leaf.getViewState();
			if (state.state?.mode === 'source') {
				leaf.setViewState({
					...state,
					state: { ...state.state, mode: 'preview' },
				});

				if (this.app.workspace.activeLeaf === leaf) {
					new StrictUnlockModal(this.app, () => {
						this.toggleStrictLock(path);
					}).open();
				}
				return;
			}
		} else if (isLocked) {
			const state = leaf.getViewState();
			if (state.state?.mode === 'source') {
				leaf.setViewState({
					...state,
					state: { ...state.state, mode: 'preview' },
				});
			}
		}

		if (isStrictLocked) {
			const container = view.containerEl;
			const allActions = container.querySelectorAll('.view-action');

			allActions.forEach(btn => {
				if (btn instanceof HTMLElement) {
					const ariaLabel = btn.getAttribute('aria-label') || '';
					const hasPencilIcon = !!btn.querySelector('.lucide-pencil');

					if (hasPencilIcon || ariaLabel.includes('Edit') || ariaLabel.includes('edit') || ariaLabel.includes('Switch to editing')) {
						btn.style.display = 'none';
					}
				}
			});

			let lockBtn = container.querySelector('.note-locker-strict-btn');
			if (!lockBtn) {
				lockBtn = document.createElement('div');
				lockBtn.addClass('view-action', 'clickable-icon', 'note-locker-strict-btn');
				lockBtn.setAttribute('aria-label', 'Strictly Locked');
				lockBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-lock"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

				lockBtn.addEventListener('click', () => {
					new StrictUnlockModal(this.app, () => {
						this.toggleStrictLock(path);
					}).open();
				});

				const actionsContainer = container.querySelector('.view-actions');
				if (actionsContainer) {
					actionsContainer.prepend(lockBtn);
				}
			}
		} else {
			const container = view.containerEl;
			const editBtns = container.querySelectorAll('.view-action');
			editBtns.forEach(btn => {
				if (btn instanceof HTMLElement) {
					if (btn.getAttribute('aria-label')?.includes('Edit') ||
						btn.getAttribute('aria-label')?.includes('edit') ||
						btn.querySelector('.lucide-pencil')) {
						btn.style.display = '';
					}
				}
			});
			const lockBtn = container.querySelector('.note-locker-strict-btn');
			if (lockBtn) lockBtn.remove();
		}
	}

	async loadSettings() {
		const loaded = await this.loadData();
		if (loaded) {
			this.settings = {
				...DEFAULT_SETTINGS,
				...loaded,
				lockedNotes: new Set(loaded.lockedNotes || []),
				lockedFolders: new Set(loaded.lockedFolders || []),
				strictLockedNotes: new Set(loaded.strictLockedNotes || [])
			};
		}
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			lockedNotes: Array.from(this.settings.lockedNotes),
			lockedFolders: Array.from(this.settings.lockedFolders),
			strictLockedNotes: Array.from(this.settings.strictLockedNotes),
		});
	}

	async updateFileExplorerIconsVisibility(value: boolean) {
		this.settings.showFileExplorerIcons = value;

		if (value) {
			this.fileExplorerUI.addFileExplorerIconStyling();
		} else {
			this.fileExplorerUI.removeFileExplorerIcons();
		}

		await this.saveSettings();
	}

	async updateStatusBarVisibility(value: boolean) {
		this.settings.showStatusBarButton = value;

		if (value) {
			if (!this.statusBarUI.statusBarItemEl) {
				this.statusBarUI.createStatusBarItem();
			}
		} else {
			this.statusBarUI.removeStatusBarItem();
		}

		await this.saveSettings();
	}
}
