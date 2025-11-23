export interface NoteLockerSettings {
	lockedNotes: Set<string>;
	lockedFolders: Set<string>;
	strictLockedNotes: Set<string>;
	mobileNotificationMaxLength: number;
	desktopNotificationMaxLength: number;
	showFileExplorerIcons: boolean;
	showStatusBarButton: boolean;
	showNotifications: boolean;
}

export const DEFAULT_SETTINGS: NoteLockerSettings = {
	lockedNotes: new Set(),
	lockedFolders: new Set(),
	strictLockedNotes: new Set(),
	mobileNotificationMaxLength: 18,
	desktopNotificationMaxLength: 22,
	showFileExplorerIcons: true,
	showStatusBarButton: true,
	showNotifications: true
};
