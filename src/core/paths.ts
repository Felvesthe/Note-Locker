export function parentFoldersOf(path: string): string[] {
	const parents: string[] = [];
	let current = path;
	while (current.includes('/')) {
		current = current.slice(0, current.lastIndexOf('/'));
		parents.push(current);
	}
	return parents;
}

export function isInside(path: string, folderPath: string): boolean {
	return path.startsWith(`${folderPath}/`);
}

export function rebasePath(path: string, oldPath: string, newPath: string): string | null {
	if (path === oldPath) return newPath;
	if (isInside(path, oldPath)) return newPath + path.slice(oldPath.length);
	return null;
}

export function fileNameOf(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1);
}
