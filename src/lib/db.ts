import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

export type EntryCategory = 'purchase' | 'task' | 'event' | 'routine';

export type EntryRecord = {
  id?: number;
  title: string;
  category: EntryCategory;
  entry_date: string;
  next_due_date: string | null;
  price: number | null;
  notes: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: string;
};

export type HistoryRecord = {
  id?: number;
  entry_id: number;
  logged_date: string;
  notes: string;
};

export type SettingsRecord = {
  key: 'history_months';
  value: number;
};

type SinceTimerDB = {
  entries: EntryRecord;
  history: HistoryRecord;
  settings: SettingsRecord;
};

let dbPromise: Promise<IDBPDatabase<SinceTimerDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SinceTimerDB>('since-timer-db', 1, {
      upgrade(db) {
        const entriesStore = db.createObjectStore('entries', {
          keyPath: 'id',
          autoIncrement: true,
        });

        entriesStore.createIndex('by_category', 'category');
        entriesStore.createIndex('by_created_at', 'created_at');
        entriesStore.createIndex('by_entry_date', 'entry_date');

        const historyStore = db.createObjectStore('history', {
          keyPath: 'id',
          autoIncrement: true,
        });
        historyStore.createIndex('by_entry_id', 'entry_id');
        historyStore.createIndex('by_logged_date', 'logged_date');

        const settingsStore = db.createObjectStore('settings', {
          keyPath: 'key',
        });
        settingsStore.put({ key: 'history_months', value: 6 });
      },
    });
  }

  return dbPromise;
}

export async function insertEntry(entry: EntryRecord): Promise<number> {
  const db = await getDb();
  const id = await db.add('entries', entry);
  return id as number;
}

export async function getAllEntries(): Promise<EntryRecord[]> {
  const db = await getDb();
  const records = await db.getAll('entries');
  return records.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getEntryById(id: number): Promise<EntryRecord | undefined> {
  const db = await getDb();
  return db.get('entries', id);
}

export async function updateEntry(id: number, updates: Partial<EntryRecord>): Promise<void> {
  const db = await getDb();
  const existing = await db.get('entries', id);
  if (!existing) return;
  const updated: EntryRecord = {
    ...existing,
    ...updates,
    next_due_date:
      updates.next_due_date !== undefined ? updates.next_due_date : existing.next_due_date,
    price: updates.price !== undefined ? updates.price : existing.price,
    notes: updates.notes !== undefined ? updates.notes : existing.notes,
    reminder_enabled:
      updates.reminder_enabled !== undefined ? updates.reminder_enabled : existing.reminder_enabled,
    reminder_time:
      updates.reminder_time !== undefined ? updates.reminder_time : existing.reminder_time,
  };
  await db.put('entries', updated);
}

export async function deleteEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('entries', id);

  const historyIndex = db.transaction('history', 'readwrite').store.index('by_entry_id');
  let cursor = await historyIndex.openCursor(IDBKeyRange.only(id));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
}

export async function getHistoryForEntry(entryId: number): Promise<HistoryRecord[]> {
  const db = await getDb();
  const historyIndex = db.transaction('history').store.index('by_entry_id');
  const records = await historyIndex.getAll(IDBKeyRange.only(entryId));
  return records.sort(
    (a, b) => new Date(b.logged_date).getTime() - new Date(a.logged_date).getTime()
  );
}

export async function pruneOldHistory(months: number): Promise<void> {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffIso = cutoff.toISOString();

  const tx = db.transaction(['history', 'settings'], 'readwrite');
  const historyStore = tx.objectStore('history');
  let cursor = await historyStore.openCursor();
  while (cursor) {
    if (cursor.value.logged_date < cutoffIso) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }

  await tx.objectStore('settings').put({ key: 'history_months', value: months });
  await tx.done;
}
