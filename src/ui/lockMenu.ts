import type { Menu, WorkspaceLeaf } from 'obsidian';
import { fileNameOf } from '../core/paths';
import type NoteLockerPlugin from '../main';
import type { LockLevel, LockTarget } from '../types';
import { iconForLevel, LOCK_ICONS } from './noteState';

interface MenuAction {
	title: string;
	icon: string;
	run: () => void;
}

export function addNoteMenuItems(
	menu: Menu,
	plugin: NoteLockerPlugin,
	path: string,
	leaf: WorkspaceLeaf | null,
): void {
	const target: LockTarget = { kind: 'note', path };
	const actions: MenuAction[] = [];
	const lock = plugin.locks.getEffectiveLock(target);

	const editingOnce = leaf ? plugin.sessions.get(leaf, path) : null;
	if (lock && leaf && editingOnce) {
		actions.push({
			title: 'Finish editing',
			icon: iconForLevel(lock.level),
			run: () => plugin.actions.finishEditOnce(leaf),
		});
	} else if (lock?.level === 'strict' && leaf) {
		actions.push({
			title: 'Edit once',
			icon: LOCK_ICONS.editingOnce,
			run: () => plugin.actions.startEditOnce(leaf, path),
		});
	}

	if (lock?.source.kind === 'folder') {
		menu.addItem((item) =>
			item
				.setTitle(`Locked by folder: ${fileNameOf(lock.source.path)}`)
				.setIcon(iconForLevel(lock.level))
				.setDisabled(true),
		);
		if (lock.level === 'lock') actions.push(setLevelAction(plugin, [target], 'strict', 'Strict lock'));
	} else {
		actions.push(...levelActions(plugin, target, ''));
	}

	addActions(menu, actions);
}

export function addFolderMenuItems(menu: Menu, plugin: NoteLockerPlugin, path: string): void {
	const target: LockTarget = { kind: 'folder', path };
	const lock = plugin.locks.getEffectiveLock(target);
	const inheritedFrom = lock && lock.source.path !== path ? lock : null;

	if (inheritedFrom) {
		menu.addItem((item) =>
			item
				.setTitle(`Locked by folder: ${fileNameOf(inheritedFrom.source.path)}`)
				.setIcon(iconForLevel(inheritedFrom.level))
				.setDisabled(true),
		);
		if (inheritedFrom.level === 'lock' && plugin.locks.getOwnLevel(target) !== 'strict') {
			addActions(menu, [setLevelAction(plugin, [target], 'strict', 'Strict lock folder')]);
		}
		return;
	}

	addActions(menu, levelActions(plugin, target, ' folder'));
}

export function addBulkMenuItems(menu: Menu, plugin: NoteLockerPlugin, targets: LockTarget[]): void {
	const ownLevels = targets.map((target) => plugin.locks.getOwnLevel(target));
	const count = `${targets.length} items`;
	const actions: MenuAction[] = [];

	if (ownLevels.some((level) => level !== 'lock')) {
		actions.push(setLevelAction(plugin, targets, 'lock', `Lock ${count}`));
	}
	if (ownLevels.some((level) => level !== 'strict')) {
		actions.push(setLevelAction(plugin, targets, 'strict', `Strict lock ${count}`));
	}
	if (ownLevels.some((level) => level !== null)) {
		actions.push(setLevelAction(plugin, targets, null, `Unlock ${count}`));
	}

	addActions(menu, actions);
}

function levelActions(plugin: NoteLockerPlugin, target: LockTarget, noun: string): MenuAction[] {
	switch (plugin.locks.getOwnLevel(target)) {
		case null:
			return [
				setLevelAction(plugin, [target], 'lock', `Lock${noun}`),
				setLevelAction(plugin, [target], 'strict', `Strict lock${noun}`),
			];
		case 'lock':
			return [
				setLevelAction(plugin, [target], 'strict', 'Change to strict lock'),
				setLevelAction(plugin, [target], null, `Unlock${noun}`),
			];
		case 'strict':
			return [
				setLevelAction(plugin, [target], 'lock', 'Change to lock'),
				setLevelAction(plugin, [target], null, `Unlock${noun}`),
			];
	}
}

function setLevelAction(
	plugin: NoteLockerPlugin,
	targets: LockTarget[],
	level: LockLevel | null,
	title: string,
): MenuAction {
	return {
		title,
		icon: level ? iconForLevel(level) : LOCK_ICONS.unlocked,
		run: () => void plugin.actions.setLevel(targets, level),
	};
}

function addActions(menu: Menu, actions: MenuAction[]): void {
	for (const action of actions) {
		menu.addItem((item) => item.setTitle(action.title).setIcon(action.icon).onClick(action.run));
	}
}
