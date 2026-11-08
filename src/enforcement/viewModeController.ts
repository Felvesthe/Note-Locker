import { debounce, MarkdownView, TFile, type MarkdownViewModeType, type WorkspaceLeaf } from 'obsidian';
import { rebasePath } from '../core/paths';
import { LOCKS_CHANGED } from '../lockActions';
import type NoteLockerPlugin from '../main';
import type { EffectiveLock } from '../types';
import { markStrictView } from './readingViewGuard';

const MODE_SWITCH_ATTEMPTS = 20;
const MODE_SWITCH_RETRY_MS = 50;
const JUST_CREATED_MS = 10_000;

interface LeafSnapshot {
	path: string;
	mode: MarkdownViewModeType;
}

export class ViewModeController {
	private readonly snapshots = new WeakMap<WorkspaceLeaf, LeafSnapshot>();
	private readonly modesToRestore = new WeakMap<WorkspaceLeaf, MarkdownViewModeType>();
	private readonly leavesSwitchingMode = new WeakSet<WorkspaceLeaf>();
	private readonly requestSync = debounce(() => this.syncAllLeaves(), 0, true);

	constructor(private readonly plugin: NoteLockerPlugin) {}

	start(): void {
		const { workspace, vault } = this.plugin.app;

		this.plugin.registerEvent(workspace.on('file-open', this.requestSync));
		this.plugin.registerEvent(workspace.on('layout-change', this.requestSync));
		this.plugin.registerEvent(workspace.on('active-leaf-change', this.requestSync));
		this.plugin.registerEvent(this.plugin.actions.on(LOCKS_CHANGED, this.requestSync));
		this.plugin.registerEvent(
			vault.on('create', (file) => {
				if (file instanceof TFile && isJustCreated(file)) this.plugin.sessions.markCreated(file.path);
			}),
		);
		this.requestSync();
	}

	stop(): void {
		this.requestSync.cancel();
		for (const view of this.markdownViews()) markStrictView(view, false);
	}

	handleRename(oldPath: string, newPath: string): void {
		for (const view of this.markdownViews()) {
			const snapshot = this.snapshots.get(view.leaf);
			const rebased = snapshot && rebasePath(snapshot.path, oldPath, newPath);
			if (snapshot && rebased) this.snapshots.set(view.leaf, { ...snapshot, path: rebased });
			this.plugin.sessions.rename(view.leaf, oldPath, newPath);
		}
	}

	private syncAllLeaves(): void {
		for (const view of this.markdownViews()) this.syncView(view);
		this.plugin.editorGuard.refresh();
	}

	private syncView(view: MarkdownView): void {
		const path = view.file?.path;
		const { leaf } = view;
		if (!path || this.leavesSwitchingMode.has(leaf)) return;

		const lock = this.plugin.locks.getEffectiveLock({ kind: 'note', path });
		const previous = this.snapshots.get(leaf);
		const isEditingOnce = () => this.plugin.sessions.get(leaf, path) !== null;
		let mode = view.getMode();

		if (previous?.path !== path) {
			mode = this.handleOpened(leaf, path, mode, lock);
		} else if (previous.mode === 'preview' && mode === 'source') {
			mode = this.handleSwitchedToEditing(leaf, path, lock);
		} else if (previous.mode === 'source' && mode === 'preview' && isEditingOnce()) {
			this.plugin.sessions.end(leaf);
			this.plugin.actions.notifyChanged();
		} else if (lock?.level === 'strict' && mode === 'source' && !isEditingOnce()) {
			mode = this.switchMode(leaf, path, 'preview');
		}

		this.snapshots.set(leaf, { path, mode });
		markStrictView(view, lock?.level === 'strict' && !isEditingOnce());
	}

	private handleOpened(
		leaf: WorkspaceLeaf,
		path: string,
		mode: MarkdownViewModeType,
		lock: EffectiveLock | null,
	): MarkdownViewModeType {
		this.plugin.sessions.end(leaf);
		if (!lock) return this.restoreModeFromBeforeLock(leaf, path, mode);

		if (this.plugin.sessions.consumeNewNote(path)) {
			this.plugin.sessions.start(leaf, path, 'new-note');
			this.plugin.actions.notify(`New note in locked folder "${lock.source.path}" - editable until you leave it`);
			return mode;
		}

		if (mode !== 'source') return mode;
		if (!this.modesToRestore.has(leaf)) this.modesToRestore.set(leaf, mode);
		return this.switchMode(leaf, path, 'preview');
	}

	private restoreModeFromBeforeLock(
		leaf: WorkspaceLeaf,
		path: string,
		mode: MarkdownViewModeType,
	): MarkdownViewModeType {
		const modeToRestore = this.modesToRestore.get(leaf);
		this.modesToRestore.delete(leaf);
		return modeToRestore && modeToRestore !== mode ? this.switchMode(leaf, path, modeToRestore) : mode;
	}

	private handleSwitchedToEditing(
		leaf: WorkspaceLeaf,
		path: string,
		lock: EffectiveLock | null,
	): MarkdownViewModeType {
		if (lock?.level !== 'strict' || this.plugin.sessions.get(leaf, path)) return 'source';

		const isActiveLeaf = this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.leaf === leaf;
		if (isActiveLeaf) this.plugin.actions.confirmStrictEdit(leaf, path, lock);
		return this.switchMode(leaf, path, 'preview');
	}

	private switchMode(leaf: WorkspaceLeaf, path: string, mode: MarkdownViewModeType): MarkdownViewModeType {
		this.leavesSwitchingMode.add(leaf);
		void this.forceMode(leaf, path, mode).finally(() => {
			this.leavesSwitchingMode.delete(leaf);
			this.recordActualMode(leaf);
			this.requestSync();
		});
		return mode;
	}

	/**
	 * Obsidian silently ignores setViewState while a leaf is still opening a file,
	 * so keep retrying until the mode actually changes.
	 */
	private async forceMode(leaf: WorkspaceLeaf, path: string, mode: MarkdownViewModeType): Promise<void> {
		for (let attempt = 0; attempt < MODE_SWITCH_ATTEMPTS; attempt++) {
			const { view } = leaf;
			if (!(view instanceof MarkdownView) || view.file?.path !== path || view.getMode() === mode) return;

			const state = leaf.getViewState();
			await leaf.setViewState({ ...state, state: { ...state.state, mode } });
			await sleep(MODE_SWITCH_RETRY_MS);
		}
	}

	private recordActualMode(leaf: WorkspaceLeaf): void {
		const { view } = leaf;
		if (view instanceof MarkdownView && view.file) {
			this.snapshots.set(leaf, { path: view.file.path, mode: view.getMode() });
		}
	}

	private markdownViews(): MarkdownView[] {
		return this.plugin.app.workspace
			.getLeavesOfType('markdown')
			.map((leaf) => leaf.view)
			.filter((view): view is MarkdownView => view instanceof MarkdownView);
	}
}

function isJustCreated(file: TFile): boolean {
	return Date.now() - file.stat.ctime < JUST_CREATED_MS;
}
