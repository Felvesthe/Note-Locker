import { MarkdownView, Notice } from 'obsidian';
import type NoteLockerPlugin from './main';
import type { EffectiveLock, LockLevel, LockTarget } from './types';

interface ActiveNote {
	view: MarkdownView;
	target: LockTarget;
	ownLevel: LockLevel | null;
	lock: EffectiveLock | null;
}

export function registerCommands(plugin: NoteLockerPlugin): void {
	const activeNote = (): ActiveNote | null => {
		const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file || view.file.extension !== 'md') return null;

		const target: LockTarget = { kind: 'note', path: view.file.path };
		return {
			view,
			target,
			ownLevel: plugin.locks.getOwnLevel(target),
			lock: plugin.locks.getEffectiveLock(target),
		};
	};

	plugin.addCommand({
		id: 'toggle-note-lock',
		name: 'Toggle lock for current note',
		checkCallback: (checking) => {
			const note = activeNote();
			if (!note) return false;
			if (checking) return true;

			if (note.ownLevel) {
				void plugin.actions.setLevel([note.target], null);
			} else if (note.lock) {
				new Notice(`Locked by folder: ${note.lock.source.path}`);
			} else {
				void plugin.actions.setLevel([note.target], 'lock');
			}
			return true;
		},
	});

	plugin.addCommand({
		id: 'strict-lock-current-note',
		name: 'Strict lock current note',
		checkCallback: (checking) => {
			const note = activeNote();
			if (!note || note.lock?.level === 'strict') return false;
			if (!checking) void plugin.actions.setLevel([note.target], 'strict');
			return true;
		},
	});

	plugin.addCommand({
		id: 'unlock-current-note',
		name: 'Unlock current note',
		checkCallback: (checking) => {
			const note = activeNote();
			if (!note?.ownLevel) return false;
			if (!checking) void plugin.actions.setLevel([note.target], null);
			return true;
		},
	});

	plugin.addCommand({
		id: 'edit-current-note-once',
		name: 'Edit current note once',
		checkCallback: (checking) => {
			const note = activeNote();
			const { leaf } = note?.view ?? {};
			if (!note || !leaf || note.lock?.level !== 'strict') return false;
			if (plugin.sessions.get(leaf, note.target.path)) return false;
			if (!checking) plugin.actions.startEditOnce(leaf, note.target.path);
			return true;
		},
	});

	plugin.addCommand({
		id: 'finish-editing-current-note',
		name: 'Finish editing current note',
		checkCallback: (checking) => {
			const note = activeNote();
			const { leaf } = note?.view ?? {};
			if (!note?.lock || !leaf || !plugin.sessions.get(leaf, note.target.path)) return false;
			if (!checking) plugin.actions.finishEditOnce(leaf);
			return true;
		},
	});
}
