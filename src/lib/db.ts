import { supabase } from './supabase';
import { getBillingCycle, getNextSubscriptionRenewalIso } from './subscriptions';
import type { AppSetting, Entry, EntryOption, EntryPayload, HistoryItem } from '@/types/entry';

const defaultAreaNames = ['home', 'work', 'personal', 'health'];
const defaultCategoryNames = ['goal', 'routine', 'task', 'purchase', 'subscription', 'appointment', 'health record', 'plan'];

const entriesSelect = `
  id,
  user_id,
  title,
  area,
  category,
  entry_date,
  next_due_date,
  repeat_interval_days,
  metadata,
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

function normalizeOptionName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function addDaysIso(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function normalizeCategory(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[_-]+/g, ' ');
}

function isSubscriptionEntry(entry: Entry) {
  return normalizeCategory(entry.category) === 'subscription';
}

function getNextDueDateForLog(entry: Entry, loggedAt: Date) {
  if (isSubscriptionEntry(entry)) {
    return getNextSubscriptionRenewalIso(
      entry.entry_date,
      getBillingCycle(entry.metadata.billing_cycle),
      loggedAt,
      { afterFromDate: true }
    ) ?? entry.next_due_date;
  }
  if (!entry.repeat_interval_days) return entry.next_due_date;
  return addDaysIso(loggedAt, entry.repeat_interval_days);
}

function getLatestLogDate(entry: Entry, history: HistoryItem[]) {
  return history.reduce((latest, record) => {
    const loggedDate = new Date(record.logged_date);
    return loggedDate > latest ? loggedDate : latest;
  }, new Date(entry.entry_date));
}

function hasHistoryForDate(history: HistoryItem[], date: Date) {
  const timestamp = date.getTime();
  return history.some((record) => new Date(record.logged_date).getTime() === timestamp);
}

function hasOptionNamed(options: EntryOption[], name: string, exceptId?: string) {
  const normalized = name.toLocaleLowerCase();
  return options.some(
    (option) => option.id !== exceptId && option.name.toLocaleLowerCase() === normalized
  );
}

async function getOptions(table: 'areas' | 'categories', defaults: string[]): Promise<EntryOption[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from(table)
    .select('id, user_id, name, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (error) throw error;

  const existing = (data ?? []) as EntryOption[];
  const missingDefaults = defaults.filter(
    (name) => !existing.some((option) => option.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  );
  if (existing.length > 0 && missingDefaults.length === 0) return existing;

  const now = new Date().toISOString();
  const { data: seeded, error: seedError } = await supabase
    .from(table)
    .insert((existing.length > 0 ? missingDefaults : defaults).map((name) => ({ user_id: userId, name, created_at: now, updated_at: now })))
    .select('id, user_id, name, created_at, updated_at')
    .order('created_at', { ascending: true });

  if (seedError) throw seedError;
  return [...existing, ...((seeded ?? []) as EntryOption[])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

async function insertOption(table: 'areas' | 'categories', name: string): Promise<EntryOption> {
  const userId = await requireUserId();
  const normalizedName = normalizeOptionName(name);
  if (!normalizedName) throw new Error('Name is required.');

  const options = await getOptions(table, table === 'areas' ? defaultAreaNames : defaultCategoryNames);
  if (hasOptionNamed(options, normalizedName)) throw new Error('That name already exists.');

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(table)
    .insert({ user_id: userId, name: normalizedName, created_at: now, updated_at: now })
    .select('id, user_id, name, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as EntryOption;
}

async function renameOption(
  table: 'areas' | 'categories',
  entryColumn: 'area' | 'category',
  option: Pick<EntryOption, 'id' | 'name'>,
  nextName: string
): Promise<void> {
  const userId = await requireUserId();
  const normalizedName = normalizeOptionName(nextName);
  if (!normalizedName) throw new Error('Name is required.');
  if (normalizedName === option.name) return;

  const options = await getOptions(table, table === 'areas' ? defaultAreaNames : defaultCategoryNames);
  if (hasOptionNamed(options, normalizedName, option.id)) throw new Error('That name already exists.');

  const now = new Date().toISOString();
  const { error: optionError } = await supabase
    .from(table)
    .update({ name: normalizedName, updated_at: now })
    .eq('id', option.id)
    .eq('user_id', userId);

  if (optionError) throw optionError;

  const { error: entriesError } = await supabase
    .from('entries')
    .update({ [entryColumn]: normalizedName, updated_at: now })
    .eq('user_id', userId)
    .eq(entryColumn, option.name);

  if (entriesError) throw entriesError;
}

export function getDefaultAreas() {
  return defaultAreaNames;
}

export function getDefaultCategories() {
  return defaultCategoryNames;
}

export async function getAreas(): Promise<EntryOption[]> {
  return getOptions('areas', defaultAreaNames);
}

export async function getCategories(): Promise<EntryOption[]> {
  return getOptions('categories', defaultCategoryNames);
}

export async function insertArea(name: string): Promise<EntryOption> {
  return insertOption('areas', name);
}

export async function insertCategory(name: string): Promise<EntryOption> {
  return insertOption('categories', name);
}

export async function renameArea(option: Pick<EntryOption, 'id' | 'name'>, nextName: string): Promise<void> {
  return renameOption('areas', 'area', option, nextName);
}

export async function renameCategory(option: Pick<EntryOption, 'id' | 'name'>, nextName: string): Promise<void> {
  return renameOption('categories', 'category', option, nextName);
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

export async function updateHistory(
  id: string,
  updates: Partial<Pick<HistoryItem, 'logged_date' | 'notes'>>
): Promise<void> {
  const { error } = await supabase
    .from('entry_logs')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteHistory(id: string): Promise<void> {
  const { error } = await supabase.from('entry_logs').delete().eq('id', id);
  if (error) throw error;
}

export async function logEntryAgain(entry: Entry, loggedAt: Date): Promise<void> {
  const history = await getHistoryForEntry(entry.id);
  const isSubscription = isSubscriptionEntry(entry);
  const latestLogDate = getLatestLogDate(entry, history);
  const shouldPromoteLog = loggedAt >= latestLogDate;
  const historyDate = isSubscription ? loggedAt : shouldPromoteLog ? new Date(entry.entry_date) : loggedAt;
  const shouldInsertHistory = isSubscription
    ? !hasHistoryForDate(history, historyDate)
    : (!shouldPromoteLog || historyDate.getTime() !== loggedAt.getTime()) && !hasHistoryForDate(history, historyDate);
  const currentCompletedCount =
    typeof entry.metadata.completed_count === 'number' ? entry.metadata.completed_count : 0;

  if (shouldInsertHistory) {
    await insertHistory({
      entry_id: entry.id,
      logged_date: historyDate.toISOString(),
      notes: '',
    });
  }

  await updateEntry(entry.id, {
    ...(isSubscription
      ? {
          next_due_date: getNextDueDateForLog(entry, loggedAt),
        }
      : shouldPromoteLog
      ? {
          entry_date: loggedAt.toISOString(),
          next_due_date: getNextDueDateForLog(entry, loggedAt),
        }
      : {}),
    metadata: {
      ...entry.metadata,
      completed_count: isSubscription && !shouldInsertHistory
        ? currentCompletedCount
        : currentCompletedCount + 1,
    },
  });
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
