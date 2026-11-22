import type { App, TFile, TFolder } from 'obsidian';
import { isRecord } from '../core/typeGuards';
import type NoteLockerPlugin from '../main';
import type { LockTarget } from '../types';
import { lockTargetOf } from '../ui/contextMenus';
import type { IconSurface } from '../ui/explorerIcons';
import { addBulkMenuItems, addFolderMenuItems, addNoteMenuItems, type MenuLike } from '../ui/lockMenu';

const NN_PLUGIN_ID = 'notebook-navigator';
const NN_VIEW_TYPE = 'notebook-navigator';

export const NOTEBOOK_NAVIGATOR_ICON_SURFACE: IconSurface = {
	viewType: NN_VIEW_TYPE,
	isEnabled: (settings) => settings.showNotebookNavigatorIcons,
	itemWithPathSelector: '.nn-file[data-path], .nn-navitem[data-drag-type="folder"][data-path]',
	kindOf: (itemEl) => (itemEl.classList.contains('nn-file') ? 'note' : 'folder'),
	iconContainerOf: (itemEl) =>
		itemEl.querySelector<HTMLElement>(
			itemEl.classList.contains('nn-file') ? '.nn-file-content' : '.nn-navitem-content',
		),
};

type Unregister = () => void;

interface FileMenuContext extends MenuLike {
	file: TFile;
	selection: { mode: 'single' | 'multiple'; files: readonly TFile[] };
}

interface FolderMenuContext extends MenuLike {
	folder: TFolder;
}

interface NotebookNavigatorMenusApi {
	registerFileMenu(callback: (context: FileMenuContext) => void): Unregister;
	registerFolderMenu(callback: (context: FolderMenuContext) => void): Unregister;
}

export class NotebookNavigatorMenus {
	private attachedApiInstance: unknown = null;
	private menuUnregisters: Unregister[] = [];

	constructor(private readonly plugin: NoteLockerPlugin) {}

	start(): void {
		this.plugin.registerEvent(this.plugin.app.workspace.on('layout-change', () => this.reattachIfApiChanged()));
		this.reattachIfApiChanged();
	}

	stop(): void {
		this.detachMenus();
	}

	private reattachIfApiChanged(): void {
		const api = notebookNavigatorApiOf(this.plugin.app);
		if (api?.instance === this.attachedApiInstance) return;

		this.detachMenus();
		if (!api) return;

		this.attachedApiInstance = api.instance;
		try {
			this.menuUnregisters = [
				api.menus.registerFileMenu((context) => this.addFileItems(context)),
				api.menus.registerFolderMenu((context) => this.addFolderItems(context)),
			];
		} catch (error) {
			console.error('Note Locker: failed to register Notebook Navigator menus', error);
		}
	}

	private detachMenus(): void {
		for (const unregister of this.menuUnregisters) unregister();
		this.menuUnregisters = [];
		this.attachedApiInstance = null;
	}

	private addFileItems(context: FileMenuContext): void {
		if (context.selection.mode === 'multiple') {
			const targets = context.selection.files
				.map(lockTargetOf)
				.filter((target): target is LockTarget => target !== null);
			if (targets.length > 1) addBulkMenuItems(context, this.plugin, targets);
			return;
		}

		const target = lockTargetOf(context.file);
		if (target?.kind === 'note') addNoteMenuItems(context, this.plugin, target.path, null);
	}

	private addFolderItems(context: FolderMenuContext): void {
		const target = lockTargetOf(context.folder);
		if (target?.kind === 'folder') addFolderMenuItems(context, this.plugin, target.path);
	}
}

function notebookNavigatorApiOf(app: App): { instance: object; menus: NotebookNavigatorMenusApi } | null {
	const plugins: unknown = (app as unknown as { plugins?: unknown }).plugins;
	if (!isRecord(plugins) || typeof plugins.getPlugin !== 'function') return null;

	const nnPlugin: unknown = (plugins.getPlugin as (id: string) => unknown).call(plugins, NN_PLUGIN_ID);
	if (!isRecord(nnPlugin) || !isRecord(nnPlugin.api)) return null;

	const { menus } = nnPlugin.api;
	if (!isRecord(menus)) return null;
	if (typeof menus.registerFileMenu !== 'function' || typeof menus.registerFolderMenu !== 'function') return null;

	return { instance: nnPlugin.api, menus: menus as unknown as NotebookNavigatorMenusApi };
}
