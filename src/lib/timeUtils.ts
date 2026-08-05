import {
  differenceInCalendarDays,
  differenceInMonths,
  differenceInWeeks,
  intervalToDuration,
  isBefore,
  parseISO,
} from 'date-fns';
import type { TimeSummary } from '../types/entry';

export function computeTimeSummary(entryDateIso: string, nextDueDateIso?: string | null): TimeSummary {
  const now = new Date();
  const entryDate = parseISO(entryDateIso);

  const daysPassed = differenceInCalendarDays(now, entryDate);
  const weeksPassed = differenceInWeeks(now, entryDate);
  const monthsPassed = differenceInMonths(now, entryDate);

  if (!nextDueDateIso) {
    return {
      daysPassed,
      weeksPassed,
      monthsPassed,
      nextDueIn: null,
      isOverdue: false,
    };
  }

  const nextDueDate = parseISO(nextDueDateIso);
  const nextDueIn = differenceInCalendarDays(nextDueDate, now);
  const isOverdue = nextDueIn < 0;

  return {
    daysPassed,
    weeksPassed,
    monthsPassed,
    nextDueIn,
    isOverdue,
  };
}

export function formatYearMonthDayDuration(fromDate: Date | string, toDate: Date = new Date()): string {
  const start = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  const isFuture = isBefore(toDate, start);
  const formatted = formatYearMonthDaySpan(isFuture ? toDate : start, isFuture ? start : toDate);

  return `${formatted}${isFuture ? ' from now' : ' ago'}`;
}

export function formatYearMonthDaySpan(fromDate: Date | string, toDate: Date | string): string {
  const start = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  const end = typeof toDate === 'string' ? parseISO(toDate) : toDate;
  const duration = intervalToDuration({ start, end });

  const parts = [
    duration.years ? `${duration.years} ${duration.years === 1 ? 'year' : 'years'}` : null,
    duration.months ? `${duration.months} ${duration.months === 1 ? 'month' : 'months'}` : null,
    duration.days || (!duration.years && !duration.months)
      ? `${duration.days ?? 0} ${duration.days === 1 ? 'day' : 'days'}`
      : null,
  ].filter(Boolean);

  return parts.join(', ');
}
