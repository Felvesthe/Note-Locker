import { getIcon, type WorkspaceLeaf } from 'obsidian';
import type NoteLockerPlugin from '../main';
import type { EffectiveLock, LockLevel } from '../types';

export interface NoteStateDescription {
	level: LockLevel | null;
	icon: string;
	label: string;
	tooltip: string;
}

export const LOCK_ICONS = {
	unlocked: firstAvailableIcon('lock-open', 'unlock'),
	lock: 'lock',
	strict: 'lock-keyhole',
	editingOnce: firstAvailableIcon('lock-keyhole-open', 'lock-open', 'unlock'),
} as const;

export function iconForLevel(level: LockLevel): string {
	return level === 'strict' ? LOCK_ICONS.strict : LOCK_ICONS.lock;
}

export function describeNote(plugin: NoteLockerPlugin, path: string, leaf: WorkspaceLeaf | null): NoteStateDescription {
	const lock = plugin.locks.getEffectiveLock({ kind: 'note', path });
	if (!lock) {
		return { level: null, icon: LOCK_ICONS.unlocked, label: 'Unlocked', tooltip: 'Not locked' };
	}

	const session = leaf ? plugin.sessions.get(leaf, path) : null;
	if (session?.reason === 'new-note') {
		return {
			level: lock.level,
			icon: LOCK_ICONS.editingOnce,
			label: 'Editing new note',
			tooltip: `New note in locked folder "${lock.source.path}" - editable until you leave it or finish editing`,
		};
	}

	if (lock.level === 'strict' && session) {
		return {
			level: 'strict',
			icon: LOCK_ICONS.editingOnce,
			label: 'Editing once',
			tooltip: 'Editing once - the strict lock returns when you leave this note or finish editing',
		};
	}

	return lock.level === 'strict'
		? {
				level: 'strict',
				icon: LOCK_ICONS.strict,
				label: 'Strictly locked',
				tooltip: `${lockOrigin('Strictly locked', lock)} - editing is blocked`,
			}
		: {
				level: 'lock',
				icon: LOCK_ICONS.lock,
				label: 'Locked',
				tooltip: `${lockOrigin('Locked', lock)} - opens in reading view`,
			};
}

function lockOrigin(prefix: string, lock: EffectiveLock): string {
	return lock.source.kind === 'folder' ? `${prefix} by folder "${lock.source.path}"` : prefix;
}

function firstAvailableIcon(...candidates: string[]): string {
	return candidates.find((icon) => getIcon(icon) !== null) ?? candidates[candidates.length - 1] ?? 'lock';
}
