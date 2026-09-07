import { addDays, addMonths, addWeeks, differenceInCalendarDays, isValid, parseISO, startOfDay } from "date-fns";

export type RecurrenceMode = "days" | "months" | "weekdays" | "custom" | "dayOfMonth" | "date";

export interface RecurrenceConfig {
  mode: RecurrenceMode;
  interval: number;
  weekdays: number[];
  dayOfMonth?: number;
  date?: string;
}

function normalizeDate(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  date.setHours(9, 0, 0, 0);
  return date;
}

function clampDayOfMonth(year: number, month: number, day: number) {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function addOccurrence(list: Date[], date: Date, start: Date, end: Date) {
  if (date >= start && date <= end) list.push(date);
}

export function getRecurrenceConfig(value: unknown, fallback: RecurrenceConfig): RecurrenceConfig {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<RecurrenceConfig>;
  const mode: RecurrenceMode =
    raw.mode === "months" || raw.mode === "weekdays" || raw.mode === "custom" || raw.mode === "dayOfMonth" || raw.mode === "date"
      ? raw.mode
      : "days";
  const interval = typeof raw.interval === "number" && raw.interval > 0 ? Math.floor(raw.interval) : fallback.interval;
  const weekdays = Array.isArray(raw.weekdays)
    ? raw.weekdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : fallback.weekdays;
  const dayOfMonth = typeof raw.dayOfMonth === "number" && raw.dayOfMonth >= 1 && raw.dayOfMonth <= 31
    ? Math.floor(raw.dayOfMonth)
    : fallback.dayOfMonth;
  const date = typeof raw.date === "string" && isValid(parseISO(raw.date)) ? raw.date.slice(0, 10) : fallback.date;
  return { mode, interval, weekdays, dayOfMonth, date };
}

export function generateRecurrenceDates(startValue: string, endValue: string, config: RecurrenceConfig): Date[] {
  const start = normalizeDate(startValue);
  const end = normalizeDate(endValue);
  if (!isValid(start) || !isValid(end) || end < start) return [];

  const dates: Date[] = [];
  const interval = Math.max(1, Math.floor(config.interval || 1));

  if (config.mode === "date") {
    if (config.date) addOccurrence(dates, normalizeDate(config.date), start, end);
    return dates;
  }

  if (config.mode === "dayOfMonth") {
    const requestedDay = Math.min(31, Math.max(1, Math.floor(config.dayOfMonth || 1)));
    for (let month = new Date(start.getFullYear(), start.getMonth(), 1); month <= end; month = addMonths(month, interval)) {
      const date = new Date(month.getFullYear(), month.getMonth(), clampDayOfMonth(month.getFullYear(), month.getMonth(), requestedDay), 9);
      addOccurrence(dates, date, start, end);
    }
    return dates;
  }

  if (config.mode === "months") {
    for (let date = start; date <= end; date = addMonths(date, interval)) dates.push(date);
    return dates;
  }

  if (config.mode === "weekdays") {
    const weekdays = new Set(config.weekdays);
    for (let offset = 0; offset <= differenceInCalendarDays(end, start); offset += 1) {
      const date = addDays(start, offset);
      if (weekdays.has(date.getDay())) dates.push(date);
    }
    return dates;
  }

  const intervalDays = config.mode === "custom" ? interval * 7 : interval;
  for (let offset = 0; offset <= differenceInCalendarDays(end, start); offset += intervalDays) {
    const date = addDays(start, offset);
    if (date <= end) dates.push(date);
  }
  return dates;
}

export function getNextRecurrenceDate(afterValue: string | Date, config: RecurrenceConfig): Date | null {
  const after = startOfDay(typeof afterValue === "string" ? parseISO(afterValue) : afterValue);
  if (!isValid(after)) return null;

  if (config.mode === "date") {
    if (!config.date) return null;
    const date = normalizeDate(config.date);
    return date > after ? date : null;
  }

  if (config.mode === "dayOfMonth") {
    const requestedDay = Math.min(31, Math.max(1, Math.floor(config.dayOfMonth || 1)));
    let month = new Date(after.getFullYear(), after.getMonth(), 1);
    const interval = Math.max(1, Math.floor(config.interval || 1));
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), clampDayOfMonth(month.getFullYear(), month.getMonth(), requestedDay), 9);
      if (date > after) return date;
      month = addMonths(month, interval);
    }
    return null;
  }

  const rangeEnd = addMonths(after, 24);
  const dates = generateRecurrenceDates(after.toISOString(), rangeEnd.toISOString(), config);
  return dates.find((date) => date > after) ?? null;
}

export function getLegacyRoutineRecurrence(intervalDays: number, unit: unknown, nextDueDate?: string | null): RecurrenceConfig {
  if (unit === "date") return { mode: "date", interval: 1, weekdays: [], date: nextDueDate?.slice(0, 10) };
  return { mode: "days", interval: intervalDays, weekdays: [] };
}

export function getRoutineRecurrenceConfig(
  metadata: Record<string, unknown>,
  intervalDays: number | null,
  nextDueDate: string | null
): RecurrenceConfig | null {
  if (metadata.recurrence_config) {
    return getRecurrenceConfig(metadata.recurrence_config, { mode: "days", interval: intervalDays ?? 1, weekdays: [] });
  }
  if (metadata.repeat_unit === "date") return getLegacyRoutineRecurrence(1, "date", nextDueDate);
  if (!intervalDays) return null;
  return getLegacyRoutineRecurrence(intervalDays, metadata.repeat_unit);
}

export function toIsoDate(date: Date | null) {
  return date?.toISOString() ?? null;
}

export function addRoutineInterval(date: Date, intervalDays: number) {
  return addDays(date, intervalDays);
}

export function addRoutineWeeks(date: Date, weeks: number) {
  return addWeeks(date, weeks);
}