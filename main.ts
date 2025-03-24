import { MarkdownView, Menu, Notice, Platform, Plugin, TFile, WorkspaceLeaf } from "obsidian";

interface NoteLockerSettings {
	lockedNotes: Set<string>;
	mobileNotificationMaxLength: number;
	desktopNotificationMaxLength: number;
}

const DEFAULT_SETTINGS: NoteLockerSettings = {
	lockedNotes: new Set(),
	mobileNotificationMaxLength: 18,
	desktopNotificationMaxLength: 22
};

export default class NoteLockerPlugin extends Plugin {
	settings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.registerEventHandlers();
		this.initializeExistingLeaves();
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
			this.app.workspace.on("active-leaf-change", (leaf) =>
				this.updateLeafMode(leaf)
			)
		);
	}

	private initializeExistingLeaves() {
		this.app.workspace
			.getLeavesOfType("markdown")
			.forEach((leaf) => this.updateLeafMode(leaf));
	}

	private addLockMenuItem(menu: Menu, filePath: string) {
		const isLocked = this.settings.lockedNotes.has(filePath);
		menu.addItem((item) =>
			item
				.setTitle(isLocked ? "Unlock" : "Lock")
				.setIcon(isLocked ? "unlock" : "lock")
				.onClick(() => this.toggleNoteLock(filePath))
		);
	}

	private async toggleNoteLock(notePath: string) {
		const isLocked = this.settings.lockedNotes.has(notePath);

		isLocked
			? this.settings.lockedNotes.delete(notePath)
			: this.settings.lockedNotes.add(notePath);

		await this.saveSettings();

		const file = this.app.vault.getAbstractFileByPath(notePath);
		const fileName = file instanceof TFile ? file.basename :
			notePath.split('/').pop()?.replace(/\..+$/, '') || notePath;
		const displayName = this.truncateFileName(fileName);

		new Notice(`${isLocked ? '🔓 Unlocked' : '🔒 Locked'}: ${displayName}`);

		this.updateAllNoteInstances(notePath);
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

	private async loadSettings() {
		const loaded = await this.loadData();
		if (loaded) {
			this.settings.lockedNotes = new Set(loaded.lockedNotes);
		}
	}

	private async saveSettings() {
		await this.saveData({
			lockedNotes: Array.from(this.settings.lockedNotes),
		});
	}
}
