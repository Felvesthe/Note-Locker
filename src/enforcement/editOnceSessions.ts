import type { WorkspaceLeaf } from 'obsidian';
import { rebasePath } from '../core/paths';

export type EditOnceReason = 'confirmed' | 'new-note';

export interface EditOnceSession {
	path: string;
	reason: EditOnceReason;
}

const NEW_NOTE_GRACE_MS = 60_000;

export class EditOnceSessions {
	private readonly sessions = new WeakMap<WorkspaceLeaf, EditOnceSession>();
	private readonly createdAt = new Map<string, number>();

	start(leaf: WorkspaceLeaf, path: string, reason: EditOnceReason): void {
		this.sessions.set(leaf, { path, reason });
	}

	end(leaf: WorkspaceLeaf): boolean {
		return this.sessions.delete(leaf);
	}

	get(leaf: WorkspaceLeaf, path: string): EditOnceSession | null {
		const session = this.sessions.get(leaf);
		return session?.path === path ? session : null;
	}

	rename(leaf: WorkspaceLeaf, oldPath: string, newPath: string): void {
		const session = this.sessions.get(leaf);
		const rebased = session && rebasePath(session.path, oldPath, newPath);
		if (session && rebased) this.sessions.set(leaf, { ...session, path: rebased });
	}

	markCreated(path: string): void {
		const now = Date.now();
		for (const [createdPath, createdAt] of this.createdAt) {
			if (now - createdAt > NEW_NOTE_GRACE_MS) this.createdAt.delete(createdPath);
		}
		this.createdAt.set(path, now);
	}

	consumeNewNote(path: string): boolean {
		const createdAt = this.createdAt.get(path);
		this.createdAt.delete(path);
		return createdAt !== undefined && Date.now() - createdAt <= NEW_NOTE_GRACE_MS;
	}
}
