import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { LockStore } from './core/lockStore';
import { EditOnceSessions } from './enforcement/editOnceSessions';
import { EditorGuard } from './enforcement/editorGuard';
import { registerReadingViewGuard } from './enforcement/readingViewGuard';
import { ViewModeController } from './enforcement/viewModeController';
import { LockActions } from './lockActions';
import { loadPluginData, savePluginData } from './storage';
import { DATA_VERSION, type NoteLockerSettings } from './types';
import { registerVaultEvents } from './vaultEvents';

export default class NoteLockerPlugin extends Plugin {
	settings!: NoteLockerSettings;
	locks!: LockStore;
	readonly sessions = new EditOnceSessions();
	readonly actions = new LockActions(this);
	readonly editorGuard = new EditorGuard(this);
	readonly viewModes = new ViewModeController(this);
	private pendingSave: Promise<void> = Promise.resolve();

	async onload() {
		await this.loadState();

		this.registerEditorExtension(this.editorGuard.extension);
		registerReadingViewGuard(this);
		registerVaultEvents(this);
		registerCommands(this);

		this.app.workspace.onLayoutReady(() => this.viewModes.start());
	}

	onunload() {
		this.viewModes.stop();
	}

	async onExternalSettingsChange() {
		await this.loadState();
		this.actions.notifyChanged();
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
