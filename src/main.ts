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

		this.fileExplorerUI.removeFileExplorerIcons();
		this.statusBarUI.removeStatusBarItem();
	}

	private registerEventHandlers() {
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) =>
				this.addLockMenuItem(menu, file.path)
			)
		);

		this.registerEvent(
			this.app.workspace.on("editor-menu",(menu, _, view) =>
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
				if (this.settings.lockedNotes.delete(oldPath)) {
					if (!this.settings.lockedNotes.has(file.path)) {
						this.settings.lockedNotes.add(file.path);
					} else {
						new Notice(`⚠️ Lock skipped: "${file.name}" was already locked`);
					}
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

	private addLockMenuItem(menu: Menu, filePath: string) {
		const isNote = filePath.endsWith('.md');
		if (!isNote) return;

		const isLocked = this.settings.lockedNotes.has(filePath);
		menu.addItem((item) =>
			item
				.setTitle(isLocked ? "Unlock" : "Lock")
				.setIcon(isLocked ? "unlock" : "lock")
				.onClick(() => this.toggleNoteLock(filePath))
		);
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

		const fileName = file instanceof TFile ? file.basename :
			notePath.split('/').pop()?.replace(/\..+$/, '') || notePath;
		const displayName = this.truncateFileName(fileName);

		new Notice(`${isLocked ? '🔓 Unlocked' : '🔒 Locked'}: ${displayName}`);

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

	private updateLeafMode(leaf: WorkspaceLeaf | null) {
		if (!leaf || !(leaf.view instanceof MarkdownView)) return;

		const { view } = leaf;
		const targetMode =
			view.file && this.settings.lockedNotes.has(view.file.path)
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
				lockedNotes: new Set(loaded.lockedNotes || [])
			};
		}
	}

	async saveSettings() {
		await this.saveData({
			...this.settings,
			lockedNotes: Array.from(this.settings.lockedNotes),
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
