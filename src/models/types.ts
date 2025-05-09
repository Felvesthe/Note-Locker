export interface NoteLockerSettings {
	lockedNotes: Set<string>;
	notificationMaxLength: number;
	showFileExplorerIcons: boolean;
	showStatusBarButton: boolean;
}

export const DEFAULT_SETTINGS: NoteLockerSettings = {
	lockedNotes: new Set(),
	notificationMaxLength: 18,
	showFileExplorerIcons: true,
	showStatusBarButton: true
};
