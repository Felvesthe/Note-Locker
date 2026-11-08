import { DATA_VERSION, type LockMap, type NoteLockerSettings, type PluginData } from '../types';
import { DEFAULT_SETTINGS } from './defaults';
import { booleanOr, isRecord, stringsIn } from './typeGuards';

export interface LegacyData {
	lockedNotes?: unknown;
	lockedFolders?: unknown;
	strictLockedNotes?: unknown;
	preventEditInLockedNotes?: unknown;
	showFileExplorerIcons?: unknown;
	showStatusBarButton?: unknown;
	showNotifications?: unknown;
}

export function isLegacyData(raw: unknown): raw is LegacyData {
	return isRecord(raw) && raw.version === undefined;
}

export function migrateFromV1(legacy: LegacyData): PluginData {
	const normalLevel = legacy.preventEditInLockedNotes === true ? 'strict' : 'lock';

	const notes: LockMap = {};
	for (const path of stringsIn(legacy.lockedNotes)) notes[path] = normalLevel;
	for (const path of stringsIn(legacy.strictLockedNotes)) notes[path] = 'strict';

	const folders: LockMap = {};
	for (const path of stringsIn(legacy.lockedFolders)) folders[path] = 'lock';

	const settings: NoteLockerSettings = {
		...DEFAULT_SETTINGS,
		showExplorerIcons: booleanOr(legacy.showFileExplorerIcons, DEFAULT_SETTINGS.showExplorerIcons),
		showStatusBar: booleanOr(legacy.showStatusBarButton, DEFAULT_SETTINGS.showStatusBar),
		showNotifications: booleanOr(legacy.showNotifications, DEFAULT_SETTINGS.showNotifications),
	};

	return { version: DATA_VERSION, notes, folders, settings };
}
