import { App, Platform, PluginSettingTab, Setting, MarkdownView } from "obsidian";
import type NoteLockerPlugin from "./main";

export class NoteLockerSettingTab extends PluginSettingTab {
	plugin: NoteLockerPlugin;

	constructor(app: App, plugin: NoteLockerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Show locked notes in file explorer')
			.setDesc('Display a lock icon next to locked notes in the file explorer')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showFileExplorerIcons)
				.onChange(async (value) => {
					await this.plugin.updateFileExplorerIconsVisibility(value);
				}));

		new Setting(containerEl)
			.setName('Show status bar button')
			.setDesc('Display a lock/unlock button in the status bar for the current note')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBarButton)
				.onChange(async (value) => {
					await this.plugin.updateStatusBarVisibility(value);
				}));

		new Setting(containerEl)
			.setName('Show notifications')
			.setDesc('Show notifications when locking or unlocking notes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotifications)
				.onChange(async (value) => {
					this.plugin.settings.showNotifications = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Prevent editing in locked notes')
			.setDesc('If enabled, normally locked notes will be read-only. If disabled, you can switch to edit mode.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.preventEditInLockedNotes)
				.onChange(async (value) => {
					this.plugin.settings.preventEditInLockedNotes = value;
					await this.plugin.saveSettings();
					this.plugin.app.workspace.iterateAllLeaves((leaf) => {
						if (leaf.view instanceof MarkdownView && leaf.view.file) {
							this.plugin.updateLeafMode(leaf);
						}
					});
				}));

		const mobileNotificationSetting = new Setting(containerEl)
			.setName('Mobile notification max length')
			.setDesc('Maximum length of file names in notifications on mobile devices')
			.addText(text => text
				.setPlaceholder('18')
				.setValue(String(this.plugin.settings.mobileNotificationMaxLength))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.mobileNotificationMaxLength = numValue;
						await this.plugin.saveSettings();
					}
				}));

		const desktopNotificationSetting = new Setting(containerEl)
			.setName('Desktop notification max length')
			.setDesc('Maximum length of file names in notifications on desktop')
			.addText(text => text
				.setPlaceholder('22')
				.setValue(String(this.plugin.settings.desktopNotificationMaxLength))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.desktopNotificationMaxLength = numValue;
						await this.plugin.saveSettings();
					}
				}));

		if (Platform.isMobile) {
			desktopNotificationSetting.settingEl.style.display = 'none';
		} else {
			mobileNotificationSetting.settingEl.style.display = 'none';
		}

		const hotkeyInfo = containerEl.createEl('p', {
			text: 'You can set a hotkey for locking/unlocking notes in Settings → Hotkeys → Toggle Lock for current note.'
		});
		hotkeyInfo.style.fontStyle = 'italic';

		containerEl.createEl('h3', { text: 'Locked notes & folders statistics' });
		const lockedNotesCount = this.plugin.settings.lockedNotes.size;
		const lockedFoldersCount = this.plugin.settings.lockedFolders.size;
		const strictLockedNotesCount = this.plugin.settings.strictLockedNotes.size;

		containerEl.createEl('p', {
			text: 'You currently have:'
		});
		containerEl
			.createEl('ul')
			.createEl('li', {
				text: `Locked notes: ${lockedNotesCount}`
			})
			.createEl('li', {
				text: `Locked folders: ${lockedFoldersCount}`
			})
			.createEl('li', {
				text: `Strictly locked notes: ${strictLockedNotesCount}`
			});
	}
}
