import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { editorInfoField, MarkdownView } from 'obsidian';
import type NoteLockerPlugin from '../main';

const refreshReadOnly = StateEffect.define<null>();

export class EditorGuard {
	private readonly editors = new Set<EditorView>();
	private readonly readOnlyField: StateField<boolean>;
	readonly extension: Extension;

	constructor(private readonly plugin: NoteLockerPlugin) {
		this.readOnlyField = StateField.define<boolean>({
			create: (state) => this.isReadOnly(state),
			update: (readOnly, transaction) =>
				transaction.docChanged || transaction.effects.some((effect) => effect.is(refreshReadOnly))
					? this.isReadOnly(transaction.state)
					: readOnly,
			provide: (field) => [
				EditorState.readOnly.from(field),
				EditorView.editable.from(field, (readOnly) => !readOnly),
			],
		});

		const editorTracker = ViewPlugin.define((view) => {
			this.editors.add(view);
			return { destroy: () => this.editors.delete(view) };
		});

		this.extension = [this.readOnlyField, editorTracker];
	}

	refresh(): void {
		for (const editor of this.editors) {
			const current = editor.state.field(this.readOnlyField, false);
			if (current !== undefined && current !== this.isReadOnly(editor.state)) {
				editor.dispatch({ effects: refreshReadOnly.of(null) });
			}
		}
	}

	private isReadOnly(state: EditorState): boolean {
		const info = state.field(editorInfoField, false);
		const path = info?.file?.path;
		if (!path) return false;

		const lock = this.plugin.locks.getEffectiveLock({ kind: 'note', path });
		if (lock?.level !== 'strict') return false;

		const editingOnce = info instanceof MarkdownView && this.plugin.sessions.get(info.leaf, path) !== null;
		return !editingOnce;
	}
}
