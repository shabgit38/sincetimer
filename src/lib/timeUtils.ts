import {
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  isBefore,
  parseISO,
} from 'date-fns';
import type { TimeSummary } from '../types/entry';

export function computeTimeSummary(entryDateIso: string, nextDueDateIso?: string | null): TimeSummary {
  const now = new Date();
  const entryDate = parseISO(entryDateIso);

  const daysPassed = differenceInDays(now, entryDate);
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
  const nextDueIn = differenceInDays(nextDueDate, now);
  const isOverdue = isBefore(nextDueDate, now);

  return {
    daysPassed,
    weeksPassed,
    monthsPassed,
    nextDueIn,
    isOverdue,
  };
}
