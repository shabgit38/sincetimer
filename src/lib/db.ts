import { supabase } from './supabase';
import type { AppSetting, Entry, EntryPayload, HistoryItem } from '@/types/entry';

const entriesSelect = `
  id,
  user_id,
  title,
  area,
  type,
  category,
  entry_date,
  next_due_date,
  repeat_interval_days,
  price,
  notes,
  reminder_enabled,
  reminder_time,
  created_at,
  updated_at
`;

const historySelect = `
  id,
  entry_id,
  user_id,
  logged_date,
  notes,
  created_at
`;

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Please sign in before changing entries.');
  return data.user.id;
}

export async function insertEntry(entry: EntryPayload): Promise<string> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('entries')
    .insert({ ...entry, user_id: userId, created_at: now, updated_at: now })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function getAllEntries(): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select(entriesSelect)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Entry[];
}

export async function getEntryById(id: string): Promise<Entry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select(entriesSelect)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as Entry | null) ?? null;
}

export async function updateEntry(id: string, updates: Partial<EntryPayload>): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
}

export async function getHistoryForEntry(entryId: string): Promise<HistoryItem[]> {
  const { data, error } = await supabase
    .from('entry_logs')
    .select(historySelect)
    .eq('entry_id', entryId)
    .order('logged_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as HistoryItem[];
}

export async function insertHistory(history: Pick<HistoryItem, 'entry_id' | 'logged_date' | 'notes'>): Promise<string> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('entry_logs')
    .insert({ ...history, user_id: userId })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function pruneOldHistory(months: number): Promise<void> {
  const userId = await requireUserId();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);

  const [{ error: deleteError }, { error: settingsError }] = await Promise.all([
    supabase
      .from('entry_logs')
      .delete()
      .lt('logged_date', cutoff.toISOString())
      .eq('user_id', userId),
    supabase
      .from('settings')
      .upsert({ user_id: userId, key: 'history_months', value: months }),
  ]);

  if (deleteError) throw deleteError;
  if (settingsError) throw settingsError;
}

export async function getHistoryMonths(): Promise<number> {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .eq('key', 'history_months')
    .maybeSingle();

  if (error) throw error;
  const record = data as AppSetting | null;
  return record?.value ?? 6;
}
