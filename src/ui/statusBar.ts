import { setIcon } from "obsidian";
import type NoteLockerPlugin from "../main";
import { StrictUnlockModal } from "./strictUnlockModal";

export class StatusBarUI {
	private plugin: NoteLockerPlugin;
	public statusBarItemEl: HTMLElement | null = null;

	constructor(plugin: NoteLockerPlugin) {
		this.plugin = plugin;
	}

	public createStatusBarItem(): void {
		if (!this.plugin.settings.showStatusBarButton) return;

		this.statusBarItemEl = this.plugin.addStatusBarItem();
		if (this.statusBarItemEl) {
			this.statusBarItemEl.addClass('note-locker-status');
			this.statusBarItemEl.addEventListener('click', () => {
				const activeFile = this.plugin.app.workspace.getActiveFile();
				if (activeFile) {
					if (this.plugin.settings.strictLockedNotes.has(activeFile.path)) {
						new StrictUnlockModal(this.plugin.app, () => {
							this.plugin.toggleStrictLock(activeFile.path);
						}).open();
					} else {
						this.plugin.toggleNoteLock(activeFile.path);
					}
				}
			});

			this.updateStatusBarButton();
		}
	}

	public updateStatusBarButton(): void {
		if (!this.plugin.settings.showStatusBarButton || !this.statusBarItemEl) return;

		const isLocked = this.isCurrentNoteActive();
		this.statusBarItemEl.empty();

		const style = document.createElement('style');
		style.textContent = `
			.note-locker-status .locker-icon {
				margin-right: 6px;
			}
		`;
		document.head.appendChild(style);

		if (this.plugin.app.workspace.getActiveFile()) {
			const activeFile = this.plugin.app.workspace.getActiveFile();
			const path = activeFile ? activeFile.path : '';
			const isStrictLocked = this.plugin.settings.strictLockedNotes.has(path);
			const isLocked = this.isCurrentNoteActive();

			const iconSpan = this.statusBarItemEl.createSpan({ cls: 'locker-icon' });

			if (isStrictLocked) {
				setIcon(iconSpan, 'lock-keyhole');
				this.statusBarItemEl.createSpan({ text: ' Strictly locked' });
				this.statusBarItemEl.setAttribute('aria-label', 'Strictly locked. Click to unlock.');
			} else {
				setIcon(iconSpan, isLocked ? 'lock' : 'unlock');
				this.statusBarItemEl.createSpan({
					text: isLocked ? ' Locked' : ' Unlocked'
				});
				this.statusBarItemEl.setAttribute('aria-label',
					isLocked ? 'Click to unlock this note' : 'Click to lock this note');
			}

			this.statusBarItemEl.style.cursor = 'pointer';
		} else {
			this.statusBarItemEl.style.cursor = 'default';
		}
	}

	private isCurrentNoteActive(): boolean {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		return activeFile ? this.plugin.settings.lockedNotes.has(activeFile.path) : false;
	}

	public removeStatusBarItem(): void {
		if (this.statusBarItemEl) {
			this.statusBarItemEl.detach();
			this.statusBarItemEl = null;
		}
	}
}
