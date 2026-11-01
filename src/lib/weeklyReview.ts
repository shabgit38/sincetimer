export interface WeeklyReviewWindow {
  start: Date;
  end: Date;
}

export function getWeeklyReviewWindow(now: Date): WeeklyReviewWindow | null {
  const day = now.getDay();
  if (day !== 0 && day !== 6) return null;

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));

  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function isDateWithinWeeklyReviewWindow(value: string, window: WeeklyReviewWindow): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= window.start && date <= window.end;
}
