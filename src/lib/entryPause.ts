import { addMilliseconds, isValid, parseISO } from "date-fns";

import { getRoutineRecurrenceConfig } from "@/lib/recurrence";
import type { Entry, EntryPayload } from "@/types/entry";

const pausedAtKey = "paused_at";

export function isEntryPaused(metadata: Record<string, unknown>) {
  return typeof metadata[pausedAtKey] === "string";
}

export function canPauseEntry(entry: Entry) {
  const category = entry.category.trim().toLocaleLowerCase().replace(/[_-]+/g, " ");
  if (category === "subscription") return true;
  return category === "routine" &&
    getRoutineRecurrenceConfig(entry.metadata, entry.repeat_interval_days, entry.next_due_date) !== null;
}

export function getPauseUpdates(entry: Entry, resumedAt: Date): Partial<EntryPayload> {
  const pausedAtValue = entry.metadata[pausedAtKey];
  if (typeof pausedAtValue !== "string") {
    throw new Error("This entry is not paused.");
  }

  const pausedAt = parseISO(pausedAtValue);
  if (!isValid(pausedAt) || !isValid(resumedAt)) {
    throw new Error("The pause date is invalid.");
  }
  if (resumedAt < pausedAt) {
    throw new Error("The resume date cannot be before the pause date.");
  }

  const pauseDuration = resumedAt.getTime() - pausedAt.getTime();
  const nextDueDate = entry.next_due_date ? parseISO(entry.next_due_date) : null;
  if (nextDueDate && !isValid(nextDueDate)) {
    throw new Error("The next due date is invalid.");
  }

  return {
    ...(nextDueDate ? { next_due_date: addMilliseconds(nextDueDate, pauseDuration).toISOString() } : {}),
    metadata: {
      ...entry.metadata,
      [pausedAtKey]: null,
    },
  };
}
