import { App, Platform, PluginSettingTab, Setting, SettingGroup, TFile, TFolder, type EventRef } from 'obsidian';
import { fileNameOf, parentFoldersOf } from '../core/paths';
import { LOCKS_CHANGED } from '../lockActions';
import type NoteLockerPlugin from '../main';
import type { LockEntry, LockLevel, LockTargetKind, NoteLockerSettings } from '../types';

const LEVEL_OPTIONS: Record<LockLevel, string> = {
	lock: 'Lock',
	strict: 'Strict lock',
};

const PAGE_SIZE = 50;

type KindFilter = 'all' | LockTargetKind;

const KIND_FILTER_OPTIONS: Record<KindFilter, string> = {
	all: 'Notes and folders',
	note: 'Notes',
	folder: 'Folders',
};

export class NoteLockerSettingTab extends PluginSettingTab {
	private locksChangedRef: EventRef | null = null;
	private filter = '';
	private kindFilter: KindFilter = 'all';
	private visibleLimit = PAGE_SIZE;
	private lockedItemsGroup: SettingGroup | null = null;
	private listedSettings: Setting[] = [];

	constructor(
		app: App,
		private readonly plugin: NoteLockerPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderDisplayGroup(containerEl);
		this.renderLockedItemsGroup(containerEl);

		if (!this.locksChangedRef) {
			this.locksChangedRef = this.plugin.actions.on(LOCKS_CHANGED, () => this.renderList());
		}
	}

	hide(): void {
		if (this.locksChangedRef) this.plugin.actions.offref(this.locksChangedRef);
		this.locksChangedRef = null;
		this.lockedItemsGroup = null;
		this.listedSettings = [];
	}

	private renderDisplayGroup(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl);
		const addToggle = (name: string, description: string, key: keyof NoteLockerSettings) =>
			group.addSetting((setting) => {
				setting
					.setName(name)
					.setDesc(description)
					.addToggle((toggle) =>
						toggle
							.setValue(this.plugin.settings[key])
							.onChange((value) => void this.plugin.updateSettings({ [key]: value })),
					);
			});

		addToggle('Show icons in file explorer', 'Show a lock icon next to locked notes and folders.', 'showExplorerIcons');
		addToggle('Show button in note header', 'Show a lock button next to the reading and editing toggle.', 'showHeaderButton');
		if (!Platform.isMobile) {
			addToggle('Show status bar item', 'Show the lock state of the current note in the status bar.', 'showStatusBar');
		}
		addToggle('Show notifications', 'Show a short notice when a note or folder is locked or unlocked.', 'showNotifications');
		group.addSetting((setting) => {
			setting.setName('Hotkeys').setDesc('You can assign hotkeys to the lock commands in the hotkeys settings.');
		});
	}

	private renderLockedItemsGroup(containerEl: HTMLElement): void {
		const group = new SettingGroup(containerEl).setHeading('Locked notes and folders');
		group.addSetting((setting) => {
			setting.settingEl.addClass('note-locker-filters');
			setting
				.addDropdown((dropdown) =>
					dropdown
						.addOptions(KIND_FILTER_OPTIONS)
						.setValue(this.kindFilter)
						.onChange((value) => {
							this.kindFilter = value as KindFilter;
							this.visibleLimit = PAGE_SIZE;
							this.renderList();
						}),
				)
				.addSearch((search) =>
					search
						.setPlaceholder('Filter by name or path')
						.setValue(this.filter)
						.onChange((value) => {
							this.filter = value;
							this.visibleLimit = PAGE_SIZE;
							this.renderList();
						}),
				);
		});

		this.lockedItemsGroup = group;
		this.renderList();
	}

	private renderList(): void {
		const group = this.lockedItemsGroup;
		if (!group) return;

		for (const setting of this.listedSettings) setting.settingEl.remove();
		this.listedSettings = [];

		const entries = this.plugin.locks.entries();
		const filter = this.filter.trim().toLowerCase();
		const visible = entries
			.filter((entry) => this.kindFilter === 'all' || entry.target.kind === this.kindFilter)
			.filter((entry) => entry.target.path.toLowerCase().includes(filter))
			.sort(byDisplayName);

		if (visible.length === 0) {
			const message =
				entries.length === 0
					? 'Nothing is locked yet. Lock notes and folders from the file explorer menu, the note header or the command palette.'
					: 'No locked items match the filter.';
			group.addSetting((setting) => {
				setting.setDesc(message);
				this.listedSettings.push(setting);
			});
			return;
		}

		for (const entry of visible.slice(0, this.visibleLimit)) {
			group.addSetting((setting) => {
				this.renderEntry(setting, entry);
				this.listedSettings.push(setting);
			});
		}

		if (visible.length > this.visibleLimit) {
			group.addSetting((setting) => {
				setting
					.setDesc(`Showing ${this.visibleLimit} of ${visible.length}`)
					.addButton((button) =>
						button.setButtonText(`Show ${Math.min(PAGE_SIZE, visible.length - this.visibleLimit)} more`).onClick(() => {
							this.visibleLimit += PAGE_SIZE;
							this.renderList();
						}),
					);
				this.listedSettings.push(setting);
			});
		}
	}

	private renderEntry(setting: Setting, entry: LockEntry): void {
		const { target, level } = entry;
		const exists = this.targetExists(entry);
		setting.setName(displayNameOf(entry)).setDesc(describeLocation(entry, exists));

		if (!exists) {
			setting.settingEl.addClass('note-locker-missing');
			setting.addButton((button) =>
				button.setButtonText('Remove').onClick(() => void this.plugin.actions.forget(target)),
			);
			return;
		}

		setting
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(LEVEL_OPTIONS)
					.setValue(level)
					.onChange((value) => {
						void this.plugin.actions.setLevel([target], value as LockLevel);
						this.renderList();
					}),
			)
			.addButton((button) =>
				button.setButtonText('Unlock').onClick(() => void this.plugin.actions.setLevel([target], null)),
			);
	}

	private targetExists({ target }: LockEntry): boolean {
		const file = this.app.vault.getAbstractFileByPath(target.path);
		return target.kind === 'folder' ? file instanceof TFolder : file instanceof TFile;
	}
}

function displayNameOf({ target }: LockEntry): string {
	return fileNameOf(target.path).replace(/\.md$/, '');
}

function byDisplayName(a: LockEntry, b: LockEntry): number {
	return (
		displayNameOf(a).localeCompare(displayNameOf(b), undefined, { sensitivity: 'base', numeric: true }) ||
		a.target.path.localeCompare(b.target.path)
	);
}

function describeLocation({ target }: LockEntry, exists: boolean): string {
	const kind = target.kind === 'folder' ? 'Folder' : 'Note';
	const [parent] = parentFoldersOf(target.path);
	const location = `${kind} in ${parent ? `"${parent}"` : 'vault root'}`;
	return exists ? location : `${location} - not found in vault`;
}
