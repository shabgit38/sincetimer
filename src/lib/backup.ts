import * as XLSX from 'xlsx';

import { supabase } from './supabase';

const backupVersion = 1;
const backupTables = ['entries', 'entry_logs', 'plan_sessions', 'areas', 'categories', 'settings'] as const;

type BackupTable = (typeof backupTables)[number];
type IdTable = 'entries' | 'entry_logs' | 'plan_sessions';
type OptionTable = 'areas' | 'categories';
type JsonRecord = Record<string, unknown>;

export type BackupFormat = 'json' | 'xlsx';
export type RestoreMode = 'merge' | 'replace';

export interface AppBackup {
  meta: {
    app: 'sincetimer';
    version: number;
    exported_at: string;
    counts: Record<BackupTable, number>;
  };
  data: Record<BackupTable, JsonRecord[]>;
}

export interface RestoreResult {
  counts: Record<BackupTable, number>;
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in before exporting or importing backups.');
  return data.user.id;
}

function emptyBackupData(): Record<BackupTable, JsonRecord[]> {
  return {
    entries: [],
    entry_logs: [],
    plan_sessions: [],
    areas: [],
    categories: [],
    settings: [],
  };
}

function isBackupTable(value: string): value is BackupTable {
  return backupTables.includes(value as BackupTable);
}

function normalizeRecordForExport(record: JsonRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      value && typeof value === 'object' ? JSON.stringify(value) : value,
    ])
  );
}

function normalizeRecordForImport(record: JsonRecord) {
  const next = { ...record };
  ['metadata', 'subscription'].forEach((key) => {
    const value = next[key];
    if (typeof value !== 'string' || !value.trim()) return;
    try {
      next[key] = JSON.parse(value);
    } catch {
      throw new Error(`Invalid JSON in ${key}.`);
    }
  });
  return next;
}

function getBackupFilename(extension: BackupFormat) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `sincetimer-backup-${stamp}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateBackup(value: unknown): AppBackup {
  if (!value || typeof value !== 'object') throw new Error('Backup file is not valid.');
  const backup = value as Partial<AppBackup>;
  if (backup.meta?.app !== 'sincetimer') throw new Error('This is not a sincetimer backup.');
  if (backup.meta.version !== backupVersion) throw new Error('Unsupported backup version.');
  if (!backup.data || typeof backup.data !== 'object') throw new Error('Backup data is missing.');

  const data = emptyBackupData();
  backupTables.forEach((table) => {
    const rows = backup.data?.[table];
    if (!Array.isArray(rows)) throw new Error(`Backup is missing ${table}.`);
    data[table] = rows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Backup has an invalid row in ${table}.`);
      }
      return normalizeRecordForImport(row as JsonRecord);
    });
  });

  return {
    meta: backup.meta as AppBackup['meta'],
    data,
  };
}

async function selectTable(table: BackupTable) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw error;
  return (data ?? []) as JsonRecord[];
}

export async function createBackup(): Promise<AppBackup> {
  await requireUserId();
  const rows = await Promise.all(backupTables.map((table) => selectTable(table)));
  const data = emptyBackupData();
  const counts = {} as Record<BackupTable, number>;

  backupTables.forEach((table, index) => {
    data[table] = rows[index];
    counts[table] = rows[index].length;
  });

  return {
    meta: {
      app: 'sincetimer',
      version: backupVersion,
      exported_at: new Date().toISOString(),
      counts,
    },
    data,
  };
}

export function downloadJsonBackup(backup: AppBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  downloadBlob(blob, getBackupFilename('json'));
}

export function downloadExcelBackup(backup: AppBackup) {
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    { key: 'app', value: backup.meta.app },
    { key: 'version', value: backup.meta.version },
    { key: 'exported_at', value: backup.meta.exported_at },
    ...backupTables.map((table) => ({ key: `${table}_count`, value: backup.meta.counts[table] })),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), '_meta');

  backupTables.forEach((table) => {
    const rows = backup.data[table].map(normalizeRecordForExport);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), table);
  });

  const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  downloadBlob(
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    getBackupFilename('xlsx')
  );
}

export async function readBackupFile(file: File): Promise<AppBackup> {
  if (file.name.toLocaleLowerCase().endsWith('.json')) {
    return validateBackup(JSON.parse(await file.text()));
  }

  if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) {
    throw new Error('Choose a .json or .xlsx backup file.');
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const data = emptyBackupData();
  backupTables.forEach((table) => {
    if (!workbook.SheetNames.includes(table)) throw new Error(`Excel backup is missing ${table}.`);
    data[table] = XLSX.utils.sheet_to_json<JsonRecord>(workbook.Sheets[table], { defval: null });
  });

  return validateBackup({
    meta: {
      app: 'sincetimer',
      version: backupVersion,
      exported_at: new Date().toISOString(),
      counts: Object.fromEntries(backupTables.map((table) => [table, data[table].length])),
    },
    data,
  });
}

function withCurrentUser(rows: JsonRecord[], userId: string): JsonRecord[] {
  return rows.map((row) => ({ ...row, user_id: userId }));
}

async function replaceCurrentData(userId: string) {
  const tables: BackupTable[] = ['plan_sessions', 'entry_logs', 'settings', 'entries', 'areas', 'categories'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw error;
  }
}

async function upsertById(table: IdTable, rows: JsonRecord[], userId: string) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(withCurrentUser(rows, userId), { onConflict: 'id' });
  if (error) throw error;
}

async function upsertOptions(table: OptionTable, rows: JsonRecord[], userId: string) {
  if (rows.length === 0) return;
  const { data: existing, error: existingError } = await supabase.from(table).select('id, name').eq('user_id', userId);
  if (existingError) throw existingError;

  const existingByName = new Map(
    ((existing ?? []) as JsonRecord[]).map((row) => [String(row.name).toLocaleLowerCase(), String(row.id)])
  );
  const importRows = withCurrentUser(rows, userId).filter((row) => {
    const matchingId = existingByName.get(String(row.name).toLocaleLowerCase());
    return !matchingId || matchingId === row.id;
  });

  if (importRows.length === 0) return;
  const { error } = await supabase.from(table).upsert(importRows, { onConflict: 'id' });
  if (error) throw error;
}

async function upsertSettings(rows: JsonRecord[], userId: string) {
  if (rows.length === 0) return;
  const { error } = await supabase.from('settings').upsert(withCurrentUser(rows, userId), { onConflict: 'user_id,key' });
  if (error) throw error;
}

export async function restoreBackup(backup: AppBackup, mode: RestoreMode): Promise<RestoreResult> {
  const userId = await requireUserId();
  const validBackup = validateBackup(backup);
  if (mode === 'replace') await replaceCurrentData(userId);

  await upsertOptions('areas', validBackup.data.areas, userId);
  await upsertOptions('categories', validBackup.data.categories, userId);
  await upsertById('entries', validBackup.data.entries, userId);
  await upsertById('entry_logs', validBackup.data.entry_logs, userId);
  await upsertById('plan_sessions', validBackup.data.plan_sessions, userId);
  await upsertSettings(validBackup.data.settings, userId);

  return { counts: validBackup.meta.counts };
}

export function getBackupSummary(backup: AppBackup) {
  return backupTables
    .filter(isBackupTable)
    .map((table) => `${table}: ${backup.data[table].length}`)
    .join(', ');
}
