import { normalizePath, type Plugin } from 'obsidian';
import { createEmptyData, DEFAULT_SETTINGS } from './core/defaults';
import { isLockLevel } from './core/lockLevels';
import { isLegacyData, migrateFromV1, type LegacyData } from './core/migration';
import { booleanOr, isRecord } from './core/typeGuards';
import { DATA_VERSION, type LockMap, type PluginData } from './types';

const LEGACY_BACKUP_FILE = 'data-1.x-backup.json';

export async function loadPluginData(plugin: Plugin): Promise<PluginData> {
	const raw: unknown = await plugin.loadData();
	if (raw === null || raw === undefined) return createEmptyData();

	if (isLegacyData(raw)) {
		await backupLegacyData(plugin, raw);
		const migrated = migrateFromV1(raw);
		await savePluginData(plugin, migrated);
		return migrated;
	}

	return sanitizeData(raw);
}

export async function savePluginData(plugin: Plugin, data: PluginData): Promise<void> {
	await plugin.saveData(data);
}

async function backupLegacyData(plugin: Plugin, legacy: LegacyData): Promise<void> {
	const pluginDir = plugin.manifest.dir ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
	const backupPath = normalizePath(`${pluginDir}/${LEGACY_BACKUP_FILE}`);
	const adapter = plugin.app.vault.adapter;

	if (await adapter.exists(backupPath)) return;
	await adapter.write(backupPath, JSON.stringify(legacy, null, '\t'));
}

function sanitizeData(raw: unknown): PluginData {
	if (!isRecord(raw)) return createEmptyData();
	const settings = isRecord(raw.settings) ? raw.settings : {};

	return {
		version: DATA_VERSION,
		notes: sanitizeLockMap(raw.notes),
		folders: sanitizeLockMap(raw.folders),
		settings: {
			showExplorerIcons: booleanOr(settings.showExplorerIcons, DEFAULT_SETTINGS.showExplorerIcons),
			showHeaderButton: booleanOr(settings.showHeaderButton, DEFAULT_SETTINGS.showHeaderButton),
			showStatusBar: booleanOr(settings.showStatusBar, DEFAULT_SETTINGS.showStatusBar),
			showNotifications: booleanOr(settings.showNotifications, DEFAULT_SETTINGS.showNotifications),
		},
	};
}

function sanitizeLockMap(raw: unknown): LockMap {
	if (!isRecord(raw)) return {};
	return Object.fromEntries(Object.entries(raw).filter(([, level]) => isLockLevel(level))) as LockMap;
}
