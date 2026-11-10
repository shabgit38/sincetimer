import { describe, expect, it } from "vitest";

import { canPauseEntry, getPauseUpdates, isEntryPaused } from "@/lib/entryPause";
import type { Entry } from "@/types/entry";

function createEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "entry-1",
    user_id: "user-1",
    title: "Test entry",
    area: "personal",
    category: "routine",
    entry_date: "2026-10-01T09:00:00.000Z",
    next_due_date: "2026-10-08T09:00:00.000Z",
    repeat_interval_days: 7,
    metadata: { recurrence_config: { mode: "days", interval: 7, weekdays: [] } },
    price: null,
    notes: null,
    reminder_enabled: true,
    reminder_time: "09:00",
    created_at: "2026-10-01T09:00:00.000Z",
    updated_at: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("entry pause helpers", () => {
  it("allows pausing subscriptions and recurring routines, but not one-off routines", () => {
    expect(canPauseEntry(createEntry())).toBe(true);
    expect(canPauseEntry(createEntry({ category: "routine", repeat_interval_days: null, metadata: {} }))).toBe(false);
    expect(canPauseEntry(createEntry({ category: "subscription", repeat_interval_days: null, metadata: {} }))).toBe(true);
  });

  it("recognizes pause metadata and shifts the due date by the paused duration on resume", () => {
    const entry = createEntry({
      metadata: {
        recurrence_config: { mode: "days", interval: 7, weekdays: [] },
        paused_at: "2026-10-08T09:00:00.000Z",
      },
    });

    expect(isEntryPaused(entry.metadata)).toBe(true);
    expect(getPauseUpdates(entry, new Date("2026-10-11T09:00:00.000Z"))).toEqual({
      next_due_date: "2026-10-11T09:00:00.000Z",
      metadata: {
        recurrence_config: { mode: "days", interval: 7, weekdays: [] },
        paused_at: null,
      },
    });
  });

  it("clears a pause without adding a due date when none exists", () => {
    const entry = createEntry({
      next_due_date: null,
      metadata: { paused_at: "2026-10-08T09:00:00.000Z" },
    });

    expect(getPauseUpdates(entry, new Date("2026-10-09T09:00:00.000Z"))).toEqual({
      metadata: { paused_at: null },
    });
  });
});
