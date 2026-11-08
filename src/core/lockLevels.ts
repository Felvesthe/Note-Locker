import type { LockLevel } from '../types';

const LEVEL_STRENGTH: Record<LockLevel, number> = {
	lock: 1,
	strict: 2,
};

export function isLockLevel(value: unknown): value is LockLevel {
	return value === 'lock' || value === 'strict';
}

export function isAtLeast(level: LockLevel | null, minimum: LockLevel): boolean {
	return level !== null && LEVEL_STRENGTH[level] >= LEVEL_STRENGTH[minimum];
}

export function isStronger(level: LockLevel, than: LockLevel | null): boolean {
	return than === null || LEVEL_STRENGTH[level] > LEVEL_STRENGTH[than];
}
