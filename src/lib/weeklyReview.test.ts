import { describe, expect, it } from "vitest";

import { getWeeklyReviewWindow, isDateWithinWeeklyReviewWindow } from "./weeklyReview";

describe("getWeeklyReviewWindow", () => {
  it("returns the Monday-to-Friday window on Saturday", () => {
    const window = getWeeklyReviewWindow(new Date(2026, 9, 31, 12));

    expect(window?.start).toEqual(new Date(2026, 9, 26, 0, 0, 0, 0));
    expect(window?.end).toEqual(new Date(2026, 9, 30, 23, 59, 59, 999));
  });

  it("extends the review window through Saturday on Sunday", () => {
    const window = getWeeklyReviewWindow(new Date(2026, 10, 1, 12));

    expect(window?.start).toEqual(new Date(2026, 9, 26, 0, 0, 0, 0));
    expect(window?.end).toEqual(new Date(2026, 9, 31, 23, 59, 59, 999));
  });

  it("does not show a review window on weekdays", () => {
    expect(getWeeklyReviewWindow(new Date(2026, 9, 30, 12))).toBeNull();
  });
});

describe("isDateWithinWeeklyReviewWindow", () => {
  it("includes the local Monday and Friday boundaries", () => {
    const window = getWeeklyReviewWindow(new Date(2026, 9, 31, 12));
    if (!window) throw new Error("Expected a weekend review window.");

    expect(isDateWithinWeeklyReviewWindow(new Date(2026, 9, 26, 0).toISOString(), window)).toBe(true);
    expect(isDateWithinWeeklyReviewWindow(new Date(2026, 9, 30, 23, 59, 59, 999).toISOString(), window)).toBe(true);
  });

  it("includes Saturday activity in the Sunday review window", () => {
    const window = getWeeklyReviewWindow(new Date(2026, 10, 1, 12));
    if (!window) throw new Error("Expected a weekend review window.");

    expect(isDateWithinWeeklyReviewWindow(new Date(2026, 9, 31, 23, 59, 59, 999).toISOString(), window)).toBe(true);
  });

  it("excludes dates outside the review week and invalid dates", () => {
    const window = getWeeklyReviewWindow(new Date(2026, 9, 31, 12));
    if (!window) throw new Error("Expected a weekend review window.");

    expect(isDateWithinWeeklyReviewWindow(new Date(2026, 9, 25, 23, 59).toISOString(), window)).toBe(false);
    expect(isDateWithinWeeklyReviewWindow("not-a-date", window)).toBe(false);
  });
});
