export type EntryCategory = 'purchase' | 'task' | 'event' | 'routine';

export interface Entry {
  id: number;
  title: string;
  category: EntryCategory;
  entry_date: string;
  next_due_date: string | null;
  price: number | null;
  notes: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: string;
}

export interface HistoryItem {
  id: number;
  entry_id: number;
  logged_date: string;
  notes: string;
}

export interface AppSetting {
  key: 'history_months';
  value: number;
}

export type TimeSummary = {
  daysPassed: number;
  weeksPassed: number;
  monthsPassed: number;
  nextDueIn: number | null;
  isOverdue: boolean;
};
