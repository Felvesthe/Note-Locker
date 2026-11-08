import { Plugin } from 'obsidian';
import { LockStore } from './core/lockStore';
import { loadPluginData, savePluginData } from './storage';
import { DATA_VERSION, type NoteLockerSettings } from './types';
import { registerVaultEvents } from './vaultEvents';

export default class NoteLockerPlugin extends Plugin {
	settings!: NoteLockerSettings;
	locks!: LockStore;
	private pendingSave: Promise<void> = Promise.resolve();

	async onload() {
		await this.loadState();
		registerVaultEvents(this);
	}

	async onExternalSettingsChange() {
		await this.loadState();
	}

	persist(): Promise<void> {
		this.pendingSave = this.pendingSave
			.then(() =>
				savePluginData(this, {
					version: DATA_VERSION,
					...this.locks.toData(),
					settings: this.settings,
				}),
			)
			.catch((error: unknown) => console.error('Note Locker: failed to save data', error));
		return this.pendingSave;
	}

	private async loadState(): Promise<void> {
		const data = await loadPluginData(this);
		this.settings = data.settings;
		this.locks = new LockStore(data.notes, data.folders);
	}
}
