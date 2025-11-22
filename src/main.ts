import {
	MarkdownView,
	Menu,
	Notice,
	Platform,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from "obsidian";

import { NoteLockerSettings, DEFAULT_SETTINGS } from "./models/types";
import { FileExplorerUI } from "./ui/fileExplorer";
import { StatusBarUI } from "./ui/statusBar";
import { NoteLockerSettingTab } from "./settings";

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
						this.toggleNoteLock(file.path);
					}
					return true;
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

				// Handle locked notes
				if (this.settings.lockedNotes.delete(oldPath)) {
					if (!this.settings.lockedNotes.has(file.path)) {
						this.settings.lockedNotes.add(file.path);
						settingsChanged = true;
					}
				}

				// Handle locked folders
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
			})
		);
	}

	private initializeExistingLeaves() {
		this.app.workspace
			.getLeavesOfType("markdown")
			.forEach((leaf) => this.updateLeafMode(leaf));
	}

	private addLockMenuItem(menu: Menu, path: string) {
		if (this.isParentFolderLocked(path)) {
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(path);

		if (file instanceof TFile && file.extension === 'md') {
			const isLocked = this.settings.lockedNotes.has(path);
			menu.addItem((item) =>
				item
					.setTitle(isLocked ? "Unlock" : "Lock")
					.setIcon(isLocked ? "unlock" : "lock")
					.onClick(() => this.toggleNoteLock(path))
			);
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
		const targetMode =
			view.file && this.isPathLocked(view.file.path)
				? "preview"
				: "source";

		if (leaf.getViewState().state?.mode !== targetMode) {
			leaf.setViewState({
				...leaf.getViewState(),
				state: { ...leaf.getViewState().state, mode: targetMode },
			});
		}
	}

	async loadSettings() {
		const loaded = await this.loadData();
		if (loaded) {
			this.settings = {
				...DEFAULT_SETTINGS,
				...loaded,
				lockedNotes: new Set(loaded.lockedNotes || []),
				lockedFolders: new Set(loaded.lockedFolders || [])
			};
		}
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			lockedNotes: Array.from(this.settings.lockedNotes),
			lockedFolders: Array.from(this.settings.lockedFolders),
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
