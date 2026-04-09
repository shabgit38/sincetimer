import * as SQLite from 'expo-sqlite';

const DB_NAME = 'since_timer.db';
const db = SQLite.openDatabase(DB_NAME);

let initPromise: Promise<void> | null = null;

export type EntryInput = {
  title: string;
  category: 'purchase' | 'task' | 'event' | 'routine';
  entry_date: string;
  next_due_date?: string | null;
  price?: number | null;
  notes?: string | null;
  reminder_enabled?: number;
  created_at?: string;
};

export type EntryRow = EntryInput & { id: number; reminder_enabled: number; created_at: string };

export type HistoryRow = {
  id: number;
  entry_id: number;
  logged_date: string;
  notes?: string | null;
};

function executeSql(sql: string, params: (string | number | null)[] = []) {
  return new Promise<SQLite.SQLResultSet>((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          params,
          (_tx, result) => resolve(result),
          (_tx, error) => {
            reject(error);
            return false;
          }
        );
      },
      (error) => reject(error)
    );
  });
}

export function initDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql('PRAGMA foreign_keys = ON;');

        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT CHECK (category IN ('purchase','task','event','routine')),
            entry_date TEXT NOT NULL,
            next_due_date TEXT,
            price REAL,
            notes TEXT,
            reminder_enabled INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
          );`
        );

        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY,
            entry_id INTEGER NOT NULL,
            logged_date TEXT NOT NULL,
            notes TEXT,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
          );`
        );

        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS app_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            history_months INTEGER DEFAULT 6
          );`
        );

        tx.executeSql('INSERT OR IGNORE INTO app_settings (id, history_months) VALUES (1, 6);');
      },
      (error) => reject(error),
      () => resolve()
    );
  });

  return initPromise;
}

export async function insertEntry(entry: EntryInput): Promise<number> {
  await initDb();
  const createdAt = entry.created_at ?? new Date().toISOString();
  const reminderEnabled = entry.reminder_enabled ?? 0;

  const result = await executeSql(
    `INSERT INTO entries (
      title,
      category,
      entry_date,
      next_due_date,
      price,
      notes,
      reminder_enabled,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      entry.title,
      entry.category,
      entry.entry_date,
      entry.next_due_date ?? null,
      entry.price ?? null,
      entry.notes ?? null,
      reminderEnabled,
      createdAt,
    ]
  );

  return result.insertId ?? 0;
}

export async function getAllEntries(): Promise<EntryRow[]> {
  await initDb();
  const result = await executeSql('SELECT * FROM entries ORDER BY created_at DESC;');
  return (result.rows?._array ?? []) as EntryRow[];
}

export async function updateEntry(id: number, updates: Partial<EntryInput>): Promise<void> {
  await initDb();

  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    params.push(updates.title);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    params.push(updates.category);
  }
  if (updates.entry_date !== undefined) {
    fields.push('entry_date = ?');
    params.push(updates.entry_date);
  }
  if (updates.next_due_date !== undefined) {
    fields.push('next_due_date = ?');
    params.push(updates.next_due_date ?? null);
  }
  if (updates.price !== undefined) {
    fields.push('price = ?');
    params.push(updates.price ?? null);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    params.push(updates.notes ?? null);
  }
  if (updates.reminder_enabled !== undefined) {
    fields.push('reminder_enabled = ?');
    params.push(updates.reminder_enabled ?? 0);
  }
  if (updates.created_at !== undefined) {
    fields.push('created_at = ?');
    params.push(updates.created_at);
  }

  if (fields.length === 0) return;

  params.push(id);
  await executeSql(`UPDATE entries SET ${fields.join(', ')} WHERE id = ?;`, params);
}

export async function deleteEntry(id: number): Promise<void> {
  await initDb();
  await executeSql('DELETE FROM entries WHERE id = ?;', [id]);
}

export async function getHistoryForEntry(entryId: number): Promise<HistoryRow[]> {
  await initDb();
  const result = await executeSql(
    'SELECT * FROM history WHERE entry_id = ? ORDER BY logged_date DESC;',
    [entryId]
  );
  return (result.rows?._array ?? []) as HistoryRow[];
}

export async function pruneOldHistory(months: number): Promise<void> {
  await initDb();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffIso = cutoff.toISOString();
  await executeSql('DELETE FROM history WHERE logged_date < ?;', [cutoffIso]);
}
