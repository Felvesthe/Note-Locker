import type { EffectiveLock, LockEntry, LockLevel, LockMap, LockTarget, LockTargetKind } from '../types';
import { isStronger } from './lockLevels';
import { isInside, parentFoldersOf, rebasePath } from './paths';

export class LockStore {
	private readonly levels: Record<LockTargetKind, Map<string, LockLevel>>;

	constructor(notes: LockMap, folders: LockMap) {
		this.levels = {
			note: new Map(Object.entries(notes)),
			folder: new Map(Object.entries(folders)),
		};
	}

	getOwnLevel(target: LockTarget): LockLevel | null {
		return this.levels[target.kind].get(target.path) ?? null;
	}

	/**
	 * The strongest lock among the target and its parent folders. On a tie the
	 * outermost folder wins, because that is the lock the user has to remove.
	 */
	getEffectiveLock(target: LockTarget): EffectiveLock | null {
		const candidates: LockTarget[] = [
			...parentFoldersOf(target.path)
				.reverse()
				.map((path): LockTarget => ({ kind: 'folder', path })),
			target,
		];

		let effective: EffectiveLock | null = null;
		for (const candidate of candidates) {
			const level = this.getOwnLevel(candidate);
			if (level && isStronger(level, effective?.level ?? null)) {
				effective = { level, source: candidate };
			}
		}
		return effective;
	}

	getInheritedLock(target: LockTarget): EffectiveLock | null {
		const [parentFolder] = parentFoldersOf(target.path);
		return parentFolder ? this.getEffectiveLock({ kind: 'folder', path: parentFolder }) : null;
	}

	setLevel(target: LockTarget, level: LockLevel | null): boolean {
		const levels = this.levels[target.kind];
		if ((levels.get(target.path) ?? null) === level) return false;

		if (level) levels.set(target.path, level);
		else levels.delete(target.path);
		return true;
	}

	renamePath(oldPath: string, newPath: string): boolean {
		let changed = false;
		for (const levels of Object.values(this.levels)) {
			for (const [path, level] of [...levels]) {
				const rebased = rebasePath(path, oldPath, newPath);
				if (rebased === null) continue;
				levels.delete(path);
				levels.set(rebased, level);
				changed = true;
			}
		}
		return changed;
	}

	removePath(removedPath: string): boolean {
		let changed = false;
		for (const levels of Object.values(this.levels)) {
			for (const path of [...levels.keys()]) {
				if (path !== removedPath && !isInside(path, removedPath)) continue;
				levels.delete(path);
				changed = true;
			}
		}
		return changed;
	}

	entries(): LockEntry[] {
		const entriesOf = (kind: LockTargetKind): LockEntry[] =>
			[...this.levels[kind]]
				.map(([path, level]) => ({ target: { kind, path }, level }))
				.sort((a, b) => a.target.path.localeCompare(b.target.path));

		return [...entriesOf('folder'), ...entriesOf('note')];
	}

	toData(): { notes: LockMap; folders: LockMap } {
		return {
			notes: Object.fromEntries(this.levels.note),
			folders: Object.fromEntries(this.levels.folder),
		};
	}
}
