import { MarkdownView, TFile, TFolder, type TAbstractFile } from 'obsidian';
import type NoteLockerPlugin from '../main';
import type { LockTarget } from '../types';
import { addBulkMenuItems, addFolderMenuItems, addNoteMenuItems } from './lockMenu';

export function registerContextMenus(plugin: NoteLockerPlugin): void {
	const { workspace } = plugin.app;

	plugin.registerEvent(
		workspace.on('file-menu', (menu, file, _source, leaf) => {
			const target = lockTargetOf(file);
			if (target?.kind === 'note') addNoteMenuItems(menu, plugin, target.path, leaf ?? null);
			if (target?.kind === 'folder') addFolderMenuItems(menu, plugin, target.path);
		}),
	);

	plugin.registerEvent(
		workspace.on('files-menu', (menu, files) => {
			const targets = files.map(lockTargetOf).filter((target): target is LockTarget => target !== null);
			if (targets.length > 1) addBulkMenuItems(menu, plugin, targets);
		}),
	);

	plugin.registerEvent(
		workspace.on('editor-menu', (menu, _editor, info) => {
			const target = info.file && lockTargetOf(info.file);
			if (target?.kind !== 'note') return;
			addNoteMenuItems(menu, plugin, target.path, info instanceof MarkdownView ? info.leaf : null);
		}),
	);
}

export function lockTargetOf(file: TAbstractFile): LockTarget | null {
	if (file instanceof TFile) return file.extension === 'md' ? { kind: 'note', path: file.path } : null;
	if (file instanceof TFolder && !file.isRoot()) return { kind: 'folder', path: file.path };
	return null;
}
