import { DATA_VERSION, type NoteLockerSettings, type PluginData } from '../types';

export const DEFAULT_SETTINGS: NoteLockerSettings = {
	showExplorerIcons: true,
	showHeaderButton: true,
	showStatusBar: true,
	showNotifications: true,
};

export function createEmptyData(): PluginData {
	return {
		version: DATA_VERSION,
		notes: {},
		folders: {},
		settings: { ...DEFAULT_SETTINGS },
	};
}
