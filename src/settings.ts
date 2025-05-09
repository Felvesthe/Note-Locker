import {App, Platform, PluginSettingTab, Setting} from "obsidian";
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

		let defaultNotificationMaxLength = Platform.isMobile ? 18 : 22;

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
			.setName('Notification max length')
			.setDesc('Maximum length of file names in notifications')
			.addText(text => text
				.setPlaceholder(Platform.isMobile ? '18' : '22')
				.setValue(String(this.plugin.settings.notificationMaxLength || defaultNotificationMaxLength))
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.notificationMaxLength = numValue;
						await this.plugin.saveSettings();
					}
				}));

		const hotkeyInfo = containerEl.createEl('p', {
			text: 'You can set a hotkey for locking/unlocking notes in Settings → Hotkeys → Toggle Lock for current note.'
		});
		hotkeyInfo.style.fontStyle = 'italic';

		containerEl.createEl('h3', { text: 'Locked Notes' });
		const lockedNotesCount = this.plugin.settings.lockedNotes.size;
		containerEl.createEl('p', {
			text: `You currently have ${lockedNotesCount} locked note${lockedNotesCount !== 1 ? 's' : ''}.`
		});
	}
}
