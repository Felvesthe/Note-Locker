import { TFile } from 'obsidian';
import type NoteLockerPlugin from './main';

export function registerVaultEvents(plugin: NoteLockerPlugin): void {
	const { vault } = plugin.app;

	plugin.registerEvent(
		vault.on('rename', (file, oldPath) => {
			plugin.viewModes.handleRename(oldPath, file.path);

			const leftMarkdown = file instanceof TFile && file.extension !== 'md';
			const changed = leftMarkdown
				? plugin.locks.removePath(oldPath)
				: plugin.locks.renamePath(oldPath, file.path);
			if (changed) void plugin.actions.commit();
		}),
	);

	plugin.registerEvent(
		vault.on('delete', (file) => {
			if (plugin.locks.removePath(file.path)) void plugin.actions.commit();
		}),
	);
}
