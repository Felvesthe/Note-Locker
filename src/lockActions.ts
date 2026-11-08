import { Events, MarkdownView, Notice, type WorkspaceLeaf } from 'obsidian';
import { fileNameOf } from './core/paths';
import type { EditOnceReason } from './enforcement/editOnceSessions';
import type NoteLockerPlugin from './main';
import type { EffectiveLock, LockLevel, LockTarget } from './types';
import { ConfirmModal } from './ui/confirmModal';

const MAX_NOTICE_NAME_LENGTH = 40;

export const LOCKS_CHANGED = 'note-locker:changed';

export class LockActions extends Events {
	private strictEditPromptOpen = false;

	constructor(private readonly plugin: NoteLockerPlugin) {
		super();
	}

	async setLevel(targets: LockTarget[], level: LockLevel | null): Promise<void> {
		const weakensStrictLock = targets.some(
			(target) => this.plugin.locks.getOwnLevel(target) === 'strict' && level !== 'strict',
		);
		if (weakensStrictLock) {
			this.confirmWeakening(targets, level);
			return;
		}
		await this.applyLevel(targets, level);
	}

	startEditOnce(leaf: WorkspaceLeaf, path: string, reason: EditOnceReason = 'confirmed'): void {
		this.plugin.sessions.start(leaf, path, reason);
		this.notifyChanged();
		if (reason === 'confirmed' && leaf.view instanceof MarkdownView) {
			void setEditingMode(leaf);
		}
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
				...(lockedByFolder ? [`The lock comes from the folder "${lock.source.path}".`] : []),
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

	private confirmWeakening(targets: LockTarget[], level: LockLevel | null): void {
		const subject = targets.length === 1 && targets[0] ? `"${displayName(targets[0])}"` : `${targets.length} items`;
		const action = level === null ? 'Unlock' : 'Change to lock';

		new ConfirmModal(this.plugin.app, {
			title: `${action}?`,
			message: [`${subject} is strictly locked to prevent accidental changes.`],
			choices: [{ label: action, warning: true, run: () => this.applyLevel(targets, level) }],
		}).open();
	}

	private async applyLevel(targets: LockTarget[], level: LockLevel | null): Promise<void> {
		const changed = targets.filter((target) => this.plugin.locks.setLevel(target, level));
		if (changed.length === 0) return;

		await this.commit();
		this.notify(describeChange(changed, level));
	}
}

async function setEditingMode(leaf: WorkspaceLeaf): Promise<void> {
	const state = leaf.getViewState();
	await leaf.setViewState({ ...state, state: { ...state.state, mode: 'source' } });
}

function describeChange(targets: LockTarget[], level: LockLevel | null): string {
	const verb = level === null ? 'Unlocked' : level === 'strict' ? 'Strictly locked' : 'Locked';
	const [first] = targets;
	if (targets.length > 1 || !first) return `${verb} ${targets.length} items`;

	const folderSuffix = first.kind === 'folder' ? ' folder' : '';
	return `${verb}${folderSuffix}: ${displayName(first)}`;
}

function displayName(target: LockTarget): string {
	const name = fileNameOf(target.path).replace(/\.md$/, '');
	return name.length > MAX_NOTICE_NAME_LENGTH ? `${name.slice(0, MAX_NOTICE_NAME_LENGTH)}…` : name;
}
