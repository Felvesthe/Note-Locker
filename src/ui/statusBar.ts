import { setIcon } from "obsidian";
import type NoteLockerPlugin from "../main";

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
					this.plugin.toggleNoteLock(activeFile.path);
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
			const iconSpan = this.statusBarItemEl.createSpan({ cls: 'locker-icon' });
			setIcon(iconSpan, isLocked ? 'lock' : 'unlock');
			this.statusBarItemEl.createSpan({
				text: isLocked ? ' Locked' : ' Unlocked'
			});

			this.statusBarItemEl.style.cursor = 'pointer';
			this.statusBarItemEl.setAttribute('aria-label',
				isLocked ? 'Click to unlock this note' : 'Click to lock this note');
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
