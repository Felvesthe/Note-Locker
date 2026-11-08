import { Events, MarkdownView, Notice, type MarkdownViewModeType, type WorkspaceLeaf } from 'obsidian';
import { isAtLeast } from './core/lockLevels';
import { fileNameOf } from './core/paths';
import type { EditOnceReason } from './enforcement/editOnceSessions';
import type NoteLockerPlugin from './main';
import type { EffectiveLock, LockLevel, LockTarget } from './types';
import { ConfirmModal } from './ui/confirmModal';

const MAX_NOTICE_NAME_LENGTH = 40;

export const LOCKS_CHANGED = 'note-locker:changed';

const SWITCH_TO_STRICT_EXPLANATION = [
	'Strict lock blocks editing completely. To make a change you will have to choose "Edit once" or unlock first.',
	'Task checkboxes and properties also become read-only.',
];

const SWITCH_TO_LOCK_EXPLANATION = [
	'Notes will still open in reading view, but you can switch to editing with one click, without confirmation.',
	'Task checkboxes and properties become editable again.',
];

export class LockActions extends Events {
	private strictEditPromptOpen = false;

	constructor(private readonly plugin: NoteLockerPlugin) {
		super();
	}

	async setLevel(targets: LockTarget[], level: LockLevel | null): Promise<void> {
		const weakensStrictLock = targets.some(
			(target) => this.plugin.locks.getOwnLevel(target) === 'strict' && level !== 'strict',
		);
		const strengthensLock =
			level === 'strict' &&
			targets.some((target) => this.plugin.locks.getEffectiveLock(target)?.level === 'lock');

		if (weakensStrictLock) {
			this.confirmWeakening(targets, level);
		} else if (strengthensLock) {
			this.confirmStrengthening(targets);
		} else {
			await this.applyLevel(targets, level);
		}
	}

	startEditOnce(leaf: WorkspaceLeaf, path: string, reason: EditOnceReason = 'confirmed'): void {
		this.plugin.sessions.start(leaf, path, reason);
		this.notifyChanged();
		if (reason === 'confirmed' && leaf.view instanceof MarkdownView) {
			void setEditingMode(leaf);
		}
	}

	finishEditOnce(leaf: WorkspaceLeaf): void {
		if (!this.plugin.sessions.end(leaf)) return;
		this.notifyChanged();
		void setViewMode(leaf, 'preview');
	}

	confirmStrictEdit(leaf: WorkspaceLeaf, path: string, lock: EffectiveLock): void {
		if (this.strictEditPromptOpen) return;
		this.strictEditPromptOpen = true;

		const lockedByFolder = lock.source.kind === 'folder';
		const note: LockTarget = { kind: 'note', path };
		const strictSources =
			lockedByFolder && this.plugin.locks.getOwnLevel(note) === 'strict' ? [lock.source, note] : [lock.source];

		new ConfirmModal(this.plugin.app, {
			title: 'This note is strictly locked',
			message: [
				'Editing is blocked to prevent accidental changes.',
				...(lockedByFolder
					? [`The lock comes from the folder "${lock.source.path}".`]
					: optional(this.lockKeptByFolder(note, null))),
			],
			choices: [
				{ label: 'Edit once', primary: true, run: () => this.startEditOnce(leaf, path) },
				{
					label: lockedByFolder ? 'Unlock folder' : 'Unlock',
					warning: true,
					run: async () => {
						await this.applyLevel(strictSources, null);
						await setEditingMode(leaf);
					},
				},
			],
			onClose: () => (this.strictEditPromptOpen = false),
		}).open();
	}

	async commit(): Promise<void> {
		this.notifyChanged();
		await this.plugin.persist();
	}

	notifyChanged(): void {
		this.trigger(LOCKS_CHANGED);
	}

	notify(message: string): void {
		if (this.plugin.settings.showNotifications) new Notice(message);
	}

	private confirmStrengthening(targets: LockTarget[]): void {
		const action = 'Change to strict lock';
		new ConfirmModal(this.plugin.app, {
			title: `${action}?`,
			message: [`${subjectWithVerb(targets)} locked.`, ...SWITCH_TO_STRICT_EXPLANATION],
			choices: [{ label: action, primary: true, run: () => this.applyLevel(targets, 'strict') }],
		}).open();
	}

	private confirmWeakening(targets: LockTarget[], level: LockLevel | null): void {
		const [single] = targets.length === 1 ? targets : [];
		const action = level === null ? 'Unlock' : 'Change to lock';
		const explanation = level === 'lock' ? SWITCH_TO_LOCK_EXPLANATION : [];
		const keptByFolder = single
			? optional(this.lockKeptByFolder(single, level))
			: targets.some((target) => this.lockKeptByFolder(target, level))
				? ["Items inside locked folders will keep their folder's lock."]
				: [];

		new ConfirmModal(this.plugin.app, {
			title: `${action}?`,
			message: [
				`${subjectWithVerb(targets)} strictly locked to prevent accidental changes.`,
				...explanation,
				...keptByFolder,
			],
			choices: [{ label: action, warning: true, run: () => this.applyLevel(targets, level) }],
		}).open();
	}

	private lockKeptByFolder(target: LockTarget, newLevel: LockLevel | null): string | null {
		const inherited = this.plugin.locks.getInheritedLock(target);
		if (!inherited || (newLevel && isAtLeast(newLevel, inherited.level))) return null;

		const state = describeLevel(inherited.level);
		return `It will stay ${state} because the folder "${inherited.source.path}" is ${state}.`;
	}

	private async applyLevel(targets: LockTarget[], level: LockLevel | null): Promise<void> {
		const changed = targets.filter((target) => this.plugin.locks.setLevel(target, level));
		if (changed.length === 0) return;

		await this.commit();
		this.notify(this.describeChange(changed, level));
	}

	private describeChange(targets: LockTarget[], level: LockLevel | null): string {
		const verb = level === null ? 'Unlocked' : level === 'strict' ? 'Strictly locked' : 'Locked';
		const [first] = targets;
		if (targets.length > 1 || !first) return `${verb} ${targets.length} items`;

		const folderSuffix = first.kind === 'folder' ? ' folder' : '';
		const inherited = this.plugin.locks.getInheritedLock(first);
		const keptSuffix =
			inherited && this.lockKeptByFolder(first, level)
				? ` - still ${describeLevel(inherited.level)} by folder "${inherited.source.path}"`
				: '';
		return `${verb}${folderSuffix}: ${displayName(first)}${keptSuffix}`;
	}
}

async function setEditingMode(leaf: WorkspaceLeaf): Promise<void> {
	await setViewMode(leaf, 'source');
}

async function setViewMode(leaf: WorkspaceLeaf, mode: MarkdownViewModeType): Promise<void> {
	const state = leaf.getViewState();
	await leaf.setViewState({ ...state, state: { ...state.state, mode } });
}

function subjectWithVerb(targets: LockTarget[]): string {
	const [first] = targets;
	return targets.length === 1 && first ? `"${displayName(first)}" is` : `${targets.length} items are`;
}

function describeLevel(level: LockLevel): string {
	return level === 'strict' ? 'strictly locked' : 'locked';
}

function optional(text: string | null): string[] {
	return text ? [text] : [];
}

function displayName(target: LockTarget): string {
	const name = fileNameOf(target.path).replace(/\.md$/, '');
	return name.length > MAX_NOTICE_NAME_LENGTH ? `${name.slice(0, MAX_NOTICE_NAME_LENGTH)}…` : name;
}
