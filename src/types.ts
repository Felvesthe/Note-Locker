export type LockLevel = 'lock' | 'strict';

export type LockTargetKind = 'note' | 'folder';

export interface LockTarget {
	kind: LockTargetKind;
	path: string;
}

export interface EffectiveLock {
	level: LockLevel;
	source: LockTarget;
}

export interface LockEntry {
	target: LockTarget;
	level: LockLevel;
}

export type LockMap = Record<string, LockLevel>;

export interface NoteLockerSettings {
	showExplorerIcons: boolean;
	showHeaderButton: boolean;
	showStatusBar: boolean;
	showNotifications: boolean;
}

export const DATA_VERSION = 2;

export interface PluginData {
	version: typeof DATA_VERSION;
	notes: LockMap;
	folders: LockMap;
	settings: NoteLockerSettings;
}
