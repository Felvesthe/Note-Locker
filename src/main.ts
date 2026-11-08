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
import { registerContextMenus } from './ui/contextMenus';
import { ExplorerIcons } from './ui/explorerIcons';
import { HeaderButtons } from './ui/headerButton';
import { StatusBar } from './ui/statusBar';
import { registerVaultEvents } from './vaultEvents';

export default class NoteLockerPlugin extends Plugin {
	settings!: NoteLockerSettings;
	locks!: LockStore;
	readonly sessions = new EditOnceSessions();
	readonly actions = new LockActions(this);
	readonly editorGuard = new EditorGuard(this);
	readonly viewModes = new ViewModeController(this);
	private readonly headerButtons = new HeaderButtons(this);
	private readonly statusBar = new StatusBar(this);
	private readonly explorerIcons = new ExplorerIcons(this);
	private pendingSave: Promise<void> = Promise.resolve();

	async onload() {
		await this.loadState();

		this.registerEditorExtension(this.editorGuard.extension);
		registerReadingViewGuard(this);
		registerVaultEvents(this);
		registerContextMenus(this);
		registerCommands(this);

		this.app.workspace.onLayoutReady(() => {
			this.viewModes.start();
			this.headerButtons.start();
			this.statusBar.start();
			this.explorerIcons.start();
		});
	}

	onunload() {
		this.viewModes.stop();
		this.headerButtons.stop();
		this.statusBar.stop();
		this.explorerIcons.stop();
	}

	async onExternalSettingsChange() {
		await this.loadState();
		this.applySettings();
		this.actions.notifyChanged();
	}

	applySettings(): void {
		this.headerButtons.refresh();
		this.statusBar.refresh();
		this.explorerIcons.refresh();
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
