export type EntryArea = string;
export type EntryCategory = string;

export interface EntryOption {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  title: string;
  area: EntryArea;
  category: EntryCategory;
  entry_date: string;
  next_due_date: string | null;
  repeat_interval_days: number | null;
  price: number | null;
  notes: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryItem {
  id: string;
  entry_id: string;
  user_id: string;
  logged_date: string;
  notes: string;
  created_at: string;
}

export interface AppSetting {
  user_id: string;
  key: 'history_months';
  value: number;
}

export type EntryPayload = Omit<Entry, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export type TimeSummary = {
  daysPassed: number;
  weeksPassed: number;
  monthsPassed: number;
  nextDueIn: number | null;
  isOverdue: boolean;
};
